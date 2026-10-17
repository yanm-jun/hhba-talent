"""Offline security-contract tests for the loopback ATS staging preview.

All records here are explicitly synthetic unit fixtures; they are never used
for screenshots or represented as live jobs. Live UI acceptance is separate.
"""
from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from scripts.real_ats_preview import load_staged_ats, load_domestic_api, create_handler

BOARDS = [
    ("ATS-GH-TEST", "GH-TEST", "greenhouse", "Test Greenhouse", "https://job-boards.greenhouse.io/test-greenhouse", "https://job-boards.greenhouse.io/test-greenhouse/jobs/123/test"),
    ("ATS-ASH-TEST", "ASH-TEST", "ashby", "Test Ashby", "https://jobs.ashbyhq.com/test-ashby", "https://jobs.ashbyhq.com/test-ashby/uuid-123"),
    ("ATS-LEV-TEST", "LEV-TEST", "lever", "Test Lever", "https://jobs.lever.co/test-lever", "https://jobs.lever.co/test-lever/123"),
]


class StagingPreviewContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.rows = []
        for i, (sid, company_id, platform, company, evidence, detail) in enumerate(BOARDS):
            observed = datetime.now(timezone.utc).isoformat()
            row = {
                "job_id": "ATS-" + ("%024x" % (i + 1)),
                "company_id": company_id,
                "source_id": sid,
                "company_display_name": company,
                "source_platform": platform.upper(),
                "job_title": "Unit fixture role " + str(i + 1),
                "job_source_url": detail,
                "job_status": "UNKNOWN",
                "current_application_verified": False,
                "rights_status": "RIGHTS_REVIEW_REQUIRED",
                "primary_recruitment_type": "UNKNOWN",
                "work_city": "Unit fixture location",
                "last_verified_at": observed,
                "first_seen_at": observed,
            }
            self._write_source(sid, company_id, platform, evidence, observed, [row])
            self.rows.append(row)

    def tearDown(self):
        self.tmp.cleanup()

    def _write_source(self, sid, company_id, platform, evidence, observed, rows):
        payload = "".join(json.dumps(row, sort_keys=True, ensure_ascii=False) + "\n" for row in rows).encode()
        (self.root / (sid + ".jsonl")).write_bytes(payload)
        manifest = {
            "source_id": sid,
            "company_id": company_id,
            "platform": platform,
            "source_evidence_url": evidence,
            "observed_at": observed,
            "snapshot_complete": True,
            "indexed_rows": len(rows),
            "sha256": sha256(payload).hexdigest(),
            "publication_approved": False,
            "JD_republication_approved": False,
        }
        (self.root / (sid + ".manifest.json")).write_text(json.dumps(manifest), encoding="utf-8")

    def test_loads_three_platforms_as_unapproved_staging_only(self):
        rows, sources = load_staged_ats(self.root)
        self.assertEqual(len(rows), 3)
        self.assertEqual({source["platform"] for source in sources}, {"GREENHOUSE", "ASHBY", "LEVER"})
        for row in rows:
            self.assertEqual(row["record_kind"], "ATS_STAGING_PREVIEW")
            self.assertEqual(row["marketplace_status"], "STAGING_SOURCE_REVIEW_REQUIRED")
            self.assertEqual(row["source_review_status"], "NOT_APPROVED_FOR_PUBLICATION")
            self.assertIsNone(row["application_url"])
            self.assertFalse(row["current_application_verified"])

    def test_rejects_tampered_snapshot_hash(self):
        path = self.root / (BOARDS[0][0] + ".jsonl")
        path.write_bytes(path.read_bytes() + b" ")
        with self.assertRaises(ValueError):
            load_staged_ats(self.root)

    def test_rejects_raw_jd_even_with_a_matching_hash(self):
        sid, company_id, platform, company, evidence, detail = BOARDS[0]
        observed = datetime.now(timezone.utc).isoformat()
        bad = self.rows[0] | {"descriptionPlain": "raw JD must never be exposed"}
        self._write_source(sid, company_id, platform, evidence, observed, [bad])
        with self.assertRaisesRegex(ValueError, "unsafe/non-metadata"):
            load_staged_ats(self.root)

    def test_rejects_https_url_from_wrong_board(self):
        sid, company_id, platform, company, evidence, detail = BOARDS[1]
        observed = datetime.now(timezone.utc).isoformat()
        bad = self.rows[1] | {"job_source_url": "https://jobs.ashbyhq.com/another-company/uuid"}
        self._write_source(sid, company_id, platform, evidence, observed, [bad])
        with self.assertRaisesRegex(ValueError, "official ATS board"):
            load_staged_ats(self.root)


    def test_loopback_domestic_api_and_ats_share_one_marketplace(self):
        domestic = {
            "job_id": "JOB-DOM-001", "company_display_name": "国内测试来源公司",
            "job_title": "国内官方岗位（单测夹具）", "source_id": "SRC-DOM-001",
            "source_platform": "Moka", "work_city": "上海",
            "record_kind": "HISTORICAL_MASTER",
            "marketplace_status": "OFFICIAL_HISTORICAL_UNCONFIRMED",
            "official_detail_url": "https://jobs.example.org/domestic/1",
            "official_list_url": None, "application_url": None,
            "application_link_status": "OFFICIAL_DETAIL_ONLY",
            "current_application_verified": False,
        }
        class DomesticHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                raw = json.dumps({"total": 1, "items": [domestic]}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
            def log_message(self, *_): pass
        server = ThreadingHTTPServer(("127.0.0.1", 0), DomesticHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            origin = f"http://127.0.0.1:{server.server_address[1]}"
            domestic_rows = load_domestic_api(origin)
            ats_rows, sources = load_staged_ats(self.root)
            combined = domestic_rows + ats_rows
            stats = {"domestic_public_rows": len(domestic_rows),
                     "ats_staging_rows": len(ats_rows), "total_rows": len(combined),
                     "sources": sources}
            api = ThreadingHTTPServer(("127.0.0.1", 0), create_handler(combined, stats))
            api_thread = threading.Thread(target=api.serve_forever, daemon=True)
            api_thread.start()
            try:
                with urlopen(f"http://127.0.0.1:{api.server_address[1]}/api/v1/marketplace?limit=8") as response:
                    result = json.load(response)
                self.assertEqual(result["total"], 4)
                self.assertEqual({row["record_kind"] for row in result["items"]},
                                 {"HISTORICAL_MASTER", "ATS_STAGING_PREVIEW"})
                self.assertTrue(result["all_current_application_statuses_unverified"])
                self.assertEqual(result["data_mode"], "official_source_staging_only")
            finally:
                api.shutdown()
                api_thread.join(timeout=3)
                api.server_close()
        finally:
            server.shutdown()
            thread.join(timeout=3)
            server.server_close()

    def test_api_exposes_only_whitelisted_staging_metadata(self):
        rows, sources = load_staged_ats(self.root)
        stats = {"domestic_public_rows": 0, "ats_staging_rows": len(rows),
                 "total_rows": len(rows), "sources": sources}
        server = ThreadingHTTPServer(("127.0.0.1", 0), create_handler(rows, stats))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f"http://127.0.0.1:{server.server_address[1]}"
            with urlopen(base + "/api/v1/marketplace?limit=8", timeout=3) as response:
                data = json.load(response)
            self.assertEqual(data["data_mode"], "official_source_staging_only")
            self.assertTrue(data["all_current_application_statuses_unverified"])
            self.assertEqual(len(data["items"]), 3)
            payload = json.dumps(data, ensure_ascii=False)
            self.assertNotIn("descriptionPlain", payload)
            self.assertNotIn("job_description_raw", payload)
            with self.assertRaises(HTTPError) as err:
                urlopen(Request(base + "/api/v1/jobs", data=b"{}", method="POST"), timeout=3)
            self.assertEqual(err.exception.code, 405)
        finally:
            server.shutdown()
            thread.join(timeout=3)
            server.server_close()


if __name__ == "__main__":
    unittest.main()
