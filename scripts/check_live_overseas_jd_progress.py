"""Browser verification: published white HHBA shows the real persistent overseas-JD completion data."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT="https://yanm-jun.github.io/hhba-talent/"
BACKEND="https://hhba-web-production-024c.up.railway.app/api/jd-sync/status"
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=["--no-sandbox"])
  page=await browser.new_page(viewport={"width":390,"height":844},locale="zh-CN")
  failures=[]
  page.on("pageerror",lambda e: failures.append(str(e)[:140]))
  response=await page.request.get(BACKEND,timeout=30000)
  assert response.ok, "Live persisted JD sync status not readable"
  state=await response.json()
  assert state["enabled"] is True and state["persistent"] is True
  assert state["total_current"]>=13000
  assert state["complete"]<=state["total_current"]
  await page.goto(ROOT,wait_until="domcontentloaded",timeout=60000)
  progress=page.locator(".unified-jd-sync-progress")
  await progress.first.wait_for(timeout=40000)
  text=await progress.first.inner_text()
  assert "海外 JD 中文全文机械校验完成" in text,text
  assert f"{state['total_current']:,}" in text,text
  assert "机器翻译仅供辅助阅读" in text,text
  await page.screenshot(path="/tmp/hhba-live-jd-progress.png",full_page=True)
  assert not failures,failures
  print("HHBA_LIVE_PERSISTENT_JD_UI_VERIFIED",json.dumps({
    "total_overseas":state["total_current"],
    "complete_machine_checked":state["complete"],
    "verified_translation_chunks":state["translated_parts"],
    "progress_displayed":True,"errors":failures
  },ensure_ascii=False))
  await page.get_by_role("button",name="English").first.click()
  translated=await progress.first.inner_text()
  assert "Overseas full-JD machine-validated Chinese" in translated
  print("HHBA_JD_PROGRESS_ENGLISH_LABEL_OK")
  await browser.close()
if __name__=="__main__":
 asyncio.run(main())
