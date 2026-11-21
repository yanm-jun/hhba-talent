"""Chromium QA: history actions open one scroll-contained modal, no page expansion.

Uses only synthetic account data. Exercises desktop/mobile, modal close and
focus restoration, internal scrolling, original linked Word and no re-search.
"""
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ORIGIN='http://127.0.0.1:4173'
HISTORY='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
RESUME='11111111-2222-4333-8444-555555555555'
OUT=Path('/tmp/hhba-history-modal-qa')
OUT.mkdir(parents=True,exist_ok=True)
RESULTS=[]

def scenario(browser,label,size):
    context=browser.new_context(viewport=size,locale='zh-CN',device_scale_factor=1)
    page=context.new_page()
    page.add_init_script("localStorage.setItem('hhba_real_auth_token','SYNTHETIC_QA_USER')")
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    requests={'detail':0,'search':0,'resumes':0}
    summary={'id':HISTORY,'resume_id':RESUME,'resume_label':'HHBA-QA-ORIGINAL.docx',
             'role_hint':'督导','created_at':'2026-11-22T01:00:00.000Z',
             'job_count':17,'best_score':87,'new_job_count':0,'improved_job_count':0}
    jobs=[{'id':f'saved-{i}','company':f'虚构雇主{i+1}',
           'title':f'岗位{i+1} · 区域运营', 'location':'上海',
           'official_url':f'https://jobs.example.org/{i}',
           'match_score':87-i,'score_basis':'历史评分仅供对比',
           'recommendation_reason':'这是一条虚构的历史推荐理由，核对原始职位描述后再投递。',
           'availability_status':'UNKNOWN','recruitment_source_kind':'EMPLOYER_ATS',
           'recruitment_source_note':'历史官方入口'} for i in range(17)]
    def reply(route,value):
        route.fulfill(status=200,content_type='application/json',
                      body=json.dumps(value,ensure_ascii=False))
    def api(route):
        path=urlsplit(route.request.url).path
        if path=='/api/match-native':
            requests['search']+=1
            raise AssertionError('History browsing must never relaunch AI matching')
        if path=='/api/match-history':
            return reply(route,{'ok':True,'kind':'HHBA_ACCOUNT_MATCH_HISTORY_V1','items':[summary]})
        if path=='/api/match-history/'+HISTORY:
            requests['detail']+=1
            return reply(route,{'ok':True,'kind':'HHBA_ACCOUNT_MATCH_HISTORY_V1',
                                'item':{**summary,'matches':jobs}})
        if path=='/api/resumes':
            requests['resumes']+=1
            return reply(route,{'ok':True,'kind':'HHBA_PRIVATE_RESUME_VAULT_V1',
                                'items':[{'id':RESUME,'name':'HHBA-QA-ORIGINAL.docx',
                                          'size':1000,'type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}]})
        return reply(route,{'ok':True,'enabled':False,'configured':False,'items':[]})
    page.route('**/api/**',api)
    page.goto(ORIGIN+'/scripts/qa-history-word-workspace.html',wait_until='domcontentloaded')
    row=page.locator('.hhba-match-history-list>article')
    row.wait_for(state='visible',timeout=20000)
    assert row.count()==1
    before=page.evaluate('window.scrollY')
    opener=page.get_by_role('button',name='查看岗位与理由')
    opener.click()
    modal=page.get_by_role('dialog',name='本次匹配详情')
    modal.wait_for(state='visible',timeout=20000)
    assert modal.locator('.hhba-match-history-job').count()==17
    assert row.count()==1,'history rows must stay in DOM under the modal'
    assert page.evaluate("document.body.style.overflow")=='hidden'
    scroller=modal.locator('.hhba-match-history-modal-body')
    dimensions=scroller.evaluate('(el)=>({client:el.clientHeight,scroll:el.scrollHeight,overflow:getComputedStyle(el).overflowY})')
    assert dimensions['overflow']=='auto' and dimensions['scroll']>dimensions['client'],dimensions
    scroller.evaluate('(el)=>{el.scrollTop=el.scrollHeight}')
    assert scroller.evaluate('(el)=>el.scrollTop')>0
    assert page.evaluate('window.scrollY')==before,'outer page must not scroll'
    page.keyboard.press('Escape')
    modal.wait_for(state='detached')
    assert page.evaluate("document.body.style.overflow")!='hidden'
    assert opener.evaluate('(el)=>document.activeElement===el'),'focus must return to opening button'
    assert row.count()==1
    page.get_by_role('button',name='优化简历',exact=True).click()
    optimizer=page.get_by_role('dialog',name='选择要优化的历史岗位')
    optimizer.wait_for(state='visible',timeout=20000)
    assert optimizer.locator('.hhba-match-history-job').count()==17
    assert optimizer.locator('.hhba-match-history-job-actions button').count()==17
    assert optimizer.get_by_text('当前原 Word').is_visible()
    assert page.locator('.hhba-match-history-overlay').count()==1
    assert page.evaluate("document.body.style.overflow")=='hidden'
    optimizer.locator('.hhba-match-history-modal-body').evaluate('(el)=>{el.scrollTop=el.scrollHeight}')
    assert optimizer.locator('.hhba-match-history-modal-body').evaluate('(el)=>el.scrollTop')>0
    optimizer.get_by_role('button',name='关闭匹配历史弹窗').click()
    optimizer.wait_for(state='detached')
    assert row.count()==1
    assert page.evaluate('window.scrollY')==before
    assert requests['search']==0 and requests['detail']==2 and requests['resumes']==1,requests
    assert not errors,(label,errors)
    page.screenshot(path=str(OUT/(label+'-list-restored.png')),animations='disabled')
    RESULTS.append({'viewport':label,'jobs':17,'innerScroll':True,'outerScrollLocked':True,
                    'focusRestored':True,'reusedSavedHistory':True,'errors':errors})
    context.close()

with sync_playwright() as browser_tools:
    browser=browser_tools.chromium.launch(headless=True,args=['--no-sandbox'])
    scenario(browser,'desktop',{'width':1440,'height':900})
    scenario(browser,'mobile',{'width':390,'height':844})
    browser.close()
(OUT/'report.json').write_text(json.dumps(RESULTS,ensure_ascii=False,indent=2))
print('HHBA_HISTORY_MODAL_QA_PASS',json.dumps(RESULTS,ensure_ascii=False))
