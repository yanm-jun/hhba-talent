"""Real-mobile HHBA third-step preview: one admin DeepSeek key, no user key input or uploads while disabled."""
import asyncio,json
from playwright.async_api import async_playwright
URL="https://yanm-jun.github.io/hhba-talent/"
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=["--no-sandbox"])
  page=await browser.new_page(viewport={"width":390,"height":844},locale="zh-CN")
  errs=[]
  page.on("pageerror",lambda err: errs.append(str(err)[:180]))
  await page.goto(URL+"candidate/match",wait_until="domcontentloaded",timeout=60000)
  await page.get_by_text("上传你的简历，匹配真实招聘岗位。").wait_for(timeout=35000)
  await page.get_by_text("无须自备 API Key").wait_for(timeout=30000)
  await page.get_by_text("平台 DeepSeek 服务尚未启用。").wait_for(timeout=30000)
  # The frontend must never have a user token input or attempt to call DeepSeek directly.
  inputs=await page.locator("input").evaluate_all("(els)=>els.map(e=>({type:e.type,name:e.name,id:e.id,placeholder:e.placeholder}))")
  assert not any("api_key" in str(x).lower() or "deepseek_key" in str(x).lower() or "token" in str(x).lower() for x in inputs)
  submit=page.get_by_role("button",name="开始智能匹配")
  assert await submit.is_disabled(), "Cannot accept PII until the admin backend and key are ready"
  assert await page.locator("input[type=checkbox]").count()>=2
  await page.screenshot(path="/tmp/hhba-ai-resume-matching-mobile.png",full_page=True)
  await page.goto(URL+"candidate/jobs",wait_until="domcontentloaded",timeout=60000)
  await page.locator(".unified-job-search input").wait_for(timeout=35000)
  assert not errs,errs
  print("HHBA_ONE_ADMIN_KEY_MATCH_PREVIEW_PASS",json.dumps({
    "source":"real GitHub Pages","route":"/candidate/match",
    "user_key_input":False,"requires_explicit_consent":True,
    "disabled_without_operator_key":True,"original_job_search_preserved":True,
    "browser_errors":errs},ensure_ascii=False))
  await browser.close()
if __name__=="__main__":
 asyncio.run(main())
