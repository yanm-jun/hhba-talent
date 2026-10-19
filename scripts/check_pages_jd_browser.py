"""Real Chromium regression for HHBA Pages official JD and Chinese rendering."""
from __future__ import annotations
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = "https://yanm-jun.github.io/hhba-talent/"
DETAIL = ROOT + "candidate/jobs/greenhouse-airtable-8403107002"
OUT = Path("/tmp/hhba-jd-browser")
OUT.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": 390, "height": 844},
                                      device_scale_factor=1, locale="zh-CN")
        exceptions = []
        page.on("pageerror", lambda err: exceptions.append(str(err)[:150]))
        response = await page.goto(ROOT, wait_until="domcontentloaded", timeout=60000)
        if response is None or response.status >= 500:
            raise AssertionError("White HHBA GitHub Pages homepage did not load")
        await page.get_by_text("我要应聘").first.wait_for(timeout=20000)
        audit_response = await page.request.get(ROOT + "data/job-sync-summary.json", timeout=30000)
        assert audit_response.status == 200, "Published full-job audit report is missing"
        audit = await audit_response.json()
        assert audit.get("total_indexed_jobs", 0) > 9000, "Audit does not cover all imported positions"
        assert audit.get("verified_full_original_jd_and_requirements", 0) > 8000, "Full JD evidence count too low"
        assert sum(audit.get("statuses", {}).values()) == audit["total_indexed_jobs"], "Missing audited jobs"
        await page.get_by_text("全量官方 JD 核验", exact=False).first.wait_for(timeout=25000)
        await page.screenshot(path=str(OUT / "home-sync-audit.png"), full_page=True)
        await page.goto(DETAIL, wait_until="domcontentloaded", timeout=60000)
        await page.locator(".unified-detail-card h1").wait_for(timeout=20000)
        await page.get_by_role("button", name="English").click()
        await page.locator(".unified-jd-section").first.wait_for(timeout=45000)
        english = await page.locator(".unified-jd-section").all_text_contents()
        char_count = sum(len(s) for s in english)
        assert char_count > 1500, f"Real official requirements not rendered, chars={char_count}"
        assert any("requirement" in s.lower() or "experience" in s.lower() or "qualification" in s.lower()
                   for s in english), "No official qualifications or skills found in English"
        await page.screenshot(path=str(OUT / "airtable-original-en.png"), full_page=True)
        await page.get_by_role("button", name="中文").click()
        await page.locator(".unified-jd-chinese").wait_for(timeout=120000)
        chinese = await page.locator(".unified-jd-chinese").inner_text()
        zh_count = sum(1 for ch in chinese if "\u3400" <= ch <= "\u9fff")
        assert zh_count > 350, f"Full Chinese translation missing, Han chars={zh_count}"
        await page.screenshot(path=str(OUT / "airtable-translated-zh.png"), full_page=True)
        print("HHBA_BROWSER_JD_SUCCESS", json.dumps({
            "home_ok": True, "audited_all_positions": audit["total_indexed_jobs"], "detail": DETAIL,
            "english_characters": char_count,
            "chinese_characters": zh_count,
            "screenshots": sorted(x.name for x in OUT.glob("*.png")),
            "page_errors": exceptions
        }, ensure_ascii=False))
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
