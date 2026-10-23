import json
import unittest
from importlib.machinery import SourceFileLoader
from pathlib import Path

match = SourceFileLoader("hhba_company_match", str(Path(__file__).with_name("server.py"))).load_module()


class TestCompanyMatch(unittest.TestCase):
    def setUp(self):
        self.companies = [{"id": "company_01", "name": "已核验企业", "industry": "制造业", "overview": "公开的企业基本介绍"}]

    def test_valid_intent(self):
        query, rows = match.validate({"query": "本科，有汽车销售经历，想做运营", "consent": True, "companies": self.companies})
        self.assertEqual(len(rows), 1)
        self.assertIn("本科", query)

    def test_requires_consent(self):
        with self.assertRaisesRegex(ValueError, "CONSENT_REQUIRED"):
            match.validate({"query": "本科求职", "companies": self.companies})

    def test_reject_duplicate_company(self):
        with self.assertRaisesRegex(ValueError, "INVALID_COMPANY_ID"):
            match.validate({"query": "本科求职", "consent": True, "companies": self.companies * 2})

    def test_output_must_belong_to_candidate_list(self):
        output = match.clean_recommendations(json.dumps({"recommendations": [
            {"id": "fabricated", "reason": "我编的匹配理由", "directions": []},
            {"id": "company_01", "reason": "相关行业业务方向可进一步了解", "directions": ["渠道运营"]},
        ]}), self.companies)
        self.assertEqual([x["id"] for x in output], ["company_01"])

    def test_invalid_model_json_rejected(self):
        with self.assertRaisesRegex(ValueError, "INVALID_MODEL_JSON"):
            match.clean_recommendations("not json", self.companies)

    def test_disabled_by_default(self):
        from unittest.mock import patch
        with patch.dict(match.os.environ, {"HHBA_COMPANY_MATCH_ENABLED": "0", "DEEPSEEK_API_KEY": "example"}):
            self.assertFalse(match.enabled())


if __name__ == "__main__":
    unittest.main()
