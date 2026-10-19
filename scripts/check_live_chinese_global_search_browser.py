"""Chromium smoke for real HHBA Chinese/English job search and structured ATS filters."""
import asyncio,json,re
from playwright.async_api import async_playwright
BASE="https://yanm-jun.github.io/hhba-talent/"
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=["--no-sandbox"])
  page=await browser.new_page(viewport={"width":390,"height":844},locale="zh-CN")
  errors=[]
  page.on("pageerror",lambda err:errors.append(str(err)[:220]))
  await page.goto(BASE+"candidate/jobs",wait_until="domcontentloaded",timeout=60000)
  await page.locator(".unified-job-search input").wait_for(timeout=45000)
  await page.locator(".unified-job-controls select[aria-label='国家筛选']").wait_for(timeout=25000)
  await page.locator(".unified-job-controls select[aria-label='城市筛选']").wait_for(timeout=25000)
  results=[]
  for query,recognized in [
   ("新加坡软件工程师","新加坡"),
   ("美国销售","美国"),
   ("不限学历的远程工作","明确无学历要求")]:
   await page.locator(".unified-job-search input").fill(query)
   await page.locator(".unified-search-interpreted").get_by_text(recognized,exact=False).wait_for(timeout=12000)
   await page.wait_for_timeout(800)
   try:
    await page.locator(".unified-job-state[role='status']").wait_for(state="hidden",timeout=45000)
   except Exception:
    pass
   await page.wait_for_timeout(500)
   footer=await page.locator(".unified-job-footer").inner_text()
   found=re.search(r"共匹配\s*([\d,]+)\s*条",footer)
   assert found,"Count not displayed after query: "+query+" "+footer
   count=int(found.group(1).replace(",",""))
   if query!="不限学历的远程工作":
    assert count>0,"Expected official postings for "+query
   if query=="不限学历的远程工作":
    label=await page.locator(".unified-search-interpreted").inner_text()
    assert "远程" in label and "明确无学历要求" in label
   results.append({"query":query,"count":count,"recognized":recognized})
   print("HHBA_LIVE_CHINESE_JOB_SEARCH",json.dumps(results[-1],ensure_ascii=False))
  await page.locator(".unified-job-search input").fill("")
  await page.locator("select[aria-label='国家筛选']").select_option("US")
  await page.locator("select[aria-label='城市筛选']").select_option("new york")
  await page.locator("select[aria-label='招聘类型']").select_option("SOCIAL")
  await page.locator("select[aria-label='经验要求']").select_option("3-5")
  await page.locator("select[aria-label='学历要求']").select_option("BACHELOR")
  await page.wait_for_timeout(1000)
  try:await page.locator(".unified-job-state[role='status']").wait_for(state="hidden",timeout=45000)
  except Exception:pass
  assert await page.locator("select[aria-label='国家筛选']").input_value()=="US"
  assert await page.locator("select[aria-label='城市筛选']").input_value()=="new york"
  assert await page.locator("select[aria-label='学历要求']").input_value()=="BACHELOR"
  await page.screenshot(path="/tmp/hhba-chinese-global-search-mobile.png",full_page=True)
  await page.get_by_role("button",name="English").first.click()
  await page.locator("select[aria-label='Filter by country']").wait_for(timeout=25000)
  await page.locator("select[aria-label='Filter by city']").wait_for(timeout=25000)
  await page.locator("select[aria-label='Experience requirement']").wait_for(timeout=25000)
  await page.locator("select[aria-label='Education requirements']").wait_for(timeout=25000)
  assert not errors,"Browser JS errors "+str(errors)
  print("HHBA_REAL_GLOBAL_CHINESE_SEARCH_UI_PASS",json.dumps({
    "queries":results,"country_city_degree_type_experience_filters":True,
    "english_switch":True,"errors":errors},ensure_ascii=False))
  await browser.close()
if __name__=="__main__":asyncio.run(main())
