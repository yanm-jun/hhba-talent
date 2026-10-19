"""Browser proof: the static HHBA preview must not impersonate a running employer API."""
import asyncio,json
from playwright.async_api import async_playwright

BASE='http://127.0.0.1:4174/hhba-talent/'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':390,'height':844},locale='zh-CN')
  errors=[]
  mutations=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('request',lambda r:mutations.append({'method':r.method,'url':r.url}) if r.method not in ('GET','HEAD') else None)

  await page.goto(BASE+'employer/workspace',wait_until='networkidle',timeout=45000)
  await page.get_by_role('heading',name='发布真实岗位，寻找已授权的人才。').wait_for()
  assert await page.get_by_text('企业功能预览版',exact=False).count()>0
  assert await page.get_by_role('button',name='待连接企业 API 后开放保存').is_disabled()
  await page.get_by_role('textbox',name='岗位名称').fill('合成预览岗位：绝不提交')
  assert not mutations,mutations
  await page.get_by_role('button',name='授权人才搜索').click()
  await page.get_by_role('heading',name='只搜索已授权的求职者').wait_for()
  assert await page.get_by_role('button',name='待企业业务服务上线后开放检索').is_disabled()
  await page.screenshot(path='/tmp/hhba-phase4-offline-employer.png',full_page=True)

  await page.goto(BASE+'candidate/employer-jobs',wait_until='networkidle',timeout=45000)
  await page.get_by_role('heading',name='企业自行发布的招聘岗位').wait_for()
  assert await page.get_by_text('公开职位接口尚未上线').count()==1
  assert await page.get_by_role('button',name='搜索岗位').is_disabled()
  assert await page.locator('.employer-public-job').count()==0
  assert not mutations,mutations
  await page.screenshot(path='/tmp/hhba-phase4-offline-candidate.png',full_page=True)
  assert not errors,errors
  print('HHBA_PHASE4_STATIC_FAIL_CLOSED_PASS',json.dumps({'routes':['employer/workspace','candidate/employer-jobs'],
     'fictitious_jobs':0,'paid_or_data_mutations':0,'browser_errors':errors,'read_only':True},ensure_ascii=False))
  await browser.close()
if __name__=='__main__':asyncio.run(main())
