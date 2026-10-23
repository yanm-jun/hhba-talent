"""No network or paid AI calls in the acceptance tests."""
import json
import os
import tempfile
import unittest
from importlib.machinery import SourceFileLoader
from pathlib import Path
from unittest.mock import patch

root = Path(__file__).parent
match = SourceFileLoader("hhba_company_match", str(root / "server.py")).load_module()

class TestCompanyMatch(unittest.TestCase):
    def setUp(self):
        self.companies = match.catalog()
        self.domestic = next(c for c in self.companies if c["provenance"] == "official_recruitment_entry_only")
        self.overseas = next(c for c in self.companies if c["provenance"] == "human_reviewed_editorial")

    def test_curated_catalog_includes_domestic_and_overseas(self):
        self.assertGreaterEqual(len(self.companies), 100)
        self.assertGreaterEqual(sum(c["provenance"]=="official_recruitment_entry_only" for c in self.companies), 80)
        self.assertGreaterEqual(sum(c["provenance"]=="human_reviewed_editorial" for c in self.companies), 45)
        self.assertEqual(len(set(c["id"] for c in self.companies)), len(self.companies))

    def test_web_and_server_catalog_are_identical(self):
        web = json.loads((root.parent / "web/src/data/aiCompanyCatalog.json").read_text(encoding="utf-8"))
        server = json.loads((root / "catalog.json").read_text(encoding="utf-8"))
        self.assertEqual(web, server)

    def test_query_only_no_client_supplied_corporations(self):
        self.assertIn("本科", match.validate({"query": "本科，有汽车销售经历，想做运营", "consent": True}))
        with self.assertRaisesRegex(ValueError, "UNEXPECTED_FIELDS"):
            match.validate({"query": "本科，有汽车销售经历", "consent": True,
                            "companies": [{"id": "fake", "name": "伪造企业"}]})

    def test_consent_required(self):
        with self.assertRaisesRegex(ValueError, "CONSENT_REQUIRED"):
            match.validate({"query": "本科求职"})
        with self.assertRaisesRegex(ValueError, "INVALID_QUERY"):
            match.validate({"query": "  ", "consent": True})

    def test_model_cannot_add_companies_or_active_jobs(self):
        rows = match.clean_recommendations(json.dumps({"recommendations": [
            {"id": "invented", "reason": "捏造企业", "directions": []},
            {"id": self.domestic["id"], "reason": "该企业正在招聘销售专员", "directions": ["销售"]},
            {"id": self.domestic["id"], "reason": "官网有入口", "directions": ["销售"]},
            {"id": self.overseas["id"], "reason": "可关注与过往经历相关的职业方向", "directions": ["运营"]}
        ]}, ensure_ascii=False), self.companies)
        self.assertEqual([r["id"] for r in rows], [self.domestic["id"], self.overseas["id"]])
        self.assertEqual(rows[0]["directions"], [])
        self.assertIn("已登记", self.domestic["overview"])
        self.assertIn("核实", rows[0]["reason"])

    def test_invalid_json_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "INVALID_MODEL_JSON"):
            match.clean_recommendations("invalid json", self.companies)

    def test_disabled_until_key_and_budget_guard(self):
        with patch.dict(os.environ, {"DEEPSEEK_API_KEY": "fake", "HHBA_COMPANY_MATCH_ENABLED": "1",
                                     "HHBA_COMPANY_MATCH_QUOTA_DB": "", "HHBA_COMPANY_MATCH_RATE_SECRET": ""}):
            self.assertFalse(match.enabled())

    def test_persistent_global_and_client_limits(self):
        with tempfile.TemporaryDirectory() as d:
            env = {"HHBA_COMPANY_MATCH_QUOTA_DB": str(Path(d)/"quota.sqlite3"),
                   "HHBA_COMPANY_MATCH_RATE_SECRET": "a"*40,
                   "HHBA_COMPANY_MATCH_DAILY_LIMIT": "3",
                   "HHBA_COMPANY_MATCH_CLIENT_DAILY_LIMIT": "2"}
            with patch.dict(os.environ, env):
                self.assertIsNone(match.reserve("client1"))
                self.assertIsNone(match.reserve("client1"))
                self.assertEqual(match.reserve("client1"), "DAILY_LIMIT")
                self.assertIsNone(match.reserve("client2"))
                self.assertEqual(match.reserve("client3"), "DAILY_LIMIT")

if __name__ == "__main__":
    unittest.main()
