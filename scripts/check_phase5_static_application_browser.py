"""Real mobile browser acceptance: application UI remains privacy-safe on static Pages.
No real database or applicant profiles; no fake employers or successful submissions.
"""
import asyncio,json
from playwright.async_api import async_playwright
BASE='http://127.0.0.1:4174/hhba-talent/'

async def main():
 async with async_playwright() as playwright:
  browser=await playwright.chromium.launch(headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':390,'height':844},locale='zh-CN')
  errors=[]; mutations=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.on('request',lambda req:mutations.append([req.method,req.url]) if req.method not in ('GET','HEAD') else None)
  async def no_session(route):
   await route.fulfill(status=401,content_type='application/json',body='{"detail":"authentication required"}')
  await page.route('**/api/v1/auth/me',no_session)

  await page.goto(BASE+'candidate/my-applications',wait_until='domcontentloaded',timeout=45000)
  await page.get_by_role('heading',name='我的企业岗位申请与进度').wait_for(timeout=25000)
  assert await page.get_by_text('申请业务服务器尚未上线',exact=False).count()==1
  assert await page.locator('.hhba-applications-item').count()==0
  await page.screenshot(path='/tmp/hhba-phase5-my-applications-mobile.png',full_page=True)

  await page.goto(BASE+'employer/workspace',wait_until='domcontentloaded',timeout=45000)
  await page.get_by_role('heading',name='发布真实岗位，寻找已授权的人才。').wait_for(timeout=25000)
  await page.get_by_role('button',name='收到的求职申请').click()
  assert await page.get_by_role('heading',name='收到的求职申请').count()==1
  assert await page.get_by_text('当前只提供界面预览',exact=False).count()==1
  assert await page.locator('.hhba-applicant-card').count()==0
  await page.screenshot(path='/tmp/hhba-phase5-employer-applicants-mobile.png',full_page=True)

  await page.goto(BASE+'candidate/employer-jobs',wait_until='domcontentloaded',timeout=45000)
  await page.get_by_role('heading',name='查看经认证企业自主发布的真实招聘岗位。').wait_for(timeout=25000)
  assert await page.locator('.employer-public-item').count()==0
  assert not mutations,mutations
  assert not errors,errors
  print('HHBA_PHASE5_BROWSER_PASS',json.dumps({'screens':3,'invented_applications':0,
   'mutations':mutations,'browser_errors':errors},ensure_ascii=False))
  await browser.close()

if __name__=='__main__':asyncio.run(main())
