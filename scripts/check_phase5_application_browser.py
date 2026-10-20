"""Real mobile UI smoke tests. NO real employer, candidate, resume or POST requests."""
import asyncio,json
from playwright.async_api import async_playwright

BASE='http://127.0.0.1:4174/hhba-talent/'
async def run():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':390,'height':844},locale='zh-CN')
  errors=[];mutations=[]
  page.on('pageerror',lambda e:errors.append(str(e)[:200]))
  page.on('request',lambda r:mutations.append((r.method,r.url)) if r.method not in ('GET','HEAD') else None)
  await page.goto(BASE+'candidate/my-applications',wait_until='domcontentloaded',timeout=60000)
  await page.get_by_role('heading',name='我的企业岗位申请与进度').wait_for(timeout=30000)
  assert await page.get_by_text('申请业务服务器尚未上线',exact=False).count()==1
  assert await page.locator('.hhba-applications-item').count()==0
  await page.screenshot(path='/tmp/hhba-phase5-candidate-progress.png',full_page=True)

  await page.goto(BASE+'employer/workspace',wait_until='domcontentloaded',timeout=60000)
  await page.get_by_role('heading',name='发布真实岗位，寻找已授权的人才。').wait_for(timeout=30000)
  await page.get_by_role('button',name='收到的求职申请').click()
  assert await page.get_by_role('heading',name='收到的求职申请').count()==1
  assert await page.get_by_text('当前只提供界面预览',exact=False).count()==1
  assert await page.locator('.hhba-applicant-card').count()==0
  await page.screenshot(path='/tmp/hhba-phase5-employer-pipeline.png',full_page=True)
  assert not errors and not mutations,{'errors':errors,'writes':mutations}
  print('HHBA_PHASE5_MOBILE_FAIL_CLOSED_PASS',json.dumps({
   'candidate_history':True,'employer_applicant_tab':True,
   'invented_applications':0,'client_mutations':0,'javascript_errors':0},ensure_ascii=False))
  await browser.close()
if __name__=='__main__':asyncio.run(run())
