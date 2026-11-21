"""QA the *real* HHBA match -> Word optimizer modal, not a redesign mock.
All DOCX/API responses are synthetic and intercepted on a local Vite server.
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
        request=route.request
        url=urlsplit(request.url)
        action=parse_qs(url.query).get('action',[''])[0]
        path=url.path
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
            raise AssertionError('unexpected Word API action '+action)
        if path.endswith('/resume-optimize'):
            if request.method=='GET':
                return route.fulfill(status=200,content_type='application/json',
                    body=json.dumps({'kind':'HHBA_RESUME_OPTIMIZATION_V1','enabled':True,'configured':True,
                        'per_account_daily_limit':3,'global_daily_limit':50,
                        'per_account_daily_attempt_limit':6,'global_daily_attempt_limit':120}))
            payload=request.post_data_json
            assert payload['consent_ai'] is True
            assert payload['job']['title']
            assert payload['blocks']
            edits.append({'job':payload['job']['title'],'blocks':len(payload['blocks'])})
            return route.fulfill(status=200,content_type='application/json',
                body=json.dumps({'ok':True,'suggestions':[]}))
        # Unrelated quota/readiness controls are disabled in this synthetic run.
        return route.fulfill(status=200,content_type='application/json',
            body=json.dumps({'ok':True,'enabled':False,'configured':False,'items':[]}))

    page.route('**/api/**',api)
    page.goto(ORIGIN+'/scripts/qa-targeted-word-workspace.html',wait_until='domcontentloaded')
    page.get_by_role('button',name='针对虚构运营督导优化简历').click(timeout=18000)
    paper=page.locator('.targeted-resume.is-word-first .hhba-browser-word-paper')
    word=page.locator('.targeted-resume.is-word-first section.hhba-native-docx').first
    word.wait_for(state='visible',timeout=35000)
    page.get_by_role('button',name='开始 AI 优化简历').wait_for(timeout=20000)
    page.wait_for_timeout(450)
    assert page.locator('.hhba-word-tools-scrim').count()==0,name
    rail=page.locator('#hhba-word-optimization-tools')
    assert not rail.is_visible(),name
    assert page.get_by_role('button',name='开始 AI 优化简历').is_enabled(),name

    # A native Word page should fit in the *visible* first viewport without a
    # horizontal cut-off. Other pages remain vertically scrollable.
    box=paper.bounding_box();first=word.bounding_box()
    assert box and first,(name,box,first)
    assert first['x']>=box['x']-12,(name,'Word extends left',box,first)
    assert first['x']+first['width']<=box['x']+box['width']+18,(name,'Word right edge cut off',box,first)
    assert first['y']+first['height']<=box['y']+box['height']+28,(name,'initial page not fitted',box,first)

    # Editing hit areas must stay clickable, but have no always-on rectangles.
    anchors=page.locator('.hhba-original-resume-anchor:not(.has-ai-preview)')
    assert anchors.count()>0,name
    style=anchors.first.evaluate('(el)=>({border:getComputedStyle(el).borderColor,background:getComputedStyle(el).backgroundColor})')
    assert style['border'] in ('rgba(0, 0, 0, 0)','transparent'),(name,style)
    assert style['background'] in ('rgba(0, 0, 0, 0)','transparent'),(name,style)
    page.screenshot(path=str(OUT/f'{name}-word-first.png'),animations='disabled')

    # Deliberate edit opens an editor in normal flow, never inside a fixed
    # drawer or on top of the document.
    page.get_by_role('button',name='修改这段 Word').first.click(timeout=15000)
    editor=page.locator('.hhba-word-standalone-edit-panel')
    editor.wait_for(state='visible',timeout=12000)
    assert editor.evaluate('(el)=>getComputedStyle(el).position')!='fixed'
    assert page.locator('.hhba-word-siri-edit-float').count()==0
    page.get_by_role('button',name='取消修改').click()

    # The primary action is visible and takes user to consent if needed.
    page.get_by_role('button',name='开始 AI 优化简历').click()
    rail.wait_for(state='visible',timeout=15000)
    assert rail.evaluate('(el)=>getComputedStyle(el).position')=='static',(name,'overlay returned')
    assert page.locator('.hhba-word-tools-scrim').count()==0
    page.screenshot(path=str(OUT/f'{name}-inline-settings.png'),animations='disabled')
    page.locator('.targeted-resume-consent input[type=checkbox]').check()
    page.get_by_role('button',name='生成本岗位建议').click(timeout=15000)
    page.wait_for_function('() => document.querySelector("#hhba-word-optimization-tools")?.getAttribute("aria-hidden")==="true"',{ 'timeout':15000 })
    assert len(edits)==1,(name,edits)
    assert word.is_visible(),(name,'Word disappeared after AI request')
    assert not errors,(name,errors)
    REPORT.append({'viewport':name,'wordFirst':True,'fullPageFits':True,
                   'noScrim':True,'noDefaultEditRectangles':True,
                   'inFlowEditor':True,'inFlowConsent':True,
                   'aiRequests':len(edits),'jsErrors':errors})
    ctx.close()

with sync_playwright() as play:
    browser=play.chromium.launch(headless=True,args=['--no-sandbox'])
    exercise(browser,'desktop',{'width':1440,'height':900})
    exercise(browser,'mobile',{'width':390,'height':844})
    browser.close()
(OUT/'report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
print('HHBA_REAL_TARGETED_WORD_UNOBSTRUCTED_PASS',json.dumps(REPORT,ensure_ascii=False))
