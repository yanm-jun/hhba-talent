"""Actual ATS JSON -> actual HHBA React Chromium screenshot smoke.

No synthetic company, job title, location, JD, URL or API response is created.
The talent authentication endpoint alone returns 401 (signed-out session).
Preview is isolated from production and does not confer publication rights.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote
from urllib.request import urlopen

from playwright.sync_api import sync_playwright
from scripts.run_staging_gateway import make_handler
from scripts.real_ats_preview import read_genuine_public_ats, serve, filter_market

ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/"apps/web/dist"


class UnsignedTalentAPI(BaseHTTPRequestHandler):
    def do_GET(self):
        payload=b'{"detail":"not signed in"}'
        self.send_response(401)
        self.send_header("Content-Type","application/json")
        self.send_header("Content-Length",str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
    def log_message(self,*_):pass


class RealATSBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (DIST/"index.html").is_file():
            raise RuntimeError("Build the actual HHBA React app first")
        cls.jobs,cls.source_report=read_genuine_public_ats()
        if len(cls.jobs)<6 or len({j["source_platform"] for j in cls.jobs})!=3:
            raise RuntimeError("Actual ATS data is insufficient: do not insert fake records")
        cls.talent=ThreadingHTTPServer(("127.0.0.1",0),UnsignedTalentAPI)
        port_server=ThreadingHTTPServer(("127.0.0.1",0),BaseHTTPRequestHandler)
        port=port_server.server_port
        port_server.server_close()
        cls.real_thread=threading.Thread(target=serve,args=(cls.jobs,"127.0.0.1",port),daemon=True)
        cls.real_thread.start()
        cls.market_origin=f"http://127.0.0.1:{port}"
        # Never rely on timing alone: check actual HTTP readiness.
        import time
        deadline=time.monotonic()+12
        while True:
            try:
                with urlopen(cls.market_origin+"/api/v1/stats",timeout=1) as reply:
                    assert json.load(reply)["total_jobs"]==len(cls.jobs)
                break
            except (ConnectionError,OSError):
                if time.monotonic()>=deadline:
                    raise RuntimeError("real ATS staging source failed to start")
                time.sleep(.08)
        cls.gateway=ThreadingHTTPServer(("127.0.0.1",0),make_handler(
            DIST,cls.talent.server_address,("127.0.0.1",port)))
        cls.talent_thread=threading.Thread(target=cls.talent.serve_forever,daemon=True)
        cls.gate_thread=threading.Thread(target=cls.gateway.serve_forever,daemon=True)
        cls.talent_thread.start()
        cls.gate_thread.start()
        cls.base=f"http://127.0.0.1:{cls.gateway.server_port}"
        cls.runner=sync_playwright().start()
        cls.browser=cls.runner.chromium.launch(headless=True)
        cls.out=Path(os.environ.get("RUNNER_TEMP",tempfile.gettempdir()))/"hhba-real-ats-frontend"
        cls.out.mkdir(parents=True,exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.runner.stop()
        cls.gateway.shutdown();cls.gateway.server_close()
        cls.talent.shutdown();cls.talent.server_close()
        cls.gate_thread.join(timeout=4)
        cls.talent_thread.join(timeout=4)

    def page(self,width:int,height:int):
        page=self.browser.new_page(viewport={"width":width,"height":height},device_scale_factor=1)
        # Block ALL external network access from Chromium: only our own
        # loopback gateway is allowed, proving cards come from the actual
        # backend, not loading 3rd-party iframes or browser scrape calls.
        def route(request):
            if request.request.url.startswith(self.base+"/"):
                request.continue_()
            else:
                request.abort("blockedbyclient")
        page.route("**/*",route)
        return page

    def test_actual_market_gateway_data_and_filters(self):
        with urlopen(self.base+"/recruitment/api/v1/marketplace?limit=8",timeout=8) as reply:
            first=json.load(reply)
        self.assertEqual(first["total"],len(self.jobs))
        self.assertEqual(first["data_mode"],"official_source_historical_not_live")
        self.assertTrue(first["all_current_application_statuses_unverified"])
        self.assertEqual(len(first["items"]),8)
        for job in first["items"]:
            self.assertEqual(job["application_url"],None)
            self.assertFalse(job["current_application_verified"])
            self.assertTrue(job["official_detail_url"].startswith("https://"))
            self.assertIn(job["job_title"],{j["job_title"] for j in self.jobs})
            self.assertNotIn("descriptionPlain",job)
        original=self.jobs[0]
        with urlopen(self.base+"/recruitment/api/v1/marketplace?q="+quote(original["job_title"])+"&limit=8",timeout=8) as reply:
            filtered=json.load(reply)
        self.assertGreater(filtered["total"],0)
        self.assertTrue(any(j["job_id"]==original["job_id"] for j in filtered["items"]))
        with urlopen(self.base+"/recruitment/api/v1/jobs/"+original["job_id"],timeout=8) as reply:
            self.assertEqual(json.load(reply)["official_detail_url"],original["official_detail_url"])

    def test_real_desktop_home_market_and_official_source_links(self):
        page=self.page(1440,900)
        try:
            page.goto(self.base+"/",wait_until="domcontentloaded")
            page.locator(".market-card").first.wait_for(timeout=18000)
            self.assertEqual(page.locator(".entry-card").count(),2)
            self.assertIn("我要找工作",page.locator(".entry-card").first.inner_text())
            self.assertIn("我要招人才",page.locator(".entry-card").last.inner_text())
            self.assertIn("统一招聘市场",page.locator("#marketplace-title").inner_text())
            self.assertFalse(page.evaluate("document.documentElement.scrollWidth>innerWidth+2"))
            for job in self.jobs[:6]:
                self.assertIn(job["company_display_name"],page.locator(".market-list").inner_text())
            self.assertEqual(page.locator("a.market-verified-apply").count(),0)
            # Every visible card is an actual current API row; non-HTTPS and
            # synthetic placeholder postings never enter this preview.
            expected_ids={x["job_title"] for x in self.jobs[:8]}
            actual_titles=set(page.locator(".market-card h3").all_inner_texts())
            self.assertEqual(actual_titles,expected_ids)
            page.screenshot(path=str(self.out/"hhba-real-desktop-first.png"))
            page.screenshot(path=str(self.out/"hhba-real-desktop-full.png"),full_page=True)
            page.get_by_role("button",name="我要找工作").click()
            self.assertTrue(page.url.endswith("/candidate/jobs"))
            page.locator(".hhba-position-card").first.wait_for(timeout=12000)
            self.assertIn(self.jobs[0]["company_display_name"],page.locator(".hhba-position-card").first.inner_text())
            page.screenshot(path=str(self.out/"hhba-real-desktop-search.png"),full_page=True)
        finally:page.close()

    def test_real_mobile_home_and_filter(self):
        page=self.page(390,844)
        try:
            page.goto(self.base+"/",wait_until="domcontentloaded")
            page.locator(".market-card").first.wait_for(timeout=18000)
            self.assertFalse(page.evaluate("document.documentElement.scrollWidth>innerWidth+2"))
            page.screenshot(path=str(self.out/"hhba-real-mobile-full.png"),full_page=True)
            page.locator("#market-q").fill(self.jobs[0]["company_display_name"])
            page.locator(".market-search button").click()
            page.locator(".market-card").first.wait_for(timeout=12000)
            result=page.locator(".market-card").first.inner_text()
            self.assertIn(self.jobs[0]["company_display_name"],result)
            page.screenshot(path=str(self.out/"hhba-real-mobile-filtered.png"),full_page=True)
        finally:page.close()


if __name__=="__main__":
    unittest.main()
