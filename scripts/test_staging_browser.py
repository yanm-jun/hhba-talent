"""Real Chromium smoke of HHBA's compiled dual-entry website through gateway.

Upstream jobs are synthetic fixtures; this validates product wiring, NOT live ATS availability.
"""
from __future__ import annotations
import json
import os
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import sync_playwright
from scripts.run_staging_gateway import make_handler

_ROOT=Path(__file__).resolve().parents[1]
_DIST=_ROOT/"apps"/"web"/"dist"


class TalentStub(BaseHTTPRequestHandler):
    protocol_version="HTTP/1.1"
    def do_GET(self):
        body=json.dumps({"detail":"synthetic not signed in"}).encode()
        self.send_response(401)
        self.send_header("Content-Type","application/json")
        self.send_header("Content-Length",str(len(body)))
        self.end_headers();self.wfile.write(body)
    def log_message(self,*_): pass


class RecruitmentStub(BaseHTTPRequestHandler):
    protocol_version="HTTP/1.1"
    visits=[]
    def do_GET(self):
        self.__class__.visits.append((self.path,dict(self.headers)))
        sample={
           "job_id":"JOB-SYNTH-001","record_kind":"HISTORICAL_MASTER",
           "job_title":"合成测试岗位（仅自动化验收）",
           "company_display_name":"合成测试企业",
           "source_id":"SRC-SYNTHETIC","work_city":"广州",
           "primary_recruitment_type":"CAMPUS",
           "official_detail_url":"https://example.org/synthetic-only",
           "last_verified_at":"2026-10-16",
           "published_at":None,"education_min":"本科","salary_display":"未公开",
           "job_status":"UNKNOWN","application_access_status":"NOT_OBSERVED",
           "marketplace_status":"OFFICIAL_HISTORICAL_UNCONFIRMED",
           "current_application_verified":False,"source_platform":"Synthetic ATS"
        }
        if self.path.startswith("/api/v1/marketplace"):
            # Social filter returns a SYNTHETIC reviewed application-link fixture.
            # Other filters keep the normal unverified historical record.
            approved="recruitment_type=SOCIAL" in self.path
            if "recruitment_type=INTERNSHIP" in self.path:
                sample={**sample,
                    "job_title":"合成小米实习测试岗位（不是实际招聘）",
                    "primary_recruitment_type":"INTERNSHIP",
                    "record_kind":"OFFICIAL_LIST_OBSERVED",
                    "marketplace_status":"OFFICIAL_LIST_UNCONFIRMED",
                    "official_detail_url":None,
                    "official_list_url":"https://xiaomi.jobs.f.mioffice.cn/internship/",
                    "current_application_verified":False,
                    "application_url":None,
                    "application_link_status":"UNAVAILABLE",
                }
            if approved:
                sample={**sample,
                    "primary_recruitment_type":"SOCIAL",
                    "application_link_status":"VERIFIED_DIRECT",
                    "application_url":"https://example.org/synthetic-only",
                    "current_application_verified":True,
                    "application_verified_at":"2026-10-16T07:00:00+00:00",
                }
            data={"data_mode":"official_source_historical_not_live",
                  "all_current_application_statuses_unverified":not approved,
                  "total":1,"items":[sample]}
            # Source-bound synthetic fixture must not pretend a Guangzhou job
            # matches a genuine user-selected Jinan city filter.
            city_filter=parse_qs(urlsplit(self.path).query).get("city",[""])[0]
            if city_filter and city_filter not in sample.get("work_city",""):
                data={"data_mode":"official_source_historical_not_live",
                      "all_current_application_statuses_unverified":not approved,
                      "total":0,"items":[]}
        elif self.path=="/api/v1/jobs/JOB-SYNTH-001":
            data=sample
        elif self.path.startswith("/api/v1/jobs"):
            data={"total":1,"items":[sample],"limit":12,"offset":0}
        else:
            data={"error":"unknown synthetic route"}
        payload=json.dumps(data,ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("Content-Type","application/json")
        self.send_header("Content-Length",str(len(payload)))
        self.end_headers();self.wfile.write(payload)
    def log_message(self,*_): pass


class BrowserIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (_DIST/"index.html").exists():
            raise RuntimeError("Run npm build before Chromium tests")
        cls.talent=ThreadingHTTPServer(("127.0.0.1",0),TalentStub)
        cls.jobs=ThreadingHTTPServer(("127.0.0.1",0),RecruitmentStub)
        cls.gateway=ThreadingHTTPServer(("127.0.0.1",0),make_handler(
            _DIST,cls.talent.server_address,cls.jobs.server_address))
        cls.workers=[]
        for srv in (cls.talent,cls.jobs,cls.gateway):
            thread=threading.Thread(target=srv.serve_forever,daemon=True)
            thread.start();cls.workers.append(thread)
        cls.base=f"http://127.0.0.1:{cls.gateway.server_port}"
        cls.p=sync_playwright().start()
        cls.browser=cls.p.chromium.launch(headless=True)
        cls.out=Path(os.environ.get("RUNNER_TEMP",tempfile.gettempdir()))/"hhba-v04-ui"
        cls.out.mkdir(parents=True,exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.p.stop()
        for srv,worker in zip((cls.talent,cls.jobs,cls.gateway),cls.workers):
            srv.shutdown();worker.join(timeout=5);srv.server_close()

    def page(self, width=1440, height=900):
        p=self.browser.new_page(viewport={"width":width,"height":height},
                                device_scale_factor=1)
        def gate(route):
            if route.request.url.startswith(self.base+"/"):
                route.continue_()
            else:
                route.abort("blockedbyclient")
        p.route("**/*",gate)
        return p

    def test_home_two_roles_above_real_api_market_and_navigation(self):
        page=self.page()
        try:
            page.goto(self.base+"/",wait_until="domcontentloaded")
            roles=page.locator(".entry-card")
            roles.first.wait_for(state="visible",timeout=12000)
            self.assertEqual(roles.count(),2)
            self.assertIn("我要应聘",roles.nth(0).inner_text())
            self.assertIn("我要招人",roles.nth(1).inner_text())
            page.locator(".market-card").first.wait_for(timeout=12000)
            self.assertIn("合成测试岗位",page.locator(".market-card").first.inner_text())
            self.assertIn("当前投递待核实",page.locator(".market-card").first.inner_text())
            self.assertFalse(page.locator("body").evaluate("(e)=>e.scrollWidth>innerWidth+3"))
            a=page.locator(".market-card").first
            self.assertGreaterEqual(a.locator("a[href^='/candidate/jobs/']").count(),1)
            market_top=page.locator("#recruitment-marketplace").evaluate("(e)=>e.getBoundingClientRect().top+scrollY")
            roles_end=roles.last.evaluate("(e)=>e.getBoundingClientRect().bottom+scrollY")
            self.assertGreater(market_top,roles_end)
            page.screenshot(path=str(self.out/"v04-desktop-home.png"),full_page=True)
            page.get_by_role("button",name="我要招人").click()
            self.assertTrue(page.url.endswith("/recruiter/register"))
            page.get_by_role("link",name="HHBA.").click()
            page.get_by_role("button",name="我要应聘").click()
            self.assertTrue(page.url.endswith("/candidate/jobs"))
            page.get_by_text("合成测试岗位（仅自动化验收）").first.wait_for(timeout=12000)
            page.get_by_text("合成测试岗位（仅自动化验收）").first.click()
            self.assertTrue(page.url.endswith("/candidate/jobs/JOB-SYNTH-001"))
            self.assertIn("历史",page.locator("body").inner_text())
        finally:page.close()

    def test_mobile_home_market_search_filter_and_no_leaked_tokens(self):
        page=self.page(width=390,height=844)
        try:
            page.goto(self.base+"/",wait_until="domcontentloaded")
            page.locator(".market-card").first.wait_for(timeout=12000)
            self.assertFalse(page.evaluate("document.documentElement.scrollWidth > innerWidth + 2"))
            page.screenshot(path=str(self.out/"v04-mobile-home.png"),full_page=True)
            # The new filter is a real, navigable three-level source directory.
            page.locator(".hhba-filter-pill").first.click()
            self.assertTrue(page.locator(".hhba-filter-cascade select").first.is_visible())
            page.locator(".hhba-filter-cascade select").first.select_option(label="山东省")
            self.assertTrue(page.locator(".hhba-filter-cascade select").nth(1).locator("option",has_text="济南市").count()>0)
            self.assertFalse(page.evaluate("document.documentElement.scrollWidth > innerWidth + 2"))
            # Return to all regions before testing the API fixture.
            page.get_by_role("button",name="不限地区").click()
            page.locator(".hhba-filter-pill").nth(1).click()
            self.assertTrue(page.get_by_text("全部销售岗位 →").is_visible())
            page.get_by_role("button",name="不限职位").click()
            page.locator(".hhba-filter-keyword input").fill("合成测试岗位")
            page.locator(".hhba-filter-keyword button").click()
            page.locator(".market-card").first.wait_for()
            page.locator(".hhba-filter-select select").nth(0).select_option("SOCIAL")
            page.locator(".market-card").first.wait_for()
            self.assertEqual(page.locator(".hhba-filter-select select").nth(0).input_value(),"SOCIAL")
            link=page.get_by_role("link",name="去官方投递 ↗")
            link.wait_for(state="visible",timeout=12000)
            self.assertEqual(link.get_attribute("href"),"https://example.org/synthetic-only")
            self.assertEqual(link.get_attribute("rel"),"noopener noreferrer")
            self.assertFalse(page.locator(".market-card").first.get_by_text("当前投递待核实").count())
            page.locator(".hhba-filter-select select").nth(0).select_option("CAMPUS")
            page.get_by_text("当前投递待核实").first.wait_for()
            self.assertEqual(page.get_by_role("link",name="去官方投递 ↗").count(),0)
            page.locator(".hhba-filter-select select").nth(0).select_option("INTERNSHIP")
            page.get_by_text("官方真实岗位列表已采集").first.wait_for(timeout=12000)
            listing=page.get_by_role("link",name="查看企业招聘频道 · 非岗位直达 ↗")
            self.assertEqual(listing.get_attribute("href"),
                             "https://xiaomi.jobs.f.mioffice.cn/internship/")
            self.assertEqual(page.get_by_role("link",name="去官方投递 ↗").count(),0)
            self.assertTrue(any("recruitment_type=SOCIAL" in p for p,h in RecruitmentStub.visits))
            for path, headers in RecruitmentStub.visits:
                lower={key.lower() for key in headers}
                self.assertNotIn("cookie",lower)
                self.assertNotIn("authorization",lower)
        finally:page.close()

    def test_authorized_device_location_auto_applies_city_filters(self):
        # Deterministic mocked GPS and geocoder: no real user geolocation,
        # no production coordinates, and no fake live ATS evidence.
        ctx=self.browser.new_context(viewport={"width":390,"height":844},
            permissions=["geolocation"],
            geolocation={"latitude":36.65,"longitude":117.12,"accuracy":150})
        page=ctx.new_page()
        seen=[]
        def mock_geo(route):
            seen.append(route.request.url)
            route.fulfill(status=200, content_type="application/json",
                body=json.dumps({"address":{"country_code":"cn","state":"山东省","city":"济南市"}}))
        page.route("**/location/reverse*",mock_geo)
        try:
            page.goto(self.base+"/",wait_until="domcontentloaded")
            page.locator(".market-card").first.wait_for(timeout=12000)
            page.get_by_role("button",name="使用当前位置推荐岗位").click()
            page.get_by_text("已定位到山东省 · 济南市",exact=False).wait_for(timeout=14000)
            page.wait_for_function("""() => document.querySelector('.hhba-filter-pill')?.textContent?.includes('济南市')""")
            page.get_by_text("当前没有符合筛选条件的已核对官方岗位记录",exact=False).wait_for(timeout=12000)
            self.assertTrue(seen)
            # Rounded, never raw high precision GPS.
            self.assertIn("lat=36.65",seen[0])
            self.assertIn("lon=117.12",seen[0])
            self.assertTrue(any("country=CN" in path and
                                "city=%E6%B5%8E%E5%8D%97%E5%B8%82" in path
                                for path,headers in RecruitmentStub.visits))
            page.screenshot(path=str(self.out/"v04-mobile-geolocation-filter.png"),full_page=True)
            # Explicit city-only remember option, not silent background tracking.
            page.get_by_label("在本设备保存城市24小时，下次自动筛选").check()
            self.assertTrue(page.evaluate("localStorage.getItem('hhba-recruitment-saved-city-v1') !== null"))
            saved=page.evaluate("localStorage.getItem('hhba-recruitment-saved-city-v1')")
            self.assertNotIn("latitude",saved);self.assertNotIn("longitude",saved)
            page.reload(wait_until="domcontentloaded")
            page.get_by_text("已按上次授权保存的城市筛选",exact=False).wait_for(timeout=10000)
            self.assertIn("济南市",page.locator(".hhba-filter-pill").first.inner_text())
            page.get_by_role("button",name="重置筛选",exact=False).click()
            self.assertIsNone(page.evaluate("localStorage.getItem('hhba-recruitment-saved-city-v1')"))
        finally:
            ctx.close()

    def test_geolocation_denied_does_not_clear_manual_job_search(self):
        ctx=self.browser.new_context(viewport={"width":390,"height":844})
        page=ctx.new_page()
        try:
            page.goto(self.base+"/",wait_until="domcontentloaded")
            page.locator(".market-card").first.wait_for(timeout=12000)
            page.locator(".hhba-filter-keyword input").fill("销售")
            page.locator(".hhba-filter-keyword button").click()
            page.get_by_role("button",name="使用当前位置推荐岗位").click()
            page.get_by_text("你尚未允许定位",exact=False).wait_for(timeout=14000)
            self.assertIn("销售",page.locator(".hhba-filter-keyword input").input_value())
            self.assertFalse(page.evaluate("document.documentElement.scrollWidth > innerWidth + 2"))
        finally:
            ctx.close()


if __name__=="__main__":
    unittest.main()
