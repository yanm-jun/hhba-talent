#!/usr/bin/env python3
"""Prepare the OFL-licensed Zhi Mang Xing running-script subset for GitHub Pages.

Run after Vite build; the resulting font and the full license are served locally.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlopen
from fontTools import subset
from fontTools.ttLib import TTFont

SOURCE = "https://raw.githubusercontent.com/google/fonts/main/ofl/zhimangxing/"
DESTINATION = Path(__file__).resolve().parents[1] / "dist" / "fonts"
SLOGAN = "从人民中来 到人民中去"

def download(filename: str) -> bytes:
    with urlopen(SOURCE + filename, timeout=75) as response:
        return response.read()

def main() -> None:
    DESTINATION.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as directory:
        raw = Path(directory) / "ZhiMangXing-Regular.ttf"
        raw.write_bytes(download("ZhiMangXing-Regular.ttf"))
        license_text = download("OFL.txt")
        if b"SIL OPEN FONT LICENSE" not in license_text:
            raise RuntimeError("Missing verifiable OFL font license")
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        font = TTFont(str(raw))
        missing = sorted(set(map(ord, SLOGAN)) - set(font.getBestCmap()))
        if missing:
            raise RuntimeError(f"Font is missing slogan glyphs: {missing}")
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(text=SLOGAN)
        subsetter.subset(font)
        output = DESTINATION / "hhba-people-xingshu.woff2"
        font.flavor = "woff2"
        font.save(output)
        (DESTINATION / "OFL-Zhi-Mang-Xing.txt").write_bytes(license_text)
        verify = TTFont(str(output))
        if set(map(ord, SLOGAN)) - set(verify.getBestCmap()):
            raise RuntimeError("The subset lost slogan glyphs")
        if not 1000 < output.stat().st_size < 250000:
            raise RuntimeError("Unexpected font subset size")
        print(f"HHBA local Xingshu ready: {output.stat().st_size} bytes")

if __name__ == "__main__":
    main()
