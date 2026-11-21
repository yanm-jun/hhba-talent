"""Actual React OriginalWordViewer + Siri interactions in real Chromium.
Only synthetic DOCX and intercepted API responses, never real credentials.
"""
import hashlib,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path('public')
original=(ROOT/'__hhba_word_qa.docx').read_bytes()
saved=(ROOT/'__hhba_word_qa_saved.docx').read_bytes()
meta=json.loads(Path('/tmp/hhba-word-react-fixture-hashes.json').read_text())
ORIGIN='http://127.0.0.1:4173'
DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
assert hashlib.sha256(original).hexdigest()==meta['original']
assert hashlib.sha256(saved).hexdigest()==meta['saved']
artifacts=Path('/tmp/hhba-word-react-qa')
artifacts.mkdir(exist_ok=True)
results=[]

def exercise(browser,label,viewport):
    active={'role-A':0,'role-B':0}
    history={'role-A':0,'role-B':0}
    audit=[]
    page=browser.new_page(viewport=viewport,locale='zh-CN',accept_downloads=True)
    page.add_init_script("localStorage.setItem('hhba_real_auth_token','SYNTHETIC_REACT_QA_TOKEN')")
    dialogs=[]
    page.on('dialog',lambda dialog:(dialogs.append(dialog.message),dialog.accept()))

    def route(request):
        r=request.request
        url=r.url
        from urllib.parse import urlsplit,parse_qs
        query=parse_qs(urlsplit(url).query)
        action=query.get('action',[''])[0]
        job=query.get('job_id',['role-A'])[0]
        if r.method=='POST':
            b=r.post_data_json
            job=b.get('job_id','role-A')
            action=b.get('action','edit')
        assert job in active
        def j(status,obj):
            request.fulfill(status=status,content_type='application/json',
                            body=json.dumps(obj,ensure_ascii=False))
        def doc(content):
            request.fulfill(status=200,body=content,
                            headers={'content-type':DOCX_MIME,
                                     'content-disposition':'attachment; filename="HHBA-test.docx"'})
        if action=='status':
            return j(200,{'ok':True,'enabled':True,'renderer_enabled':False,'docx_only_enabled':True})
        if action=='inspect':
            entries=[{'revision':1,'original':meta['originalText'],'text':meta['savedText'],
                      'updated_at':'2026-11-21T00:00:00.000Z','page_count':None,'layout_verified':False}]
            return j(200,{'ok':True,'editable_text':[meta['originalText']] if active[job]==0 else [meta['savedText']],
                          'saved':None if active[job]==0 else {'original':meta['originalText'],'text':meta['savedText'],
                          'updated_at':'2026-11-21T00:00:00.000Z'},
                          'revision':active[job],'total_revisions':history[job],
                          'layout_verified':False,'pdf_available':False,'history':entries if history[job] else [],
                          'max_revisions':8,'max_daily_edits':6})
        if action=='source-docx':
            rev=query.get('revision',[str(active[job])])[0]
            if str(active[job])!=rev:return j(409,{'ok':False,'error':'WORD_REVISION_CONFLICT'})
            return doc(saved if active[job] else original)
        if action=='download':
            if active[job]==0:return j(404,{'ok':False,'error':'WORD_NOT_EDITED'})
            audit.append(job+':download')
            return doc(saved)
        if action in ('preview','download-pdf','edited-preview'):
            return j(422,{'ok':False,'error':'WORD_PDF_NOT_READY'})
        if action=='edit':
            assert b.get('expected_revision')==active[job],b
            assert b.get('original')==meta['originalText'],b
            assert b.get('text')==meta['savedText'],b
            assert b.get('client_docx_sha256')==meta['saved'],b
            assert b.get('confirmed_real') is True and b.get('consent_word_processing') is True,b
            active[job]=history[job]=1
            audit.append(job+':save')
            return j(200,{'ok':True,'saved':True,'revision':1,'total_revisions':1,
                          'page_count':None,'layout_verified':False,'pdf_available':False})
        if action in ('undo','redo'):
            assert b.get('expected_revision')==active[job]
            active[job]=0 if action=='undo' else 1
            audit.append(job+':'+action)
            return j(200,{'ok':True,'saved':bool(active[job]),'revision':active[job],
                          'total_revisions':history[job],'page_count':None,
                          'layout_verified':False,'pdf_available':False})
        raise AssertionError('Unexpected Word endpoint action '+action)

    page.route('**/api/resume-word**',route)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(ORIGIN+'/scripts/qa-actual-word-viewer.html',wait_until='domcontentloaded')
    def wait_anchor():
        page.get_by_role('button',name='查看此处文字操作').first.wait_for(timeout=25000)
    def accept():
        wait_anchor()
        page.get_by_role('button',name='查看此处文字操作').first.click(timeout=20000)
        page.get_by_role('button',name='采纳').first.click(timeout=20000)
        page.get_by_text('已采纳并保存原格式 Word',exact=False).wait_for(timeout=25000)
    def download(expected_digest):
        page.locator('summary').filter(has_text='导出').click()
        with page.expect_download(timeout=20000) as info:
            page.get_by_role('button',name='下载 Word').click()
        content=Path(info.value.path()).read_bytes()
        assert hashlib.sha256(content).hexdigest()==expected_digest,(label,'unexpected downloaded DOCX')
        assert page.get_by_role('button',name='下载 PDF').count()==1
        assert page.get_by_role('button',name='下载 PDF').is_disabled()

    accept();download(meta['saved'])
    page.get_by_role('button',name='切换岗位乙').click()
    page.get_by_test_id('active-job').get_by_text('role-B').wait_for(timeout=8000)
    accept();download(meta['saved'])
    page.get_by_role('button',name='切换岗位甲').click()
    page.get_by_text('当前修改进度：1 / 1').first.wait_for(timeout=20000)
    page.get_by_role('button',name='撤销',exact=True).first.click()
    page.get_by_text('当前修改进度：0 / 1').first.wait_for(timeout=20000)
    page.get_by_role('button',name='重做',exact=True).first.click()
    page.get_by_text('当前修改进度：1 / 1').first.wait_for(timeout=20000)
    assert len(dialogs)>=2,(label,dialogs)
    assert audit.count('role-A:save')==1 and audit.count('role-B:save')==1,audit
    assert active['role-A']==1 and active['role-B']==1,audit
    assert 'role-A:undo' in audit and 'role-A:redo' in audit,audit
    assert not errors,errors
    page.screenshot(path=str(artifacts/f'actual-word-viewer-{label}.png'),full_page=True,animations='disabled')
    results.append({'viewport':label,'passed':True,'audit':audit,'confirmDialogs':len(dialogs),
                    'downloadedHashesValidated':2,'pdfBlocked':True,'errors':errors})
    page.close()

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,args=['--no-sandbox'])
    exercise(browser,'desktop',{'width':1440,'height':900})
    exercise(browser,'mobile',{'width':390,'height':844})
    browser.close()
(artifacts/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('HHBA_ACTUAL_REACT_WORD_E2E_PASS',json.dumps(results,ensure_ascii=False))
