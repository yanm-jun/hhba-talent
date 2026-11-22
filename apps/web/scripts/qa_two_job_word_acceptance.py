"""Real browser, React history/Word optimizer, strictly synthetic account and local mock APIs.
Run from apps/web with the existing qa-history-word-workspace.html Vite fixture.
Optional HHBA_ACCEPTANCE_JOBS_JSON: path to an array or {jobs|matches: array};
first two rows must supply company, title, official_url, jd_version_id, jd_sha256,
match_score. full_jd/location are optional. No network navigation to those URLs.
"""
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import sync_playwright

ORIGIN = 'http://127.0.0.1:4173'
RESUME = '11111111-2222-4333-8444-555555555555'
HISTORY = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
WORD_PATH = Path('public/__hhba_word_qa.docx')
TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
ORIGINAL = '负责门店运营及日常数据整理工作'
PROPOSALS = ['负责整理门店运营与例行数据', '负责门店日常管理与运营统计']
KIND = 'HHBA_VERIFIED_JOB_JD_V1'

def load_jobs():
    source = os.environ.get('HHBA_ACCEPTANCE_JOBS_JSON')
    if source:
        raw = json.loads(Path(source).read_text())
        rows = raw if isinstance(raw,list) else raw.get('verified',raw.get('jobs',raw.get('matches')))
    else:
        rows = [dict(company='虚构雇主'+str(i+1),title='测试督导'+str(i+1),
                     official_url='https://jobs.example.org/hhba-qa-'+str(i+1),
                     jd_version_id='jd_'+c*32,
                     jd_sha256=sha256(('fixture-jd-'+c).encode()).hexdigest(),
                     match_score=76+i*12) for i,c in enumerate('ab')]
    assert len(rows)>=2, 'Expected two verified JD rows'
    jobs=[]
    for i,row in enumerate(rows[:2]):
        assert all(isinstance(row.get(k),str) and row[k].strip()
                   for k in ('company','title','official_url','jd_version_id','jd_sha256'))
        parsed=urlsplit(row['official_url'])
        assert parsed.scheme=='https' and parsed.hostname and not parsed.username and not parsed.fragment
        assert re.fullmatch('jd_[a-f0-9]{32}',row['jd_version_id'])
        assert re.fullmatch('[a-f0-9]{64}',row['jd_sha256'])
        assert isinstance(row['match_score'],int) and 0<=row['match_score']<=100
        if row.get('full_jd'):
            assert sha256(row['full_jd'].encode()).hexdigest()==row['jd_sha256'], 'JD contents must match their pin'
        jobs.append({**row,'id':row.get('id') or 'mock-result-'+str(i),'location':row.get('location','上海'),
                     'availability_status':'UNKNOWN','recruitment_source_kind':row.get('recruitment_source_kind') or 'EMPLOYER_DOMAIN_CANDIDATE',
                     'recruitment_source_note':'已核验的企业详情','score_basis':'岗位定向测试'})
    for key in ['official_url','jd_version_id','jd_sha256']:
        assert len({job[key] for job in jobs})==2,'Distinct '+key+' required'
    return jobs

def patch_word(target, path):
    subprocess.run(['node','--input-type=module','-e',"""
import { readFileSync,writeFileSync } from 'node:fs';
import { editOriginalDocxStrict } from './src/services/resumeDocxPreserve.mjs';
const [input,output,original,text]=process.argv.slice(1);
writeFileSync(output,await editOriginalDocxStrict(new Uint8Array(readFileSync(input)),
  [{original,text}],{allowExpansion:true}));
""",str(WORD_PATH),str(path),ORIGINAL,target],check=True)
    return path.read_bytes()

def run(browser, jobs, original, variants, viewport):
    context=browser.new_context(viewport=viewport,locale='zh-CN',accept_downloads=True)
    page=context.new_page()
    page.add_init_script("localStorage.setItem('hhba_real_auth_token','SYNTHETIC_QA_USER')")
    revisions, archive_reads, ai_calls, errors, unexpected = {}, [], [], [], []
    page.on('pageerror',lambda e:errors.append(str(e)))
    resume={'id':RESUME,'name':'HHBA-SYNTHETIC-QA.docx','type':TYPE,'size':len(original),
            'createdAt':'2026-11-21T10:00:00.000Z'}
    report={'id':HISTORY,'resume_id':RESUME,'resume_label':resume['name'],
            'role_hint':'督导','created_at':'2026-11-21T10:00:00.000Z','job_count':2,
            'best_score':max(j['match_score'] for j in jobs),'new_job_count':0,'improved_job_count':0}
    scope_script="""
import {stablePostingScope} from './src/services/stablePostingScope.mjs';
process.stdout.write(JSON.stringify(process.argv.slice(1).map(stablePostingScope)));
"""
    scopes=json.loads(subprocess.check_output(['node','--input-type=module','-e',scope_script,
                                             *[j['official_url'] for j in jobs]]))
    assert len(set(scopes))==2 and all(scopes)
    history_kind='HHBA_ACCOUNT_MATCH_HISTORY_V1'
    def mock(route):
        req=route.request
        url=urlsplit(req.url)
        if url.netloc!=urlsplit(ORIGIN).netloc:
            # Vite/component assets may reference external fonts/branding.
            # Block everything outbound, especially all actual employer visits.
            return route.abort()
        if not url.path.startswith('/api/'):
            return route.continue_()
        def j(value,status=200):
            route.fulfill(status=status,content_type='application/json',
                          body=json.dumps(value,ensure_ascii=False))
        args={k:v[0] for k,v in parse_qs(url.query).items()}
        if url.path=='/api/match-history':
            return j({'ok':True,'kind':history_kind,'items':[report]})
        if url.path=='/api/match-history/'+HISTORY:
            return j({'ok':True,'kind':history_kind,'item':{**report,'matches':jobs}})
        if url.path=='/api/resumes':
            return j({'ok':True,'kind':'HHBA_PRIVATE_RESUME_VAULT_V1','items':[resume]})
        if url.path=='/api/job-jd':
            if req.method!='GET':
                unexpected.append(req.url);return j({'ok':False},405)
            if not args:
                return j({'kind':KIND,'enabled':True})
            assert set(args)=={'jd_id'}, 'Editing must use immutable JD by ID, never re-fetch'
            ver=args['jd_id']
            i=next(k for k,job in enumerate(jobs) if job['jd_version_id']==ver)
            job=jobs[i]
            archive_reads.append(ver)
            return j({'ok':True,'kind':KIND,'verified':True,'job_id':ver,
                     'canonical_url':job['official_url'],'jd_sha256':job['jd_sha256'],
                     'fresh':True,'title':job['title'],'company':job['company'],
                     'location':job['location'],'content_status':'VERIFIED_SECTIONS',
                     'proof_method':job.get('proof_method') or 'DIRECT_EMPLOYER_HTML_V1','full_jd':job.get('full_jd') or
                     ('岗位职责：负责运营。任职要求：整理数据。独立归档标记 '+ver),
                     'sections':[{'id':'req','kind':'requirements','text':'整理运营数据'}]})
        if url.path=='/api/resume-optimize':
            if req.method=='GET':
                return j({'kind':'HHBA_RESUME_OPTIMIZATION_V1','enabled':True,'configured':True,
                          'per_account_daily_limit':3,'global_daily_limit':50,
                          'per_account_daily_attempt_limit':6,'global_daily_attempt_limit':120})
            payload=req.post_data_json
            i=next(k for k,job in enumerate(jobs)
                   if job['jd_version_id']==payload['job']['jd_version_id'])
            job=jobs[i]
            assert payload['consent_ai'] is True
            assert payload['job']['official_url']==job['official_url']
            assert payload['job']['requirements']==(job.get('full_jd') or
                    ('岗位职责：负责运营。任职要求：整理数据。独立归档标记 '+job['jd_version_id']))
            assert payload['blocks'][0]['text']==ORIGINAL
            ai_calls.append(i)
            return j({'ok':True,'suggestions':[{
              'id':'acceptance-'+str(i),'blockId':payload['blocks'][0]['id'],'action':'replace',
              'original':ORIGINAL,'proposed':PROPOSALS[i],
              'rationale':'仅重新组织真实文字','jobRequirement':'岗位要求运营数据',
              'evidenceStatus':'needs_user_confirmation'}]})
        if url.path=='/api/resume-word':
            if req.method=='POST':
                p=req.post_data_json
                assert p['action']=='edit' and p['resume_id']==RESUME and p['original']==ORIGINAL
                scope=p['job_id']
                i=scopes.index(scope)
                assert p['text']==PROPOSALS[i] and p['expected_revision']==0 and scope not in revisions
                assert p['consent_word_processing'] is True and p['confirmed_real'] is True
                assert p['client_docx_sha256']==sha256(variants[i]).hexdigest(),p['client_docx_sha256']
                revisions[scope]=i
                return j({'ok':True,'saved':True,'revision':1,'total_revisions':1})
            action=args['action']
            if action=='status':
                return j({'ok':True,'enabled':True,'renderer_enabled':False,'docx_only_enabled':True})
            assert args['resume_id']==RESUME and args['job_id'] in scopes,args
            scope=args['job_id']
            saved=scope in revisions
            hist=[{'revision':1,'original':ORIGINAL,'text':PROPOSALS[revisions[scope]],
                   'updated_at':resume['createdAt'],'page_count':None}] if saved else []
            if action=='inspect':
                return j({'ok':True,'editable_text':[hist[0]['text'] if saved else ORIGINAL],
                          'history':hist,'saved':{'revision':1} if saved else None,
                          'revision':int(saved),'total_revisions':int(saved),'max_revisions':8,
                          'max_daily_edits':6,'pdf_available':False,'layout_verified':False})
            assert action in ('source-docx','download'),action
            requested=int(args.get('revision',int(saved)))
            assert requested<=int(saved)
            return route.fulfill(status=200,body=variants[revisions[scope]] if requested else original,
                                 headers={'content-type':TYPE})
        if url.path.startswith('/api/match-native'):
            unexpected.append(req.url);return j({'ok':False},405)
        return j({'ok':True,'enabled':False,'configured':False,'items':[]})
    page.route('**/*',mock)

    def open_job(i):
        page.goto(ORIGIN+'/scripts/qa-history-word-workspace.html',wait_until='domcontentloaded')
        page.get_by_role('button',name='优化简历',exact=True).click(timeout=20000)
        popup=page.get_by_role('dialog',name='选择要优化的历史岗位')
        links=popup.get_by_role('link',name='查看原招聘页面（仍需确认在招）')
        links.first.wait_for(timeout=15000)
        assert [x.get_attribute('href') for x in links.all()]==[j['official_url'] for j in jobs]
        assert [x.get_attribute('target') for x in links.all()]==['_blank','_blank']
        popup.get_by_role('button',name='优化这个岗位的简历').nth(i).click()
        word=page.locator('section.hhba-native-docx').first
        word.wait_for(state='visible',timeout=35000)
        return word

    def save(i):
        word=open_job(i)
        assert ORIGINAL in word.inner_text() and all(x not in word.inner_text() for x in PROPOSALS)
        before=len(ai_calls)
        page.get_by_role('button',name='开始 AI 优化简历').click()
        consent=page.get_by_role('dialog',name='开始 AI 优化简历')
        consent.locator('input[type=checkbox]').check()
        assert len(ai_calls)==before
        consent.get_by_role('button',name='同意并开始').click()
        page.get_by_role('button',name='查看此处文字操作').first.click(timeout=25000)
        actions=page.get_by_role('group',name='当前彩虹文字操作')
        page.once('dialog',lambda dialog:dialog.accept())
        actions.get_by_role('button',name='采纳').click(timeout=15000)
        page.get_by_text('已采纳并保存原格式 Word。',exact=False).wait_for(timeout=20000)
        assert revisions[scopes[i]]==i

    def verify(i):
        word=open_job(i)
        body=word.inner_text()
        assert PROPOSALS[i] in body and ORIGINAL not in body and PROPOSALS[1-i] not in body
        with page.expect_download(timeout=15000) as done:
            page.get_by_role('button',name='保存 Word').click()
        assert sha256(Path(done.value.path()).read_bytes()).digest()==sha256(variants[i]).digest()

    save(0)
    save(1)  # still opens the original after A was saved
    verify(0)
    verify(1)
    assert ai_calls==[0,1] and archive_reads==[j['jd_version_id'] for j in jobs]
    assert len(revisions)==2 and not errors and not unexpected,(errors,unexpected)
    context.close()
    return {'viewport':viewport,'sameOriginal':True,'separatePostingScopes':True,
            'immutableJdReads':len(archive_reads),'independentReloadedDownloads':2,
            'onlyVerifiedOfficialLinks':True,'noAdditionalJobSearch':True}

def main():
    jobs=load_jobs()
    original=WORD_PATH.read_bytes()
    with tempfile.TemporaryDirectory(prefix='hhba-two-word-') as folder:
        variants=[patch_word(t,Path(folder)/('edited-'+str(i)+'.docx'))
                  for i,t in enumerate(PROPOSALS)]
        assert len({sha256(x).digest() for x in [original,*variants]})==3
        with sync_playwright() as play:
            browser=play.chromium.launch(headless=True,args=['--no-sandbox'],
                executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH') or None)
            reports=[run(browser,jobs,original,variants,viewport)
                     for viewport in [{'width':1440,'height':900},{'width':390,'height':844}]]
            browser.close()
    assert WORD_PATH.read_bytes()==original
    print('HHBA_TWO_JOB_WORD_ACCEPTANCE_PASS',json.dumps(reports,ensure_ascii=False))

if __name__=='__main__':
    main()
