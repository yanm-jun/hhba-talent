"""End-to-end Chromium QA of bilingual overseas JD reader on each supported public ATS."""
import asyncio,json,re
from playwright.async_api import async_playwright
BASE="https://yanm-jun.github.io/hhba-talent/"
PLATFORMS=[("greenhouse","airtable"),("ashby","deepgram"),("lever","spotify")]
async def test():
  async with async_playwright() as p:
    browser=await p.chromium.launch(headless=True,args=["--no-sandbox"])
    page=await browser.new_page(viewport={"width":390,"height":844},locale="zh-CN")
    errors=[]
    page.on("pageerror",lambda err:errors.append(str(err)[:180]))
    r=await page.request.get(BASE+"data/jobs.json",timeout=60000)
    a=await page.request.get(BASE+"data/job-sync-status.json",timeout=60000)
    assert r.ok and a.ok, "Live pages feed unavailable"
    feed=await r.json();audit=await a.json()
    verified={item["job_id"]:item for item in audit["jobs"] if item.get("status")=="OFFICIAL_JD_AND_REQUIREMENTS_FOUND"}
    results=[]
    for platform,slug in PLATFORMS:
      candidates=[row for row in feed["jobs"] if row.get("platform")==platform and
        row.get("source")==slug and row["id"] in verified]
      assert candidates, f"Official ATS source {platform}:{slug} has no eligible jobs"
      candidates.sort(key=lambda row:abs(verified[row["id"]].get("jd_characters",0)-1400))
      job=candidates[0];id=job["id"]
      await page.goto(BASE+"candidate/jobs/"+id,wait_until="domcontentloaded",timeout=60000)
      await page.locator(".unified-detail-card h1").wait_for(timeout=30000)
      await page.get_by_role("button",name="English").click()
      await page.locator(".unified-jd-section").first.wait_for(timeout=50000)
      en=" ".join(await page.locator(".unified-jd-section").all_text_contents())
      assert len(en)>250,f"{platform} official original JD not displayed"
      await page.get_by_role("button",name="中文").click()
      try:
        await page.locator(".unified-jd-chinese").wait_for(timeout=125000)
        zh=await page.locator(".unified-jd-chinese").inner_text()
        hans=sum(1 for ch in zh if "\\u3400"<=ch<="\\u9fff")
        assert hans>80,f"{platform} translation too short"
        assert not re.search(r"\\ufffd|(?:[A-Za-z]{3,}\\s+){12,}[A-Za-z]{3,}",zh), f"{platform} leaked untranslated English"
        results.append({"platform":platform,"source":slug,"job":id,"english_chars":len(en),"zh_han":hans,"translated":True})
      except Exception as e:
        status=await page.locator(".unified-jd-translate").all_text_contents()
        results.append({"platform":platform,"source":slug,"job":id,"english_chars":len(en),
          "translated":False,"reader_status":status[:1],"error":str(e)[:140]})
      print("HHBA_3ATS_READER_RESULT",json.dumps(results[-1],ensure_ascii=False))
    assert not errors,f"JS page errors: {errors}"
    assert all(row["translated"] for row in results),"One or more platforms did not translate a complete sample JD"
    print("HHBA_3ATS_FULL_BILINGUAL_PASS",json.dumps({"platforms":len(results),"results":results},ensure_ascii=False))
    await browser.close()
if __name__=="__main__":
  asyncio.run(test())
