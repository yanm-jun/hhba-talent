import importlib.util
import json
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("release", Path(__file__).with_name("cloudflare-pages-build.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

class ReleaseHealthTests(unittest.TestCase):
    def setUp(self):
        self.report = dict(status="PARTIAL", model_catalog="MODEL_LISTED",
                           responses="AI_PROVIDER_UPSTREAM_ERROR",
                           web_search="AI_PROVIDER_UPSTREAM_ERROR",
                           native_stream="FINAL_RESPONSE_OK", format="NOT_TESTED",
                           model_job_rows=0)
    def test_observed_outage_is_degraded_not_passed(self):
        self.assertTrue(release.external_health_degraded(self.report))
        result = subprocess.CompletedProcess(["node"], 1, stdout="HHBA_V4_LIVE_SMOKE="+json.dumps(self.report)+"\n")
        with patch.object(release.subprocess, "run", return_value=result):
            release.live_match_health(allow_transient_outage=True)
            with self.assertRaises(subprocess.CalledProcessError):
                release.live_match_health(allow_transient_outage=False)
    def test_unknown_and_contract_errors_remain_blocking(self):
        for change in [
            dict(model_catalog="MODEL_NOT_LISTED"), dict(responses="AI_PROVIDER_AUTH_FAILED"),
            dict(web_search="TOOL_NOT_CALLED"), dict(native_stream="UNEXPECTED"),
            dict(web_search="TOOL_CALLED", format="JSON_INVALID"),
            dict(web_search="TOOL_CALLED", format="JSON_OK", model_job_rows=0),
        ]:
            self.assertFalse(release.external_health_degraded({**self.report, **change}))
    def test_missing_report_remains_blocking(self):
        result = subprocess.CompletedProcess(["node"], 1, stdout="unexpected crash\n")
        with patch.object(release.subprocess, "run", return_value=result):
            with self.assertRaises(subprocess.CalledProcessError):
                release.live_match_health(allow_transient_outage=True)

if __name__ == "__main__":
    unittest.main()
