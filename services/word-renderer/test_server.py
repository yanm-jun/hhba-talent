"""Synthetic-only contract tests. Never process production applicant documents."""
import base64
import http.client
import json
import os
from pathlib import Path
import threading
import unittest
from http.server import ThreadingHTTPServer

import server


class WordPrivateServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixture_dir = Path(os.environ.get("HHBA_WORD_RENDER_QA_OUTPUT", "/tmp/hhba-docx-preserve-ci"))
        cls.original = (fixture_dir / "original-preserved-layout.docx").read_bytes()
        cls.edited = (fixture_dir / "edited-preserved-layout.docx").read_bytes()
        cls.secret = "synthetic-only-private-token-" + "q" * 35
        os.environ["HHBA_WORD_RENDER_SHARED_SECRET"] = cls.secret
        cls.instance = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.thread = threading.Thread(target=cls.instance.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.instance.shutdown()
        cls.instance.server_close()
        cls.thread.join(timeout=5)

    def request(self, path, payload=None, token=None, method="POST"):
        conn = http.client.HTTPConnection("127.0.0.1", self.instance.server_address[1], timeout=80)
        data = json.dumps(payload).encode("utf-8") if payload is not None else b""
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        conn.request(method, path, data if method == "POST" else None, headers)
        response = conn.getresponse()
        raw = response.read()
        status = response.status
        content_type = response.getheader("Content-Type")
        conn.close()
        return status, content_type, raw

    def test_no_anonymous_document_access(self):
        payload = {"original_b64": base64.b64encode(self.original).decode()}
        status, _, _ = self.request("/v1/render", payload)
        self.assertEqual(status, 401)
        status, _, _ = self.request("/v1/render", payload, token="invalid-token")
        self.assertEqual(status, 401)
        status, _, _ = self.request("/unknown", payload, token=self.secret)
        self.assertEqual(status, 404)

    def test_real_original_word_preview_is_a_pdf(self):
        payload = {"original_b64": base64.b64encode(self.original).decode()}
        status, kind, data = self.request("/v1/render", payload, token=self.secret)
        self.assertEqual(status, 200, data[:150])
        self.assertEqual(kind, "application/pdf")
        self.assertTrue(data.startswith(b"%PDF-"))
        self.assertGreater(len(data), 500)

    def test_word_edit_verification_returns_checked_layout_only(self):
        payload = {
            "original_b64": base64.b64encode(self.original).decode(),
            "edited_b64": base64.b64encode(self.edited).decode(),
            "old_text": "原始岗位描述",
            "new_text": "新的岗位描述",
        }
        status, kind, data = self.request("/v1/verify", payload, token=self.secret)
        self.assertEqual(status, 200, data[:500])
        result = json.loads(data)
        self.assertTrue(result["verified"])
        self.assertEqual(result["report"]["page_count"], 1)
        self.assertGreater(result["report"]["changed_pixels"], 5)

        changed = dict(payload)
        changed["new_text"] = "根本没有出现的虚构文字"
        status, _, data = self.request("/v1/verify", changed, token=self.secret)
        self.assertEqual(status, 422, data[:300])
        self.assertFalse(json.loads(data)["ok"])

    def test_reject_invalid_or_active_content(self):
        status, _, data = self.request("/v1/render", {"original_b64": "%%%%"}, token=self.secret)
        self.assertEqual(status, 422)
        self.assertEqual(json.loads(data)["error"], "WORD_INVALID_FILE")


if __name__ == "__main__":
    unittest.main()
