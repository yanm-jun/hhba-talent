#!/usr/bin/env python3
"""Build an Access-protected, read-only employer directory from a scoped D1 export.

Only the isolated admin feature preview invokes this. The SQL never enters
public Pages static assets; the generated JS is bundled into a protected
Pages Function after verifyAdmin succeeds.
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

WEB = Path(__file__).resolve().parents[1]
DEST = WEB / "functions/_lib/library-private-snapshot.js"
EXPECTED = {
    "records": 5288,
    "with_urls": 2573,
    "unique_urls": 1900,
    "missing": 2715,
}

def main():
    branch = os.environ.get("CF_PAGES_BRANCH")
    if branch not in ("feat/admin-recruitment-library-20261112","feat/admin-password-console-20261112"):
        raise SystemExit("Private snapshot build is allowed only on isolated authenticated admin branches.")
    if branch == "feat/admin-password-console-20261112" and os.environ.get("CF_PAGES_PROJECT_NAME") != "hhba-admin-console":
        raise SystemExit("Never embed the catalog on the public HHBA project.")
    url = os.environ.get("HHBA_LIBRARY_EXPORT_SNAPSHOT_URL", "").strip()
    if not url.startswith("https://") or "X-Amz-Signature=" not in url or "/d1-sqlio-outgoing-prod/" not in url:
        raise SystemExit("Missing private D1 export snapshot URL for preview build.")
    try:
        req = Request(url, headers={"User-Agent": "HHBA-Private-Admin-Export/1.0"})
        with urlopen(req, timeout=45) as response:
            sql = response.read(25_000_001)
    except Exception as exc:
        raise SystemExit("Private D1 export cannot be downloaded: " + type(exc).__name__) from None
    if not 20_000 < len(sql) < 25_000_001:
        raise SystemExit("Private D1 export is empty or exceeds its safety limit.")
    db = sqlite3.connect(":memory:")
    try:
        db.executescript(sql.decode("utf-8-sig"))
        db.row_factory = sqlite3.Row
        counted = db.execute("""
            SELECT COUNT(*) records,
                   COUNT(recruitment_url) with_urls,
                   COUNT(DISTINCT lower(trim(recruitment_url))) unique_urls,
                   SUM(CASE WHEN recruitment_url IS NULL OR trim(recruitment_url)='' THEN 1 ELSE 0 END) missing
            FROM hhba_industry_employer_links
        """).fetchone()
        actual = dict(counted)
        if actual != EXPECTED:
            raise SystemExit("Private D1 export counts do not match the verified snapshot: " + str(actual))
        rows = [
            list(row)
            for row in db.execute("""
                SELECT source_key, industry_id, enterprise, recruitment_url,
                       source_kind, source_batch, source_sequence, updated_at
                FROM hhba_industry_employer_links
                ORDER BY industry_id, enterprise, source_key
            """)
        ]
    finally:
        db.close()

    # The module remains private, imported only by verifyAdmin-protected GETs.
    data = {
        "exported_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "count": actual,
        "columns": [
            "source_key", "industry_id", "enterprise", "recruitment_url",
            "source_kind", "source_batch", "source_sequence", "updated_at"
        ],
        "rows": rows,
    }
    json_data = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text("export const LIBRARY_PRIVATE_SNAPSHOT = " + json_data + ";\n", encoding="utf-8")
    print(
        "HHBA_PRIVATE_LIBRARY_EXPORT_BUNDLED",
        "rows=" + str(actual["records"]),
        "unique_urls=" + str(actual["unique_urls"]),
        "protected_module_bytes=" + str(DEST.stat().st_size),
        flush=True,
    )


if __name__ == "__main__":
    main()
