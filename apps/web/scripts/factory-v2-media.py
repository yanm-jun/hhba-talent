#!/usr/bin/env python3
"""Download three independently sourced company images without per-company workflows.

Usage:
  python scripts/factory-v2-media.py cn-autumn-019
  python scripts/factory-v2-media.py cn-autumn-019 --force

Input is the existing JSON profile's mediaSources {logo, photo1, photo2}
with the canonical media file paths in media.logo and media.photos[].
Images with identity or licensing uncertainty require human review
before their profile can be approved; this script only validates file safety.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import ipaddress
import json
import pathlib
import socket
from urllib.parse import urlsplit
import requests
from PIL import Image,ImageOps,ImageFile

ROOT=pathlib.Path(__file__).resolve().parent.parent
Image.MAX_IMAGE_PIXELS=36_000_000
ImageFile.LOAD_TRUNCATED_IMAGES=False
MAX_DOWNLOAD=16_000_000
session=requests.Session()
session.headers.update({"User-Agent":"Mozilla/5.0 (compatible; HHBAFactoryV2/1.0; public enterprise media research)"})
session.trust_env=False

def approved_host(url:str)->str:
    parsed=urlsplit(url)
    if(parsed.scheme!="https" or not parsed.hostname or parsed.username or parsed.password or parsed.port or parsed.fragment):
        raise ValueError("Source must use ordinary public HTTPS with no credentials, ports, or fragment")
    host=parsed.hostname.lower()
    if host in ("localhost",) or host.endswith((".local",".internal")):
        raise ValueError("Nonpublic media source rejected")
    # Never request loopback, RFC1918, link-local, cloud instance metadata, or other private resources.
    records=socket.getaddrinfo(host,443,proto=socket.IPPROTO_TCP)
    for rec in records:
        ip=ipaddress.ip_address(rec[4][0])
        if not ip.is_global:
            raise ValueError("Nonpublic address blocked for "+host)
    return host

def download(url:str)->bytes:
    approved_host(url)
    # Redirects disabled: prevent a public image URL from redirecting to a private address.
    with session.get(url,timeout=(8,25),stream=True,allow_redirects=False,verify=True) as response:
        response.raise_for_status()
        if 300<=response.status_code<400:
            raise ValueError("Redirect is disallowed; record the final HTTPS media URL instead")
        typ=response.headers.get("content-type","").lower()
        if typ and not typ.startswith("image/") and typ!="application/octet-stream":
            raise ValueError("Not an image content type: "+typ)
        content=bytearray()
        for block in response.iter_content(65536):
            content.extend(block)
            if len(content)>MAX_DOWNLOAD:
                raise ValueError("Image download exceeds "+str(MAX_DOWNLOAD)+" bytes")
        return bytes(content)

def encoded(data:bytes,suffix:str)->tuple[bytes,list[int]]:
    with Image.open(io.BytesIO(data)) as im:
        im.verify()
    with Image.open(io.BytesIO(data)) as im:
        im=ImageOps.exif_transpose(im)
        im.load()
        width,height=im.size
        if width<180 or height<80 or width*height>36_000_000:
            raise ValueError("Unusable image dimensions "+str(im.size))
        im.thumbnail((1800,1200))
        out=io.BytesIO()
        if suffix==".png":
            im.convert("RGBA").save(out,format="PNG",optimize=True)
        elif suffix==".webp":
            im.convert("RGB").save(out,format="WEBP",quality=87,method=6)
        elif suffix in (".jpg",".jpeg"):
            im.convert("RGB").save(out,format="JPEG",quality=90,optimize=True)
        else:
            raise ValueError("Only png/webp/jpeg uploads are supported; never import untrusted SVG scripts")
        return out.getvalue(),[im.width,im.height]

def main()->None:
    ap=argparse.ArgumentParser()
    ap.add_argument("employer_id",help="cn-autumn-019")
    ap.add_argument("--force",action="store_true",help="Replace existing assets after source review")
    args=ap.parse_args()
    import re
    if not re.fullmatch(r"cn-autumn-\d{3}",args.employer_id):
        raise SystemExit("Unsafe company ID")
    path=ROOT/"src/data/employerProfiles"/(args.employer_id+".json")
    p=json.loads(path.read_text(encoding="utf8"))
    if p.get("id")!=args.employer_id:
        raise ValueError("Mismatched company ID")
    source=p.get("mediaSources") or {}
    assets={
        "logo":p["media"]["logo"],
        "photo1":p["media"]["photos"][0]["path"],
        "photo2":p["media"]["photos"][1]["path"],
    }
    if len(set(assets.values()))!=3 or len(set(source.values()))!=3:
        raise ValueError("Exactly three independent local images and independent verified source URLs required")
    manifest={}
    for key,rel in assets.items():
        if not rel.startswith("images/employer-profiles/"+args.employer_id+"/") or ".." in rel:
            raise ValueError("Assets must stay inside the employer's own directory")
        target=(ROOT/"public"/rel).resolve()
        if not target.is_relative_to((ROOT/"public/images/employer-profiles"/args.employer_id).resolve()):
            raise ValueError("Unsafe output path")
        url=source.get(key)
        if not isinstance(url,str):
            raise ValueError("Missing source for "+key)
        approved_host(url)
        if target.exists() and not args.force:
            if not (100<target.stat().st_size<5_000_000):
                raise ValueError("Existing local asset is invalid: "+str(target))
            contents=target.read_bytes()
            with Image.open(io.BytesIO(contents)) as image:
                size=list(image.size)
            manifest[key]={"path":rel,"source":url,"sha256":hashlib.sha256(contents).hexdigest(),"dimensions":size}
            continue
        data=download(url)
        contents,size=encoded(data,target.suffix.lower())
        if not 100<len(contents)<5_000_000:
            raise ValueError("Encoded image size out of range")
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(contents)
        manifest[key]={"path":rel,"source":url,"sha256":hashlib.sha256(contents).hexdigest(),"dimensions":size}
    dest=ROOT/"public/images/employer-profiles"/args.employer_id/"source-manifest-v2.json"
    dest.write_text(json.dumps({"company":p["name"],"employer_id":args.employer_id,"assets":manifest},
        ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print("HHBA_FACTORY_V2_MEDIA_READY",json.dumps(manifest,ensure_ascii=False))

if __name__=="__main__":
    main()
