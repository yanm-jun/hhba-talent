"""Real Chromium QA: Word opening state stays centered and Siri rim is visible.
Synthetic private DOCX only; neither live accounts nor real candidate files.
"""
import asyncio
import json
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from playwright.async_api import async_playwright

ORIGIN='http://127.0.0.1:4173'
WORD=Path('public/__hhba_word_qa.docx').read_bytes()
OUT=Path('/tmp/hhba-word-loading-beam-qa')
OUT.mkdir(parents=True,exist_ok=True)
RESULTS=[]

async def exercise(browser,label,viewport):
    context=await browser.new_context(viewport=viewport,locale='zh-CN',device_scale_factor=1)
    page=await context.new_page()
    await page.add_init_script("localStorage.setItem('hhba_real_auth_token','SYNTHETIC_QA_USER')")
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))

    async def mock(route):
        url=urlsplit(route.request.url)
        path=url.path
        action=parse_qs(url.query).get('action',[''])[0]
        if path.endswith('/resume-word') and action=='status':
            # Keep the network request unresolved long enough to inspect the
            # real loading UI, not a fabricated/test-only DOM fragment.
            await asyncio.sleep(2.3)
            return await route.fulfill(status=200,content_type='application/json',
                body=json.dumps({'ok':True,'enabled':True,'renderer_enabled':False,'docx_only_enabled':True}))
        if path.endswith('/resume-word') and action=='inspect':
            return await route.fulfill(status=200,content_type='application/json',
                body=json.dumps({'ok':True,
                    'editable_text':['负责门店运营及日常数据整理工作'],
                    'saved':None,'revision':0,'total_revisions':0,'history':[],
                    'max_revisions':8,'max_daily_edits':6,
                    'pdf_available':False,'layout_verified':False}))
        if path.endswith('/resume-word') and action=='source-docx':
            return await route.fulfill(status=200,body=WORD,headers={
                'content-type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
        return await route.fulfill(status=200,content_type='application/json',
            body=json.dumps({'ok':True,'enabled':False,'configured':False,'items':[]}))

    await page.route('**/api/**',mock)
    await page.goto(ORIGIN+'/scripts/qa-targeted-word-workspace.html',
                    wait_until='domcontentloaded')
    await page.get_by_role('button',name='针对虚构运营督导优化简历').click(timeout=18000)
    loader=page.get_by_role('status').filter(has_text='正在打开简历…')
    await loader.wait_for(state='visible',timeout=15000)
    viewer=page.locator('.hhba-match-modal-editor .hhba-original-word-viewer').first
    bbox=await viewer.bounding_box()
    text=loader.locator('span').first
    text_box=await text.bounding_box()
    assert bbox and text_box,(label,'No loading bounds')
    cx=text_box['x']+text_box['width']/2
    cy=text_box['y']+text_box['height']/2
    expected_x=bbox['x']+bbox['width']/2
    expected_y=bbox['y']+(bbox['height']-58)/2+14
    # Loader icon above the words shifts text below group center by ~14px.
    assert abs(cx-expected_x)<22,(label,'loading label off-center horizontally',cx,expected_x)
    assert abs(cy-expected_y)<30,(label,'loading label off-center vertically',cy,expected_y)
    assert await page.get_by_role('button',name='开始 AI 优化简历').is_visible(),label
    await page.screenshot(path=str(OUT/(label+'-centered-loading.png')),animations='disabled')

    word=page.locator('.targeted-resume.is-word-first section.hhba-native-docx').first
    await word.wait_for(state='visible',timeout=35000)
    await loader.wait_for(state='hidden',timeout=15000)
    assert '负责门店运营及日常数据整理工作' in await word.inner_text(),label
    style=await word.evaluate("""node=>{
      const ring=getComputedStyle(node,'::before');
      const beam=getComputedStyle(node,'::after');
      return {
        border:ring.borderTopColor,
        shadow:ring.boxShadow,
        breath:ring.animationDuration,
        beamDuration:beam.animationDuration,
        beamOpacity:beam.opacity,
        beamFilter:beam.filter,
        beamImage:beam.backgroundImage,
        beamMask:beam.maskImage || beam.webkitMaskImage
      };
    }""")
    assert 'rgba(85, 148, 220, 0.52)' in style['border'],(label,'Soft rim not strong enough',style)
    assert 'rgba(88, 151, 236, 0.25)' in style['shadow'],(label,'Missing visible ambient glow',style)
    assert '10.5s' in style['breath'] and '36s' in style['beamDuration'],(label,'Wrong slow animation',style)
    assert float(style['beamOpacity'])>=.88,(label,'Moving highlight too dim',style)
    assert 'drop-shadow' in style['beamFilter'],(label,'Moving beam has no soft tail',style)
    assert 'conic-gradient' in style['beamImage'],(label,'No traveling highlight',style)
    assert style['beamMask']!='none',(label,'Light beam spills into document content',style)
    assert not errors,(label,'Browser JS errors',errors)
    await page.screenshot(path=str(OUT/(label+'-visible-siri-beam.png')),animations='disabled')
    RESULTS.append({'viewport':label,'loadingCentered':True,'loadingCleared':True,
        'siriRimVisible':True,'beamOrbitSeconds':36,'breathingSeconds':10.5,'errors':errors})
    await context.close()

async def main():
    async with async_playwright() as play:
        browser=await play.chromium.launch(headless=True,args=['--no-sandbox'])
        await exercise(browser,'desktop',{'width':1440,'height':900})
        await exercise(browser,'mobile',{'width':390,'height':844})
        await browser.close()
    (OUT/'report.json').write_text(json.dumps(RESULTS,ensure_ascii=False,indent=2))
    print('HHBA_WORD_CENTERED_LOADING_BEAM_PASS',json.dumps(RESULTS,ensure_ascii=False))

if __name__=='__main__':asyncio.run(main())
