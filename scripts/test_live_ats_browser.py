"""Browser proof against the HHBA recruitment-engine staging API.

This test DOES NOT collect ATS data or create job fixtures. The workflow first
runs hhba-recruitment-engine/scripts/stage_global_ats.py against its six-board
reviewed registry, then serves those real snapshots through the engine's
loopback-only combined domestic + ATS preview. Unreviewed rows stay staging-only.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import tempfile
import unittest
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


class RealATSBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = os.environ.get("HHBA_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
        cls.api = os.environ.get("HHBA_ENGINE_API_URL", "http://127.0.0.1:8765").rstrip("/")
        with urlopen(cls.api + "/api/v1/stats", timeout=8) as response:
            cls.stats = json.load(response)
        if cls.stats.get("mode") != "INTERNAL_STAGING_ONLY":
            raise RuntimeError("The HHBA engine must run in explicitly loopback-only staging mode")
        if cls.stats.get("ats_staging_rows", 0) < 6:
            raise RuntimeError("Need real staged ATS records; synthetic fallback is forbidden")
        sources = cls.stats.get("sources", [])
        platforms = {source.get("platform") for source in sources}
        if not {"GREENHOUSE", "ASHBY", "LEVER"} <= platforms:
            raise RuntimeError("Missing a real ATS platform; synthetic fallback is forbidden")
        if any(source.get("source_identity_and_rights_reviewed") is not False for source in sources):
            raise RuntimeError("Unreviewed source must remain visibly marked as staging-only")
        with urlopen(cls.api + "/api/v1/marketplace?limit=8", timeout=8) as response:
            cls.first = json.load(response)
        if cls.first.get("data_mode") != "official_source_staging_only":
            raise RuntimeError("API is not reporting internal staging mode")
        if cls.first.get("all_current_application_statuses_unverified") is not True:
            raise RuntimeError("Staging must never claim application status was verified")
        if len(cls.first.get("items", [])) != 8:
            raise RuntimeError("Unified marketplace API returned incomplete first page")
        cls.out = Path(os.environ.get("RUNNER_TEMP", tempfile.gettempdir())) / "hhba-real-ats-frontend"
        cls.out.mkdir(parents=True, exist_ok=True)
        cls.runner = sync_playwright().start()
        cls.browser = cls.runner.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.runner.stop()

    def page(self, width: int, height: int):
        page = self.browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
        # Browser may access only the HHBA front end. Its /recruitment/api path
        # is reverse-proxied to the actual engine on loopback; external hosts are blocked.
        def route(request):
            if request.request.url.startswith(self.base + "/"):
                request.continue_()
            else:
                request.abort("blockedbyclient")
        page.route("**/*", route)
        return page

    def test_actual_engine_adapter_serves_real_ats_without_mock_rows(self):
        self.assertGreaterEqual(self.stats["ats_staging_rows"], 6)
        self.assertEqual(self.stats["total_rows"],
                         self.stats["ats_staging_rows"] + self.stats["domestic_public_rows"])
        self.assertFalse(any(item.get("current_application_verified") for item in self.first["items"]))
        for item in self.first["items"]:
            self.assertNotIn("descriptionPlain", item)
            self.assertNotIn("job_description_raw", item)
            if item["record_kind"] == "ATS_STAGING_PREVIEW":
                self.assertEqual(item["marketplace_status"], "STAGING_SOURCE_REVIEW_REQUIRED")
                self.assertEqual(item["source_review_status"], "NOT_APPROVED_FOR_PUBLICATION")
                self.assertIsNone(item["application_url"])
                self.assertTrue(item["official_detail_url"].startswith("https://"))

    def test_real_desktop_home_and_single_market(self):
        page = self.page(1440, 900)
        try:
            page.goto(self.base + "/", wait_until="domcontentloaded")
            page.locator(".market-card").first.wait_for(timeout=18000)
            self.assertEqual(page.locator(".entry-card").count(), 2)
            self.assertIn("我要找工作", page.locator(".entry-card").first.inner_text())
            self.assertIn("我要招人才", page.locator(".entry-card").last.inner_text())
            self.assertIn("统一招聘市场", page.locator("#marketplace-title").inner_text())
            self.assertTrue(page.locator(".market-staging-notice").is_visible())
            self.assertFalse(page.evaluate("document.documentElement.scrollWidth>innerWidth+2"))
            actual = page.locator(".market-card h3").all_inner_texts()
            expected = [str(item.get("job_title") or "") for item in self.first["items"]]
            self.assertEqual(actual, expected)
            self.assertEqual(page.locator("a.market-verified-apply").count(), 0)
            page.screenshot(path=str(self.out / "hhba-real-desktop-first.png"))
            page.screenshot(path=str(self.out / "hhba-real-desktop-full.png"), full_page=True)
            page.get_by_role("button", name="我要找工作").click()
            self.assertTrue(page.url.endswith("/candidate/jobs"))
            page.locator(".hhba-position-card").first.wait_for(timeout=12000)
            page.screenshot(path=str(self.out / "hhba-real-desktop-search.png"), full_page=True)
        finally:
            page.close()

    def test_real_mobile_search_and_staging_detail(self):
        page = self.page(390, 844)
        try:
            page.goto(self.base + "/", wait_until="domcontentloaded")
            page.locator(".market-card").first.wait_for(timeout=18000)
            self.assertFalse(page.evaluate("document.documentElement.scrollWidth>innerWidth+2"))
            page.screenshot(path=str(self.out / "hhba-real-mobile-full.png"), full_page=True)
            # Search a real board's company as returned by the engine source registry.
            source = next(item for item in self.stats["sources"] if item["platform"] == "ASHBY")
            company = source["company"]
            page.locator("#market-q").fill(company)
            page.locator(".market-search button").click()
            page.locator(".market-card").first.wait_for(timeout=12000)
            cards = page.locator(".market-card").all_inner_texts()
            self.assertTrue(cards)
            self.assertTrue(any(company in card for card in cards))
            page.screenshot(path=str(self.out / "hhba-real-mobile-filtered.png"), full_page=True)
            # Open the actual detail record; internal preview must be labelled.
            page.locator(".market-card h3 a").first.click()
            page.get_by_text("INTERNAL STAGING", exact=False).wait_for(timeout=10000)
            self.assertIn("不得将此预览直接作为公网正式内容", page.locator(".hhba-jobs-hero").inner_text())
        finally:
            page.close()


if __name__ == "__main__":
    unittest.main()
