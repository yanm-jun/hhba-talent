"""UI-only Chromium acceptance. Synthetic account responses, NO employer data written."""
import asyncio,json
from playwright.async_api import async_playwright

BASE='https://yanm-jun.github.io/hhba-talent/'
ORG='00000000-0000-4000-8000-000000000001'
USER='00000000-0000-4000-8000-000000000002'
async def run():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':390,'height':844},locale='zh-CN')
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)[:160]))
  async def fake(route):
   u=route.request.url
   if u.endswith('/auth/me'):
    return await route.fulfill(status=200,content_type='application/json',body=json.dumps({
      'id':USER,'display_name':'合成企业管理员','email':'employer@synthetic.example',
      'role':'user','account_types':['recruiter'],'csrf_token':'test-only-token'}))
   if u.endswith('/organizations'):
    return await route.fulfill(status=200,content_type='application/json',body=json.dumps({
      'organizations':[{'id':ORG,'legal_name':'合成测试企业（非真实）','status':'pending_review','membership_role':'owner'}]}))
   if u.endswith('/postings') and route.request.method=='GET':
    return await route.fulfill(status=200,content_type='application/json',body=json.dumps({'items':[]}))
   if u.endswith('/talent-search'):
    return await route.fulfill(status=403,content_type='application/json',body=json.dumps({'detail':'business verification required'}))
   return await route.fulfill(status=404,content_type='application/json',body=json.dumps({'detail':'test stub: no actual backend'}))
  await page.route('**/api/v1/**',fake)
  await page.goto(BASE+'employer/workspace',wait_until='domcontentloaded',timeout=60000)
  await page.get_by_role('heading',name='发布真实岗位，寻找已授权的人才。').wait_for(timeout=35000)
  await page.locator('select').first.wait_for(timeout=15000)
  assert '合成测试企业' in await page.locator('.employer-ws-company').inner_text()
  await page.get_by_role('textbox',name='岗位名称').fill('合成区域销售负责人（仅浏览器测试）')
  await page.get_by_role('textbox',name='招聘地点').fill('山东济南')
  assert await page.get_by_role('button',name='保存私密岗位草稿').count()==1
  await page.get_by_role('button',name='授权人才搜索').click()
  await page.get_by_role('heading',name='只搜索已授权的求职者').wait_for(timeout=15000)
  await page.get_by_role('textbox',name='关键词').fill('销售培训')
  await page.get_by_role('button',name='检索符合条件的人才').click()
  await page.get_by_text('权限不足',exact=False).wait_for(timeout=12000)
  await page.screenshot(path='/tmp/hhba-phase4-employer-mobile.png',full_page=True)
  assert not errors,errors
  print('HHBA_PHASE4_EMPLOYER_MOBILE_PASS',json.dumps({
    'published_site':BASE,'route':'employer/workspace',
    'synthetic_org_only':True,'job_form':True,'recruiter_search_form':True,
    'backend_requires_real_verification':True,'page_errors':errors},ensure_ascii=False))
  await browser.close()
if __name__=='__main__':asyncio.run(run())
