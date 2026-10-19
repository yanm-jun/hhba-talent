"""Real browser test for four newly added branded Greenhouse employer career domains."""
import asyncio,json
from playwright.async_api import async_playwright

BASE="https://yanm-jun.github.io/hhba-talent/"
BRANDS=[("stripe","stripe.com"),("coinbase","www.coinbase.com"),("airbnb","careers.airbnb.com"),("databricks","databricks.com")]

async def main():
  async with async_playwright() as p:
    browser=await p.chromium.launch(headless=True,args=["--no-sandbox"])
    page=await browser.new_page(viewport={"width":390,"height":844},locale="en-US")
    errors=[]
    page.on("pageerror",lambda e: errors.append(str(e)[:150]))
    raw=await page.request.get(BASE+"data/jobs.json",timeout=60000)
    audit=await page.request.get(BASE+"data/job-sync-status.json",timeout=60000)
    assert raw.ok and audit.ok,"Updated index and audit not published"
    data=await raw.json();report=await audit.json()
    assert data["boards"]>=50 and data["total"]>=15000, "Branded company feed has not synced to Pages"
    assert report["summary"]["total_indexed_jobs"]==data["total"]
    good={r["job_id"] for r in report["jobs"] if r["status"]=="OFFICIAL_JD_AND_REQUIREMENTS_FOUND"}
    results=[]
    for slug,host in BRANDS:
      matches=[j for j in data["jobs"] if j.get("platform")=="greenhouse" and j.get("source")==slug and j["id"] in good]
      assert matches,f"No verified job for {slug}"
      from urllib.parse import urlsplit,parse_qs
      one=matches[0]
      u=urlsplit(one["url"])
      assert u.hostname==host,f"Official company host mismatch for {slug}"
      assert parse_qs(u.query).get("gh_jid")==[one["id"].split("-")[-1]],f"Native ID mismatch for {slug}"
      await page.goto(BASE+"candidate/jobs/"+one["id"],wait_until="domcontentloaded",timeout=60000)
      await page.locator(".unified-detail-card h1").wait_for(timeout=30000)
      await page.get_by_role("button",name="English").click()
      await page.locator(".unified-jd-section").first.wait_for(timeout=65000)
      text=" ".join(await page.locator(".unified-jd-section").all_text_contents())
      assert len(text)>250,f"No full JD on white HHBA for {slug}"
      results.append({"company":slug,"id":one["id"],"text_chars":len(text)})
      print("HHBA_BRANDED_BROWSER_OK",json.dumps(results[-1]))
    assert not errors,f"Browser error: {errors}"
    print("HHBA_BRANDED_BROWSER_SUCCESS",json.dumps({"index":data["total"],"boards":data["boards"],"tested_brands":len(results),"errors":errors}))
    await browser.close()
if __name__=="__main__":
  asyncio.run(main())
