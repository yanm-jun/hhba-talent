#!/usr/bin/env python3
"""Import the user's existing 312-photo research ZIP as clearly labelled PREVIEW-ONLY stock references.

The output is deliberately separate from the manually approved 19-photo manifest.
No Wikimedia photograph is represented as the named employer's real premises.
"""
import csv
import hashlib
import io
import json
import re
import sys
import zipfile
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "src/data/domesticAutumnImageProductionQueue20261029.json"
DEST = ROOT / "public/images/autumn-photo-research"
MANIFEST = ROOT / "public/data/domestic-autumn-photo-research.json"

def main(archive):
    queue = json.loads(QUEUE.read_text(encoding="utf-8"))["entries"]
    if len(queue) != 156:
        raise ValueError("Expected the original 156 employer IDs")
    image_entries = {}
    hashes = set()
    total = 0
    DEST.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as outer:
        names = outer.namelist()
        inner = next((n for n in names if n.endswith(".zip")), None)
        if inner and "PHOTO_SOURCES_AND_LICENSES.csv" not in names:
            source = zipfile.ZipFile(io.BytesIO(outer.read(inner)))
        else:
            source = outer
        with source:
            records = list(csv.DictReader(io.StringIO(source.read("PHOTO_SOURCES_AND_LICENSES.csv").decode("utf-8-sig"))))
            lookup = {(r["employer_id"],r["image_id"]):r for r in records}
            if len(records) != 312 or len(lookup) != 312:
                raise ValueError("Research ZIP must have 312 distinct provenance rows")
            for employer in queue:
                employer_id = employer["employerId"]
                employer_name = employer["employerName"]
                category = employer["categoryHint"]
                picks = []
                for slot_number,slot in enumerate(employer["slots"],1):
                    photo_id = slot["photoId"]
                    row = lookup.get((employer_id, photo_id))
                    if not row or row["employer_name"] != employer_name:
                        raise ValueError("Missing or mismatched employer photo source: " + employer_id)
                    photo_path = row["path"]
                    if not re.fullmatch(re.escape(employer_id)+r"/"+re.escape(photo_id)+r"\\.jpg",photo_path):
                        raise ValueError("Unexpected ZIP path " + photo_path)
                    data = source.read(photo_path)
                    if len(data)<7000 or data[:2]!=b"\\xff\\xd8":
                        raise ValueError("Invalid independent JPEG " + photo_path)
                    digest = hashlib.sha256(data).hexdigest()
                    if digest in hashes:
                        raise ValueError("Duplicate photo " + photo_path)
                    hashes.add(digest)
                    page = row["source_page"]
                    if not page.startswith("https://commons.wikimedia.org/wiki/File:"):
                        raise ValueError("Non-Wikimedia image: "+page)
                    license_name = row["license"]
                    if not any(s in license_name.lower() for s in ("cc", "public domain")):
                        raise ValueError("Unrecognized license: "+license_name)
                    path = f"images/autumn-photo-research/{employer_id}-{slot_number:02}.jpg"
                    (ROOT / "public" / path).write_bytes(data)
                    license_url = (
                        "https://creativecommons.org/publicdomain/mark/1.0/" if "public domain" in license_name.lower()
                        else "https://creativecommons.org/licenses/by-sa/4.0/" if "by-sa" in license_name.lower()
                        else "https://creativecommons.org/licenses/by/4.0/" if "by" in license_name.lower()
                        else "https://creativecommons.org/publicdomain/zero/1.0/"
                    )
                    picks.append({
                        "id": photo_id,
                        "companyId": employer_id,
                        "companyName": employer_name,
                        "file": path,
                        "categoryHint": category,
                        "reviewStatus": "research_unreviewed_not_employer_photo",
                        "imageType": "licensed_industry_reference_not_actual_employer",
                        "label": "行业图库参考 · 未逐张核验 · 非该企业实景",
                        "alt": f"{category}行业图库参考照片，未经逐张匹配审核，不是{employer_name}真实环境",
                        "sourceUrl": page,
                        "license": license_name,
                        "licenseUrl": license_url,
                        "author": row["author"] or "见来源页面",
                        "credit": row["credit"],
                        "changes": "原 Wikimedia 参考图片经裁切、缩放为 1200×675",
                        "sha256": digest
                    })
                    total += 1
                image_entries[employer_id] = picks
    if total != 312 or len(image_entries) != 156:
        raise ValueError("Incomplete research archive")
    MANIFEST.write_text(json.dumps({
        "schemaVersion": "1.0",
        "purpose": "Static preview of original 312 individual Wikimedia research photographs, NOT verified corporate photos",
        "reviewStatus": "unreviewed_not_for_company_identity_claims",
        "totalCompanies": 156,
        "totalPhotos": 312,
        "entries": image_entries
    }, ensure_ascii=False, indent=2)+"\\n", encoding="utf-8")
    print("IMPORTED_156_COMPANIES_312_UNIQUE_RESEARCH_PHOTOS",len(image_entries),total)

if __name__=="__main__":
    if len(sys.argv)!=2:
        sys.exit("usage: python materialize-autumn-photo-research.py path/to/artifact.zip")
    main(sys.argv[1])
