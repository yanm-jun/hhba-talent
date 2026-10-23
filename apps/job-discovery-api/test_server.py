import json
import tempfile
import unittest
from pathlib import Path
from importlib.machinery import SourceFileLoader
from unittest.mock import patch

service=SourceFileLoader("hhba_job_discovery",str(Path(__file__).with_name("server.py"))).load_module()

class JobDiscoveryTests(unittest.TestCase):
    def test_catalog_uses_official_enterprise_channels(self):
        rows=service.official_catalog()
        self.assertGreaterEqual(len(rows),70)
        self.assertTrue(all(c["careers"].startswith("https://") for c in rows))
    def test_untrusted_body_requires_explicit_consent(self):
        self.assertEqual(service.validate({"query":"本科，销售经验两年，想去上海","consent":True}),
                         "本科，销售经验两年，想去上海")
        for payload in ({"query":"本科求职"},{"query":"本科求职","consent":False},
                        {"query":"本科求职","consent":True,"company":"invented"}):
            with self.assertRaises(ValueError):service.validate(payload)
    def test_url_only_official_host(self):
        c=service.official_catalog()[0]
        self.assertTrue(service.safe_official(c["careers"],c))
        self.assertFalse(service.safe_official("https://malicious.invalid/apply",c))
        self.assertFalse(service.safe_official("https://"+c["host"]+".evil.invalid/apply",c))
        self.assertFalse(service.safe_official("http://"+c["host"]+"/apply",c))
        self.assertFalse(service.safe_official("https://user:secret@"+c["host"]+"/apply",c))
    def test_model_extraction_must_quote_exact_source(self):
        c=service.official_catalog()[0]
        page="XX 某企业正在招聘 销售运营专员。岗位职责包括日常销售支持与数据整理。\n"+("招聘职位说明和能力要求。"*30)
        with patch.object(service,"api_post",return_value={"choices":[{"message":{"content":json.dumps(
          {"title":"凭空杜撰岗位","quote":"销售支持与数据整理"})}}]}):
            self.assertIsNone(service.extract_role(c,c["careers"],page,"测试"))
        with patch.object(service,"api_post",return_value={"choices":[{"message":{"content":json.dumps(
          {"title":"销售运营专员","quote":"岗位职责包括日常销售支持与数据整理"})}}]}):
            result=service.extract_role(c,c["careers"],page,"测试")
            self.assertEqual(result["status"],"OFFICIAL_PAGE_FOUND_STATUS_UNVERIFIED")
    def test_disabled_without_secret_and_persistent_quota(self):
        with patch.dict(service.os.environ,{"HHBA_JOB_DISCOVERY_ENABLED":"1","DEEPSEEK_API_KEY":"fake",
                        "HHBA_JOB_DISCOVERY_QUOTA_DB":"","HHBA_JOB_DISCOVERY_RATE_SECRET":""}):
            self.assertFalse(service.enabled())
    def test_atomic_client_and_total_daily_caps(self):
        with tempfile.TemporaryDirectory() as path:
            with patch.dict(service.os.environ,{"HHBA_JOB_DISCOVERY_QUOTA_DB":str(Path(path)/"q.sqlite3"),
                "HHBA_JOB_DISCOVERY_RATE_SECRET":"a"*45,"HHBA_JOB_DISCOVERY_DAILY_LIMIT":"2",
                "HHBA_JOB_DISCOVERY_CLIENT_LIMIT":"1"}):
                self.assertIsNone(service.quota("a"))
                self.assertEqual(service.quota("a"),"DAILY_LIMIT")
                self.assertIsNone(service.quota("b"))
                self.assertEqual(service.quota("c"),"DAILY_LIMIT")

if __name__=="__main__":unittest.main()
