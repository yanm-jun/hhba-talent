"""Real React historical-match -> original Word optimizer, synthetic account-only data.
Desktop: linked original. Mobile: explicit association. Missing original: no fake editor.
"""
import json
import re
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright

ORIGIN='http://127.0.0.1:4173'
WORD=(Path('public')/'__hhba_word_qa.docx').read_bytes()
OUT=Path('/tmp/hhba-history-word-qa')
OUT.mkdir(parents=True,exist_ok=True)
HISTORY_ID='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
RESUME_ID='11111111-2222-4333-8444-555555555555'
NAME='HHBA-SYNTHETIC-QA.docx'
JOB_1={'id':'saved-search-1','company':'虚构企业甲','title':'历史门店运营',
       'location':'上海','official_url':'https://jobs.example.org/saved-1',
       'match_score':76,'score_basis':'岗位要求门店运营和数据整理',
       'recommendation_reason':'历史匹配认为运营经验相关，不代表当前在招',
       'availability_status':'UNKNOWN','recruitment_source_kind':'EMPLOYER_ATS',
       'recruitment_source_note':'历史官网来源'}
JOB_2={**JOB_1,'id':'saved-search-2','company':'虚构企业乙',
       'title':'历史区域督导','official_url':'https://jobs.example.org/saved-2',
       'match_score':88,'score_basis':'历史评分依据：区域督导及门店运营',
       'recommendation_reason':'历史推荐理由：门店运营数据整理工作',
       'recruitment_source_kind':'EMPLOYER_DOMAIN_CANDIDATE'}
REPORT=[]

def exercise(browser,label,viewport,initial_linked,has_file=True):
    ctx=browser.new_context(viewport=viewport,locale='zh-CN',device_scale_factor=1)
    page=ctx.new_page()
    page.add_init_script("localStorage.setItem('hhba_real_auth_token','SYNTHETIC_QA_USER')")
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    data={'linked':initial_linked,'match_calls':0,'link_calls':0,'ai_calls':[]}
    resume={'id':RESUME_ID,'name':NAME,
       'type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'size':len(WORD),'createdAt':'2026-11-21T10:00:00.000Z'}
    summary={'id':HISTORY_ID,'resume_id':RESUME_ID if initial_linked else None,
       'resume_label':NAME if initial_linked else '本次上传的简历（未保存）',
       'role_hint':'督导','created_at':'2026-11-21T10:00:00.000Z',
       'job_count':2,'best_score':88,'new_job_count':0,'improved_job_count':0}

    def j(route,value,status=200):
        route.fulfill(status=status,content_type='application/json',
            body=json.dumps(value,ensure_ascii=False))

    def api(route):
        req=route.request
        url=urlsplit(req.url)
        path=url.path
        action=parse_qs(url.query).get('action',[''])[0]
        if path.startswith('/api/match-native'):
            data['match_calls']+=1
            raise AssertionError('History optimization reran a job search')
        if path=='/api/match-history':
            return j(route,{'ok':True,'kind':'HHBA_ACCOUNT_MATCH_HISTORY_V1',
                'items':[summary]})
        if path=='/api/match-history/'+HISTORY_ID+'/link':
            assert has_file and req.method=='POST'
            assert req.post_data_json['resume_id']==RESUME_ID
            data['linked']=True
            summary.update({'resume_id':RESUME_ID,'resume_label':NAME})
            data['link_calls']+=1
            return j(route,{'ok':True,'kind':'HHBA_ACCOUNT_MATCH_HISTORY_V1','linked':True})
        if path=='/api/match-history/'+HISTORY_ID:
            return j(route,{'ok':True,'kind':'HHBA_ACCOUNT_MATCH_HISTORY_V1',
                'item':{**summary,'resume_id':RESUME_ID if data['linked'] else None,
                        'matches':[JOB_1,JOB_2]}})
        if path=='/api/resumes':
            return j(route,{'ok':True,'kind':'HHBA_PRIVATE_RESUME_VAULT_V1',
                'items':[resume] if has_file else []})
        if path=='/api/resume-word':
            if action=='status':
                return j(route,{'ok':True,'enabled':True,'renderer_enabled':False,'docx_only_enabled':True})
            if action=='inspect':
                return j(route,{'ok':True,'editable_text':['负责门店运营及日常数据整理工作'],
                    'saved':None,'revision':0,'total_revisions':0,'history':[],
                    'max_revisions':8,'max_daily_edits':6,
                    'pdf_available':False,'layout_verified':False})
            if action=='source-docx':
                assert re.fullmatch(r'posting-url-v1-[a-f0-9]{32}',parse_qs(url.query)['job_id'][0])
                return route.fulfill(status=200,body=WORD,headers={
                    'content-type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
            raise AssertionError('Unexpected Word endpoint '+action)
        if path=='/api/resume-optimize':
            if req.method=='GET':
                return j(route,{'kind':'HHBA_RESUME_OPTIMIZATION_V1','enabled':True,'configured':True,
                    'per_account_daily_limit':3,'global_daily_limit':50,
                    'per_account_daily_attempt_limit':6,'global_daily_attempt_limit':120})
            payload=req.post_data_json
            assert payload['consent_ai'] is True
            assert payload['job']['title']=='历史区域督导',payload
            assert '历史评分依据' in payload['job']['requirements'],payload
            assert payload['blocks'][0]['text']=='负责门店运营及日常数据整理工作'
            data['ai_calls'].append(payload)
            text=payload['blocks'][0]['text']
            return j(route,{'ok':True,'suggestions':[{
              'id':'history-suggestion-1','blockId':payload['blocks'][0]['id'],
              'action':'replace','original':text,'proposed':'负责门店运营和数据整理',
              'rationale':'基于真实经历的措辞修改','jobRequirement':'岗位需要区域督导',
              'evidenceStatus':'needs_user_confirmation'}]})
        return j(route,{'ok':True,'enabled':False,'configured':False,'items':[]})

    page.route('**/api/**',api)
    page.goto(ORIGIN+'/scripts/qa-history-word-workspace.html',wait_until='domcontentloaded')
    page.get_by_role('button',name='优化简历',exact=True).wait_for(timeout=20000)
    page.get_by_role('button',name='优化简历',exact=True).click()
    popup=page.get_by_role('dialog',name='选择要优化的历史岗位')
    popup.wait_for(state='visible',timeout=18000)
    assert page.locator('.hhba-match-history-list>article').count()==1
    assert page.evaluate("document.body.style.overflow")=='hidden'
    assert popup.locator('.hhba-match-history-modal-body').evaluate(
        '(el)=>getComputedStyle(el).overflowY')=='auto'
    if not initial_linked:
        page.get_by_text('本次历史没有保存原始 Word',exact=False).wait_for(timeout=10000)
        if not has_file:
            assert page.get_by_role('button',name='优化这个岗位的简历').first.is_disabled()
            assert page.get_by_role('link',name='去「我的简历」上传原 Word').is_visible()
            assert data['match_calls']==0 and not data['ai_calls'] and not errors
            REPORT.append({'scenario':label,'missingOriginalSafeguard':True,'errors':errors})
            ctx.close()
            return
        page.locator('#hhba-history-original-word').select_option(RESUME_ID)
        page.once('dialog',lambda dialog:dialog.accept())
        page.get_by_role('button',name='关联并继续').click()
        page.get_by_text('原 Word 已关联',exact=False).wait_for(timeout=12000)
        assert data['link_calls']==1
    buttons=page.get_by_role('button',name='优化这个岗位的简历')
    assert buttons.count()==2
    assert buttons.nth(1).is_enabled()
    buttons.nth(1).click()
    page.locator('.hhba-match-modal-editor').wait_for(state='visible',timeout=18000)
    assert page.get_by_role('dialog',name='选择要优化的历史岗位').count()==1
    assert page.locator('.hhba-match-history-list>article').count()==1
    word=page.locator('section.hhba-native-docx').first
    word.wait_for(state='visible',timeout=35000)
    assert '负责门店运营及日常数据整理工作' in word.inner_text()
    assert page.get_by_text('原匹配分 88/100').count()==1
    assert page.get_by_role('button',name='保存 Word').is_visible()
    assert data['match_calls']==0
    page.screenshot(path=str(OUT/(label+'-historical-word.png')),animations='disabled')
    page.get_by_role('button',name='开始 AI 优化简历').click()
    consent=page.get_by_role('dialog',name='开始 AI 优化简历')
    consent.locator('input[type=checkbox]').check()
    consent.get_by_role('button',name='同意并开始').click()
    page.get_by_role('button',name='查看此处文字操作').first.wait_for(timeout=20000)
    assert len(data['ai_calls'])==1
    assert not errors,(label,errors)
    REPORT.append({'scenario':label,'historyJobSelected':'历史区域督导',
        'sameWordEditor':True,'noRepeatMatching':True,
        'manualOriginalAssociation':data['link_calls'],'aiRequestsAfterConsent':len(data['ai_calls']),
        'errors':errors})
    ctx.close()

with sync_playwright() as play:
    browser=play.chromium.launch(headless=True,args=['--no-sandbox'])
    exercise(browser,'desktop-linked',{'width':1440,'height':900},True)
    exercise(browser,'mobile-associated',{'width':390,'height':844},False)
    exercise(browser,'missing-original',{'width':390,'height':844},False,False)
    browser.close()
(OUT/'report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
print('HHBA_HISTORY_WORD_QA_PASS',json.dumps(REPORT,ensure_ascii=False))
