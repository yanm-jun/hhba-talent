#!/usr/bin/env python3
"""Download *real* CC-licensed Wikimedia Commons photographs and self-host WebP card crops.

Run only for the eight reviewed files. Do not replace sources with image generators,
unlicensed stock photos, or synthetic country artwork.
Photo metadata/attribution: apps/web/src/data/overseasCountryPhotos.ts.
"""
import io
import os
import time
from pathlib import Path
from urllib.parse import quote
import requests
from PIL import Image, ImageOps, UnidentifiedImageError

SOURCES = {
    "nz": "The Remarkables from Queenstown, New Zealand 04.jpg",
    "au": "Sydney Harbour Bridge and Sydney Opera House panorama.jpg",
    "jp": "Tokyo - Sunset Skyline.jpg",
    "de": "Reichstag, Berlin 1.jpg",
    "ca": "Moraine Lake panorama.jpg",
    "uk": "Westminster Palace and Big Ben.jpg",
    "sg": "Panorama of Singapore's Marina Bay.jpg",
    "us": "New york city skyline panorama.jpg",
}
OUTPUT = Path(__file__).resolve().parents[1] / "public/overseas/countries"
HEADERS = {
    "User-Agent": "HHBA-OverseasPhotoAssetImport/1.0 (https://github.com/yanm-jun/hhba-talent; Wikimedia Commons reuse with attribution)",
    "Accept": "image/avif,image/webp,image/jpeg,image/png,application/json;q=0.9,*/*;q=0.6",
}
MAX_BYTES = 28 * 1024 * 1024

def download_image(session, code, filename):
    api="https://commons.wikimedia.org/w/api.php"
    params={"action":"query","prop":"imageinfo","iiprop":"url","iiurlwidth":"1280",
            "titles":"File:"+filename,"format":"json","formatversion":"2"}
    choices=[]
    try:
        response=session.get(api, params=params, timeout=35, headers={**HEADERS,"Accept":"application/json"})
        response.raise_for_status()
        obj=response.json()
        pages=obj.get("query", {}).get("pages", [])
        for page in pages:
            for info in page.get("imageinfo", []):
                if info.get("thumburl"): choices.append(info["thumburl"])
                if info.get("url"): choices.append(info["url"])
    except Exception as exc:
        print(f"{code}: Commons API unavailable, trying official Special:FilePath: {exc!s}",flush=True)
    encoded=quote(filename, safe="")
    choices.extend([
        f"https://commons.wikimedia.org/wiki/Special:FilePath/{encoded}?width=1280",
        f"https://commons.wikimedia.org/wiki/Special:Redirect/file/{encoded}?width=1280",
        f"https://commons.wikimedia.org/wiki/Special:FilePath/{encoded}"
    ])
    last=None
    for candidate in dict.fromkeys(choices):
        for attempt in range(2):
            try:
                resp=session.get(candidate,timeout=55,headers={**HEADERS,"Referer":"https://commons.wikimedia.org/"},stream=True)
                resp.raise_for_status()
                chunks=[]
                total=0
                for chunk in resp.iter_content(chunk_size=131072):
                    total+=len(chunk)
                    if total>MAX_BYTES:raise ValueError("Image too large for safe import")
                    chunks.append(chunk)
                content=b"".join(chunks)
                if len(content)<8000:raise ValueError(f"Suspiciously small response ({len(content)} bytes)")
                photo=Image.open(io.BytesIO(content))
                photo.load()
                if photo.width<500 or photo.height<260:raise ValueError(f"Insufficient resolution: {photo.size}")
                print(f"{code}: true photograph {photo.size} from {resp.url} ({len(content)} bytes)",flush=True)
                return photo.convert("RGB")
            except (requests.RequestException,ValueError,UnidentifiedImageError,OSError) as exc:
                last=exc
                print(f"{code}: retry {attempt+1}, source={candidate[:110]}, error={exc}",flush=True)
                time.sleep(1.5+attempt*2)
    raise RuntimeError(f"Unable to retrieve verified real photograph {code} ({filename}): {last!s}")

def main():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    session=requests.Session()
    for country,name in SOURCES.items():
        path=OUTPUT/f"{country}.webp"
        if path.exists() and path.stat().st_size>12000:
            with Image.open(path) as existing:
                if existing.size==(960,384) and existing.format=="WEBP":
                    print(f"{country}: existing verified self-hosted 960x384 WebP",flush=True)
                    continue
        source=download_image(session,country,name)
        # Image only: crop to the banner ratio; source photos and credit/license remain visible.
        cropped=ImageOps.fit(source,(960,384),method=Image.Resampling.LANCZOS,centering=(0.5,0.5))
        cropped.save(path,format="WEBP",quality=83,method=6,exif=b"")
        if path.stat().st_size<12000:raise RuntimeError(f"Unexpectedly small WebP {path}")
        print(f"READY {country} {path} {path.stat().st_size} bytes",flush=True)
        time.sleep(0.4)
    results={}
    for country in SOURCES:
        with Image.open(OUTPUT/f"{country}.webp") as img:
            assert img.format=="WEBP" and img.size==(960,384)
            results[country]=(OUTPUT/f"{country}.webp").stat().st_size
    print("EIGHT_REAL_COUNTRY_PHOTOS_READY",results,flush=True)

if __name__=="__main__":
    main()
