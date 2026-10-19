"""Actual Chromium acceptance for newly connected Greenhouse + Ashby and preserved Lever brands."""
from __future__ import annotations
import asyncio,json
from playwright.async_api import async_playwright
BASE="https://yanm-jun.github.io/hhba-talent/"
SOURCES=[
  ("greenhouse","spacex"),("greenhouse","spacexglobal"),
  ("greenhouse","anthropic"),("greenhouse","doordashusa"),
  ("ashby","deepgram"),("ashby","cohere"),
  ("lever","spotify")
]
async def run():
  async with async_playwright() as play:
    browser=await play.chromium.launch(headless=True,args=["--no-sandbox"])
    page=await browser.new_page(viewport={"width":390,"height":844},locale="zh-CN")
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)[:180]))
    feed_response=await page.request.get(BASE+"data/jobs.json",timeout=60000)
    audit_response=await page.request.get(BASE+"data/job-sync-status.json",timeout=60000)
    assert feed_response.ok and audit_response.ok, "missing live indexed job data or full audit"
    feed=await feed_response.json()
    audit=await audit_response.json()
    assert feed["boards"]>=46 and feed["total"]>=13000,"new source boards missing from white HHBA"
    assert audit["summary"]["total_indexed_jobs"]==feed["total"],"official JD audit not aligned with current indexed jobs"
    audited={x["job_id"]:x for x in audit["jobs"]}
    results=[]
    for platform,slug in SOURCES:
      matches=[j for j in feed["jobs"] if j.get("platform")==platform and j.get("source")==slug and
        audited.get(j["id"],{}).get("status")=="OFFICIAL_JD_AND_REQUIREMENTS_FOUND"]
      assert matches, f"no verified positions for {platform}:{slug}"
      one=matches[0]
      detail=BASE+"candidate/jobs/"+one["id"]
      await page.goto(detail,wait_until="domcontentloaded",timeout=60000)
      await page.locator(".unified-detail-card h1").wait_for(timeout=30000)
      await page.get_by_role("button",name="English").click()
      await page.locator(".unified-jd-section").first.wait_for(timeout=65000)
      body=" ".join(await page.locator(".unified-jd-section").all_text_contents())
      assert len(body)>=200,f"Original official JD missing or too short for {platform}:{slug}, length={len(body)}"
      results.append({"platform":platform,"source":slug,"job_id":one["id"],"original_jd_chars":len(body)})
      print("HHBA_ATS_BRAND_BROWSER_OK",json.dumps(results[-1]))
    assert not errors,"Browser JS errors: "+str(errors)
    print("HHBA_ALL_3_ATS_BROWSER_OK",json.dumps({"index_count":feed["total"],"boards":feed["boards"],"tested_sources":len(results),"errors":errors,"sources":results}))
    await browser.close()
if __name__=="__main__":
  asyncio.run(run())
