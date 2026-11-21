"""Actual HHBA job-match -> minimal centered Word editor in Chromium.
Uses a synthetic DOCX and intercepted APIs; no real user account or edits.
"""
import json
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright

ORIGIN='http://127.0.0.1:4173'
WORD=(Path('public')/'__hhba_word_qa.docx').read_bytes()
OUT=Path('/tmp/hhba-word-unobstructed-qa')
OUT.mkdir(parents=True,exist_ok=True)
REPORT=[]

def exercise(browser,name,viewport):
    ctx=browser.new_context(viewport=viewport,locale='zh-CN',device_scale_factor=1)
    page=ctx.new_page()
    page.add_init_script("localStorage.setItem('hhba_real_auth_token','SYNTHETIC_QA_USER')")
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    edits=[]

    def api(route):
        req=route.request
        query=parse_qs(urlsplit(req.url).query)
        action=query.get('action',[''])[0]
        path=urlsplit(req.url).path
        if path.endswith('/resume-word'):
            if action=='status':
                return route.fulfill(status=200,content_type='application/json',
                    body=json.dumps({'ok':True,'enabled':True,'renderer_enabled':False,'docx_only_enabled':True}))
            if action=='inspect':
                return route.fulfill(status=200,content_type='application/json',
                    body=json.dumps({'ok':True,'editable_text':['负责门店运营及日常数据整理工作'],
                        'saved':None,'revision':0,'total_revisions':0,'history':[],
                        'max_revisions':8,'max_daily_edits':6,
                        'pdf_available':False,'layout_verified':False}))
            if action=='source-docx':
                return route.fulfill(status=200,body=WORD,headers={
                    'content-type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
            raise AssertionError('Unexpected Word endpoint '+action)
        if path.endswith('/resume-optimize'):
            if req.method=='GET':
                return route.fulfill(status=200,content_type='application/json',
                    body=json.dumps({'kind':'HHBA_RESUME_OPTIMIZATION_V1','enabled':True,'configured':True,
                        'per_account_daily_limit':3,'global_daily_limit':50,
                        'per_account_daily_attempt_limit':6,'global_daily_attempt_limit':120}))
            payload=req.post_data_json
            assert payload['consent_ai'] is True
            assert payload['job']['title'] and payload['blocks']
            text=payload['blocks'][0]['text']
            assert payload['blocks'][0]['id']=='word-0',('not anchored Word',payload['blocks'])
            assert text=='负责门店运营及日常数据整理工作',('AI received wrong original text',text)
            edits.append({'job':payload['job']['title'],'blocks':len(payload['blocks'])})
            suggestion={'id':'siri-qa-1','blockId':'word-0','action':'replace',
                        'original':text,'proposed':'负责门店运营与业务数据整理',
                        'rationale':'只调整措辞，不增加经历或业绩',
                        'jobRequirement':'门店运营管理与数据分析',
                        'evidenceStatus':'needs_user_confirmation'}
            return route.fulfill(status=200,content_type='application/json',
                body=json.dumps({'ok':True,'suggestions':[suggestion]}))
        return route.fulfill(status=200,content_type='application/json',
            body=json.dumps({'ok':True,'enabled':False,'configured':False,'items':[]}))

    page.route('**/api/**',api)
    page.goto(ORIGIN+'/scripts/qa-targeted-word-workspace.html',wait_until='domcontentloaded')
    page.get_by_role('button',name='针对虚构运营督导优化简历').click(timeout=18000)
    paper=page.locator('.targeted-resume.is-word-first .hhba-browser-word-paper')
    word=page.locator('.targeted-resume.is-word-first section.hhba-native-docx').first
    word.wait_for(state='visible',timeout=35000)
    page.get_by_role('button',name='开始 AI 优化简历').wait_for(timeout=15000)
    page.wait_for_timeout(350)
    assert page.locator('#hhba-word-optimization-tools').count()==0,name
    assert page.locator('.hhba-word-tools-scrim').count()==0,name
    assert page.locator('.hhba-word-quick-actions').count()==0,name
    assert page.get_by_role('button',name='开始 AI 优化简历').is_enabled(),name
    assert page.locator('.hhba-match-selected-job:visible').count()==0,name
    assert page.get_by_text('原匹配分 76/100').count()==1,name
    assert page.locator('.hhba-word-minimal-footer:visible').count()==1,name
    assert page.get_by_role('button',name='下载当前 Word').is_visible(),name
    assert page.get_by_role('button',name='保存 Word').is_visible(),name
    assert page.get_by_role('button',name='缩小 Word').count()>=1,name
    assert page.locator('.hhba-original-resume-mobile-dock:visible').count()==0,name

    box=paper.bounding_box();first=word.bounding_box()
    assert box and first,(name,box,first)
    assert first['x']>=box['x']-15,(name,'Word extends outside left',box,first)
    if name=='desktop':
        assert first['x']+first['width']<=box['x']+box['width']+18,(
            name,'Word cut off on right',box,first)
        assert abs((first['x']+first['width']/2)-(box['x']+box['width']/2))<=32,(
            name,'Word not centered',box,first)
    view=page.locator('.hhba-match-modal-editor .hhba-match-modal-content').bounding_box()
    assert view,(name,'missing document workspace')
    ratio=box['width']/view['width']
    if name=='desktop':
        assert .55<=ratio<=.68,(name,'paper should be about 60-65% workspace',ratio,box,view)
        assert first['width']>=600,(name,'Word too small to read',first)
        assert first['height']>paper.bounding_box()['height'],(
            name,'height should scroll, not shrink entire page')
    else:
        assert .85<=ratio<=1.05,(name,'mobile paper should use available width',ratio)
        # A readable phone document can be panned INSIDE the Word reader.
        assert first['width']>=470,(name,'phone Word was shrunk too far',first)
        assert paper.evaluate('(el)=>el.scrollWidth>el.clientWidth+30'),(
            name,'phone needs horizontal in-document panning')
    assert not page.evaluate('document.documentElement.scrollWidth>window.innerWidth+2'),(
        name,'browser horizontal overflow')

    anchors=page.locator('.hhba-original-resume-anchor:not(.has-ai-preview)')
    assert anchors.count()>0,name
    style=anchors.first.evaluate('(el)=>({border:getComputedStyle(el).borderColor,background:getComputedStyle(el).backgroundColor})')
    assert style['border'] in ('rgba(0, 0, 0, 0)','transparent'),(name,style)
    assert style['background'] in ('rgba(0, 0, 0, 0)','transparent'),(name,style)
    page.screenshot(path=str(OUT/f'{name}-word-first.png'),animations='disabled')

    page.get_by_role('button',name='修改这段 Word').first.click(timeout=15000)
    editor=page.locator('.hhba-word-standalone-edit-panel')
    editor.wait_for(state='visible',timeout=12000)
    assert editor.evaluate('(el)=>getComputedStyle(el).position')!='fixed'
    assert page.locator('.hhba-word-siri-edit-float').count()==0
    page.get_by_role('button',name='取消修改').click()

    # No hidden drawer: only an explicit short dialog on the FIRST AI call.
    page.get_by_role('button',name='开始 AI 优化简历').click()
    consent=page.get_by_role('dialog',name='开始 AI 优化简历')
    consent.wait_for(state='visible',timeout=8000)
    assert edits==[],(name,'AI request before consent',edits)
    assert consent.get_by_role('button',name='同意并开始').is_disabled()
    page.screenshot(path=str(OUT/f'{name}-first-consent.png'),animations='disabled')
    consent.locator('input[type=checkbox]').check()
    consent.get_by_role('button',name='同意并开始').click()
    consent.wait_for(state='hidden',timeout=10000)
    page.wait_for_function('() => document.querySelector(".hhba-word-primary-action")?.disabled===false',timeout=16000)
    assert len(edits)==1,(name,'AI should run once, only after consent',edits)
    # The AI suggestion must be visible IN the Word itself, with Siri action
    # controls, not merely stored in an unavailable bottom list.
    siri=page.get_by_role('button',name='查看此处文字操作')
    siri.first.wait_for(state='visible',timeout=18000)
    page.screenshot(path=str(OUT/f'{name}-siri-in-word.png'),animations='disabled')
    siri.first.click(timeout=12000)
    action_group=page.get_by_role('group',name='当前彩虹文字操作')
    action_group.wait_for(state='visible',timeout=10000)
    assert action_group.get_by_role('button',name='采纳').count()==1
    assert action_group.get_by_role('button',name='编辑').count()==1
    assert action_group.get_by_role('button',name='忽略').count()==1
    assert word.is_visible(),(name,'Word disappeared after AI call')
    assert not errors,(name,errors)
    REPORT.append({'viewport':name,'wordCentered':True,'widthRatio':round(ratio,3),
                   'paperWidth':round(first['width']),
                   'noExtraPanels':True,'normalWordScroll':True,
                   'inFlowEditor':True,'consentBeforeAI':True,
                   'aiRequests':len(edits),'siriInOriginalWord':True,
                   'scriptErrors':errors})
    ctx.close()

with sync_playwright() as play:
    browser=play.chromium.launch(headless=True,args=['--no-sandbox'])
    exercise(browser,'desktop',{'width':1440,'height':900})
    exercise(browser,'mobile',{'width':390,'height':844})
    browser.close()
(OUT/'report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
print('HHBA_MINIMAL_CENTERED_WORD_QA_PASS',json.dumps(REPORT,ensure_ascii=False))
