#!/usr/bin/env python3
"""Fail-closed visual layout gate for conservative original-DOCX text changes.

Input remains private in a temporary directory and is deleted after the check.
This validates one short changed line, not arbitrary complex paragraph reflow.
The verifier must run wherever a trusted LibreOffice/Word renderer is available;
Cloudflare Pages does not itself provide an Office layout engine.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image, ImageChops
except ImportError as exc:
    raise SystemExit("WORD_RENDER_DEPENDENCY_MISSING: Pillow") from exc

MAX_SOURCE_BYTES = 3 * 1024 * 1024


class WordLayoutError(RuntimeError):
    pass


def run(cmd: list[str], *, timeout: int = 40) -> None:
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise WordLayoutError("WORD_RENDER_FAILED") from exc
    if result.returncode != 0:
        raise WordLayoutError("WORD_RENDER_FAILED")


def convert_word(source: Path, target: Path, profile: Path) -> Path:
    target.mkdir(parents=True, exist_ok=True)
    cmd = [
        "libreoffice",
        "-env:UserInstallation=" + profile.as_uri(),
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        str(target),
        str(source),
    ]
    run(cmd, timeout=65)
    result = target / (source.stem + ".pdf")
    if not result.exists() or result.stat().st_size < 500:
        raise WordLayoutError("WORD_RENDER_FAILED")
    return result


def page_images(pdf: Path, dest: Path) -> list[Path]:
    dest.mkdir(parents=True, exist_ok=True)
    run(["pdftoppm", "-f", "1", "-l", "20", "-r", "120", "-png",
         str(pdf), str(dest / "page")], timeout=65)
    files = sorted(dest.glob("page-*.png"),
                   key=lambda p: int(re.search(r"-(\d+)\.png$", p.name).group(1)))
    if not files or len(files) > 20:
        raise WordLayoutError("WORD_PAGE_COUNT_UNSAFE")
    return files


def extract_text(pdf: Path) -> str:
    try:
        done = subprocess.run(
            ["pdftotext", "-layout", str(pdf), "-"],
            capture_output=True, text=True, timeout=25, check=True
        )
    except (subprocess.CalledProcessError, OSError, subprocess.TimeoutExpired) as exc:
        raise WordLayoutError("WORD_TEXT_NOT_VERIFIED") from exc
    return "".join(done.stdout.split())


def verify_layout_preserved(
    original: bytes,
    edited: bytes,
    *,
    old_text: str,
    new_text: str,
) -> dict:
    if not original or not edited or len(original) > MAX_SOURCE_BYTES or \
       len(edited) > MAX_SOURCE_BYTES or not old_text or not new_text or \
       old_text == new_text:
        raise WordLayoutError("WORD_INPUT_UNSAFE")
    if not shutil.which("libreoffice") or not shutil.which("pdftoppm") or \
       not shutil.which("pdftotext"):
        raise WordLayoutError("WORD_RENDER_DEPENDENCY_MISSING")

    with tempfile.TemporaryDirectory(prefix="hhba-word-qa-") as td:
        root = Path(td)
        base, revised = root / "source.docx", root / "edited.docx"
        base.write_bytes(original)
        revised.write_bytes(edited)

        old_pdf = convert_word(base, root / "old-pdf", root / "lo-source")
        new_pdf = convert_word(revised, root / "new-pdf", root / "lo-edited")
        old_pages = page_images(old_pdf, root / "old-pages")
        new_pages = page_images(new_pdf, root / "new-pages")
        if len(old_pages) != len(new_pages):
            raise WordLayoutError("WORD_LAYOUT_MOVED")

        clean = lambda text: "".join(text.split())
        before = clean(extract_text(old_pdf))
        after = clean(extract_text(new_pdf))
        if clean(old_text) not in before or clean(new_text) not in after or \
           clean(old_text) in after:
            raise WordLayoutError("WORD_TEXT_NOT_VERIFIED")

        changed_page_count = 0
        location = None
        changed_pixels = 0
        for page_number, (old_png, new_png) in enumerate(zip(old_pages, new_pages), 1):
            with Image.open(old_png) as original_img, Image.open(new_png) as modified_img:
                a = original_img.convert("RGB")
                b = modified_img.convert("RGB")
                if a.size != b.size:
                    raise WordLayoutError("WORD_LAYOUT_MOVED")
                diff = ImageChops.difference(a, b).convert("L")
                # Suppress micro-variation in anti-aliasing on different runs.
                threshold = diff.point(lambda p: 255 if p >= 10 else 0)
                bounds = threshold.getbbox()
                if bounds is None:
                    continue
                changed_page_count += 1
                if changed_page_count > 1:
                    raise WordLayoutError("WORD_LAYOUT_MOVED")
                left, top, right, bottom = bounds
                width, height = a.size
                if (right-left) > width * 0.58 or \
                   (bottom-top) > max(45, height * 0.04):
                    raise WordLayoutError("WORD_LAYOUT_MOVED")
                histogram = threshold.histogram()
                pixels = histogram[255] if len(histogram) > 255 else 0
                if pixels > width * height * 0.025:
                    raise WordLayoutError("WORD_LAYOUT_MOVED")
                changed_pixels = pixels
                location = {
                    "page": page_number,
                    "x": left, "y": top,
                    "width": right-left, "height": bottom-top,
                }
        if changed_page_count != 1 or location is None or changed_pixels < 5:
            raise WordLayoutError("WORD_TEXT_NOT_VERIFIED")
        return {
            "passed": True,
            "page_count": len(old_pages),
            "changed_region": location,
            "changed_pixels": changed_pixels,
            "styles_checked_by": "rendered_pages",
        }


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit(
            "Usage: word-layout-preservation.qa.py ORIGINAL.docx EDITED.docx OLD_TEXT NEW_TEXT"
        )
    try:
        report = verify_layout_preserved(
            Path(sys.argv[1]).read_bytes(),
            Path(sys.argv[2]).read_bytes(),
            old_text=sys.argv[3],
            new_text=sys.argv[4],
        )
        print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    except WordLayoutError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1) from None
