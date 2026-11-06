#!/usr/bin/env python3
"""Mark only the separate Edge P0 lab Pages project as non-indexable.

This is run by the lab project's build command after the canonical HHBA
Cloudflare build. The main hhba-talent Pages project does NOT invoke it.
"""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1] / "dist"
if not (ROOT / "index.html").is_file():
    raise SystemExit("Refuse to edit output: canonical HHBA build has not finished")
(ROOT / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")
headers = ROOT / "_headers"
prior = headers.read_text(encoding="utf-8") if headers.exists() else ""
headers.write_text(prior.rstrip()+"\n\n/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n", encoding="utf-8")
print("EDGE_LAB_NONINDEXABLE=1")
