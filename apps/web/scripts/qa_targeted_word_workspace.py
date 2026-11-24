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
JD_ID='jd_'+'a'*32
JD_SHA='b'*64
JD='岗位职责\n负责门店日常运营与区域数据整理。\n任职要求\n门店运营管理与数据分析。'

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
        if path.endswith('/job-jd'):
            assert query.get('jd_id')==[JD_ID]
            return route.fulfill(json={'ok':True,'verified':True,'job_id':JD_ID,'jd_sha256':JD_SHA,
                'canonical_url':'https://jobs.example.org/synthetic-only','fresh':True,
                'title':'虚构运营督导','full_jd':JD,'sections':[]})
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
            assert payload['job']['jd_version_id']==JD_ID and payload['job']['jd_sha256']==JD_SHA
            assert payload['job']['requirements']==JD
            text=payload['blocks'][0]['text']
            assert payload['blocks'][0]['id']=='word-0',('not anchored Word',payload['blocks'])
            assert text=='负责门店运营及日常数据整理工作',('AI received wrong original text',text)
            edits.append({'job':payload['job']['title'],'blocks':len(payload['blocks'])})
            suggestion={'id':'siri-qa-1','blockId':'word-0','action':'replace',
                        'original':text,'proposed':'负责门店运营与业务数据整理，协助跟进区域经营数据与工作计划，围绕人员培养、客户沟通和门店运营提出改善建议，及时整理阶段性运营结果并进行内部汇报。',
                        'rationale':'只调整措辞，不增加经历或业绩',
                        'jobRequirement':'门店运营管理与数据分析',
                        'evidenceStatus':'needs_user_confirmation'}
            return route.fulfill(status=200,content_type='application/json',
                body=json.dumps({'ok':True,'suggestions':[suggestion],'pending_block_ids':[]}))
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
    # The JD cache status request adds an asynchronous step before the AI
    # suggestion call. Wait for the ACTUAL Word suggestion instead of assuming
    # the toolbar's enabled state means that the network round-trip finished.
    siri=page.get_by_role('button',name='查看此处文字操作')
    siri.first.wait_for(state='visible',timeout=22000)
    assert len(edits)==1,(name,'AI should run once, only after consent',edits)
    page.wait_for_function('() => document.querySelector(".hhba-word-primary-action")?.disabled===false',timeout=16000)
    # The Word page (not the entire blank workspace) always has a quiet
    # perimeter glow, with one slow orbiting beam even before AI is enabled.
    ring=word.evaluate('el=>({before:getComputedStyle(el,"::before").content,'
        'beam:getComputedStyle(el,"::after").animationDuration,'
        'breath:getComputedStyle(el,"::before").animationDuration})')
    assert ring['before']!='none' and '36s' in ring['beam'] and '11s' in ring['breath'],(
        name,'missing slow, always-on Siri border beam',ring)
    assert page.locator('.hhba-original-resume-siri-stage.hhba-siri-edge-active').count()==0,(
        name,'entire blank workspace must not glow')
    assert page.locator('.hhba-browser-word-overlay .hhba-word-ai-preview').count()==0,(
        name,'a second absolute text layer obscures the original Word')
    native=word.locator('span.hhba-word-inline-suggestion').first
    assert native.count()==1,(name,'AI suggestion not inline in original DOCX run')
    changed=native.locator('.hhba-word-ai-changed')
    assert changed.count()==1,(name,'missing Siri gradient on native Word glyphs')
    style=native.evaluate('(node)=>({parentFont:getComputedStyle(node).fontSize,'
       'changedFont:getComputedStyle(node.querySelector(".hhba-word-ai-changed")).fontSize,'
       'parentWeight:getComputedStyle(node).fontWeight,'
       'changedWeight:getComputedStyle(node.querySelector(".hhba-word-ai-changed")).fontWeight,'
       'display:getComputedStyle(node.querySelector(".hhba-word-ai-changed")).display,'
       'lineHeight:getComputedStyle(node).lineHeight,'
       'changedLineHeight:getComputedStyle(node.querySelector(".hhba-word-ai-changed")).lineHeight})')
    assert style['parentFont']==style['changedFont'] and style['parentWeight']==style['changedWeight'],(
        name,'inline AI text must inherit original run font',style)
    assert style['lineHeight']==style['changedLineHeight'] and style['display']=='inline',(
        name,'AI text must wrap naturally with the native paragraph',style)
    text_content=word.inner_text()
    assert '协助跟进区域经营数据与工作计划' in text_content,(name,'proposed wording not in native document')
    assert '负责门店运营及日常数据整理工作' not in text_content,(
        name,'source and proposed text are duplicated on page')
    box_style=siri.first.evaluate('(el)=>({background:getComputedStyle(el).backgroundColor,'
      'border:getComputedStyle(el).borderTopColor})')
    assert box_style['background'] in ('rgba(0, 0, 0, 0)','transparent'),(
        name,'colored covering rectangle still present',box_style)
    # A successful AI generation should not add an extra status panel
    # beneath the deliberately minimal bottom toolbar.
    success_message=page.locator('.hhba-word-minimal-message:not(.is-error)')
    if success_message.count():
        assert success_message.evaluate('(el)=>getComputedStyle(el).clipPath')=='inset(50%)'
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


def exercise_readonly(browser,name,viewport,status_failure):
    """A 503 or disabled Word service must still display the real local DOCX."""
    import hashlib
    ctx=browser.new_context(viewport=viewport,locale='zh-CN',
        device_scale_factor=1,accept_downloads=True)
    page=ctx.new_page()
    page.add_init_script("localStorage.setItem('hhba_real_auth_token','SYNTHETIC_QA_USER')")
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    ai_requests=[]

    def api(route):
        req=route.request
        url=urlsplit(req.url)
        query=parse_qs(url.query)
        action=query.get('action',[''])[0]
        if url.path.endswith('/resume-word') and action=='status':
            return route.fulfill(status=503 if status_failure else 200,
                content_type='application/json',
                body=json.dumps({'ok':not status_failure,'enabled':False,
                    'renderer_enabled':False,'docx_only_enabled':False}))
        if url.path.startswith('/api/resumes/') and url.path.endswith('/download'):
            return route.fulfill(status=200,body=WORD,headers={
                'content-type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'content-length':str(len(WORD))})
        if url.path.endswith('/resume-optimize'):
            if req.method=='POST':ai_requests.append(req.post_data)
            return route.fulfill(status=200,content_type='application/json',
                body=json.dumps({'enabled':True,'configured':True,'ok':True}))
        return route.fulfill(status=200,content_type='application/json',
            body=json.dumps({'ok':True,'enabled':False,'items':[]}))

    page.route('**/api/**',api)
    page.goto(ORIGIN+'/scripts/qa-targeted-word-workspace.html',wait_until='domcontentloaded')
    page.get_by_role('button',name='针对虚构运营督导优化简历').click(timeout=18000)
    word=page.locator('.targeted-resume.is-word-first section.hhba-native-docx').first
    word.wait_for(state='visible',timeout=35000)
    assert '负责门店运营及日常数据整理工作' in word.inner_text(),(
        name,'Real DOCX text missing in fallback')
    page.get_by_text('Word 编辑服务暂不可用',exact=False).wait_for(timeout=12000)
    assert page.locator('.hhba-original-resume-anchor').count()==0,(
        name,'Read-only Word must not expose write anchors')
    assert page.get_by_role('button',name='开始 AI 优化简历').is_disabled(),(
        name,'AI must not run without verified Word anchors')
    assert ai_requests==[],(name,'Read-only mode sent resume text to AI')
    assert page.get_by_role('button',name='保存 Word').is_visible(),name
    with page.expect_download(timeout=15000) as pending:
        page.get_by_role('button',name='保存 Word').click()
    assert hashlib.sha256(Path(pending.value.path()).read_bytes()).digest()==hashlib.sha256(WORD).digest(),(
        name,'Readonly download was not the exact private original')
    assert not errors,(name,errors)
    page.screenshot(path=str(OUT/f'{name}-real-docx-readonly.png'),animations='disabled')
    REPORT.append({'viewport':name,'realDocxLocalFallback':True,
        'wordService':('503' if status_failure else 'disabled'),
        'unchangedOriginalDownload':True,'noUnverifiedEditsOrAiRequests':True,'scriptErrors':errors})
    ctx.close()

with sync_playwright() as play:
    browser=play.chromium.launch(headless=True,args=['--no-sandbox'])
    exercise(browser,'desktop',{'width':1440,'height':900})
    exercise(browser,'mobile',{'width':390,'height':844})
    exercise_readonly(browser,'desktop',{'width':1440,'height':900},True)
    exercise_readonly(browser,'mobile',{'width':390,'height':844},False)
    browser.close()
(OUT/'report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
print('HHBA_MINIMAL_CENTERED_WORD_QA_PASS',json.dumps(REPORT,ensure_ascii=False))
