"""Actual Chromium DOM observer acceptance for opt-in applicant submission tracking.

Synthetic ATS only. All traffic is Playwright-intercepted, no external
site/real candidate data/ATS credentials are contacted or stored.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
SOURCE=Path(__file__).resolve().parent
CODE=(SOURCE.parent/'content.js').read_text('utf-8')
HTML=(SOURCE/'application-submission-synthetic.html').read_text('utf-8')
HOST='https://apply.example.invalid'
def main():
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True)
  page=browser.new_page()
  page.route(HOST+'/**',lambda r:r.fulfill(status=200,content_type='text/html; charset=utf-8',body=HTML))
  def open_case(mode):
   page.goto(HOST+'/apply/'+mode+'?ticket=SECRET-NOT-TO-PERSIST')
   page.evaluate("""() => {
    window.__data={};
    window.chrome={runtime:{onMessage:{addListener(fn){window.__handler=fn;}}},
      storage:{local:{
       async get(key){return {[key]:window.__data[key]};},
       async set(values){Object.assign(window.__data,values);}
      }}
    };
   }""")
   page.add_script_tag(content=CODE)
  def send(kind,**params):
   return page.evaluate("""async({kind,params})=>new Promise((resolve,reject)=>{
    const h=setTimeout(()=>reject(Error('agent timeout')),6000);
    window.__handler({type:kind,...params},{},x=>{clearTimeout(h);resolve(x)});
   })""",{'kind':kind,'params':params})
  def records():
   return page.evaluate("()=>window.__data['hhba.apply.application-local.v1']||[]")
  def arm():
   return send('HHBA_TRACK_START',company='示例企业',position='实习岗位',consent=True)
  open_case('success')
  page.locator('#submit').click()
  page.wait_for_timeout(160)
  assert not records(),'No observation before explicit user opt-in'
  open_case('success')
  no_consent=send('HHBA_TRACK_START',company='示例企业',position='实习岗位',consent=False)
  assert not no_consent['ok']
  assert arm()['ok']
  page.locator('#submit').click()
  page.wait_for_function("()=>window.__data['hhba.apply.application-local.v1']?.[0]?.status==='confirmed'")
  row=records()[0]
  assert row['evidenceKind']=='success_notice',row
  assert row['company']=='示例企业' and row['position']=='实习岗位'
  assert row['applicationUrl']==HOST+'/apply/success',row
  assert 'SECRET-NOT-TO-PERSIST' not in str(row)
  assert 'SENSITIVE-DO-NOT-STORE' not in str(row)
  assert page.evaluate('window.submitCount')==1,'Extension must never submit the form'
  open_case('negative')
  assert arm()['ok']
  page.locator('#submit').click()
  page.wait_for_function("()=>window.__data['hhba.apply.application-local.v1']?.length>0")
  page.wait_for_timeout(200)
  assert records()[0]['status']=='pending',records()
  open_case('pending')
  assert arm()['ok']
  page.locator('#submit').click()
  page.wait_for_function("()=>window.__data['hhba.apply.application-local.v1']?.length>0")
  assert records()[0]['status']=='pending'
  open_case('preexisting')
  assert arm()['ok']
  page.locator('#submit').click()
  page.wait_for_function("()=>window.__data['hhba.apply.application-local.v1']?.length>0")
  assert records()[0]['status']=='pending','Existing success message cannot authenticate a new submission'
  # Explicit inspection can classify an already-visible success page,
  # but that is different from auto-observed after submit.
  reported=send('HHBA_APPLICATION_CHECK')
  assert reported['ok'] and reported['evidenceKind']=='success_notice'
  assert reported['applicationUrl']==HOST+'/apply/preexisting'
  browser.close()
  print('PASS: real Chromium current-page opt-in submissions, success/pending, anti-false-positive and no PII capture')
if __name__=='__main__':
 main()
