"""Acceptance for the centered modal and real winter opportunities page."""
from urllib.request import urlopen
import os, time
from playwright.sync_api import sync_playwright
BASE=os.environ.get('HHBA_WINTER_URL','http://127.0.0.1:4173/hhba-talent/')
for _ in range(30):
    try:
        if urlopen(BASE,timeout=2).status==200:break
    except Exception:
        time.sleep(.4)
else:raise RuntimeError('preview not serving')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    desktop=browser.new_context(viewport={"width":1440,"height":900})
    page=desktop.new_page()
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
    dialog=page.locator('[data-hhba-winter-modal] [role=dialog]')
    dialog.wait_for(timeout=60000)
    box=dialog.bounding_box()
    assert box is not None
    assert 770 <= box['width'] <= 790, f"desktop popup too large: {box}"
    assert 440 <= box['height'] <= 460, f"desktop popup too tall: {box}"
    assert abs(box['x']-(1440-box['width'])/2)<3
    assert abs(box['y']-(900-box['height'])/2)<3
    assert dialog.get_by_role('link',name='立即参加').is_visible()
    checkbox=dialog.get_by_role('checkbox',name='不再显示寒假实习广告')
    assert checkbox.is_visible()
    assert not checkbox.is_checked(), 'do not opt out without explicit consent'
    # The old public letter is retained in the middle of the homepage, but
    # must not open automatically while the winter advert is visible.
    assert page.locator('.hhba-letter-overlay').count()==0
    assert page.get_by_role('button',name='读一封来自 HHBA 的信').is_visible()
    page.screenshot(path='/tmp/hhba-winter-modal-desktop.png',full_page=False)
    dialog.get_by_role('link',name='立即参加').click()
    page.get_by_role('heading',name='探索寒假实习机会').wait_for(timeout=60000)
    assert '/winter-internship' in page.url
    assert page.evaluate("localStorage.getItem('hhba:winter-internship-2027:hide:v1')") is None
    assert page.locator('[data-winter-program]').count()==7
    page.screenshot(path='/tmp/hhba-winter-directory-desktop.png',full_page=False)
    # New 3-company batch: real details and source-specific caution text.
    for identifier in ['ey-china-winter-2027-review','pwc-hk-2027-winter','hsbc-hk-2027-work-placement']:
        assert page.locator(f'[data-winter-program="{identifier}"]').count()==1,identifier
    page.locator('[data-winter-program="hsbc-hk-2027-work-placement"]').get_by_role('link',name='查看项目详情与申请方法').click()
    assert 'hsbc-hk-2027-work-placement' in page.url
    assert page.get_by_text('需要现有合法香港工作资格',exact=False).count()>0
    assert page.get_by_text('截止日期出现不一致',exact=False).count()>0
    page.get_by_role('link',name='返回寒假实习专区').click()
    page.locator('[data-winter-program="pwc-hk-2027-winter"]').get_by_role('link',name='查看项目详情与申请方法').click()
    assert page.get_by_role('link',name='查看补充招聘证据').get_attribute('href').startswith('https://pip.erg.cuhk.edu.hk/')
    page.get_by_role('link',name='返回寒假实习专区').click()
    page.locator('[data-winter-program="ey-china-winter-2027-review"]').get_by_role('link',name='查看项目详情与申请方法').click()
    assert page.get_by_text('2026—2027 具体实习日期尚待官方岗位确认',exact=False).count()>0
    page.get_by_role('link',name='返回寒假实习专区').click()
    page.get_by_role('link',name='查看项目详情与申请方法').first.click()
    page.get_by_text('前往企业官方招聘页面').wait_for(timeout=60000)
    assert '/winter-internship/' in page.url
    source=page.get_by_role('link',name='查看企业官方项目说明')
    assert source.get_attribute('href').startswith('https://')
    page.goto(BASE,wait_until='domcontentloaded')
    assert page.locator('[data-hhba-winter-modal]').count()==0,'should not reopen within same session'
    assert page.locator('.hhba-letter-overlay').count()==0,'letter must not auto-open'
    page.get_by_role('button',name='读一封来自 HHBA 的信').click()
    envelope=page.locator('.hhba-letter-overlay[data-stage=envelope]')
    envelope.wait_for(timeout=15000)
    page.locator('button[data-letter-open]').click()
    page.locator('.hhba-letter-paper').wait_for(timeout=15000)
    assert page.get_by_role('button',name='分享这封信').is_visible()
    assert page.get_by_role('button',name='复制链接').is_visible()
    page.screenshot(path='/tmp/hhba-winter-letter-manual-desktop.png',full_page=False)
    page.get_by_role('button',name='关闭公开信，进入首页').click()
    assert page.locator('.hhba-letter-overlay').count()==0
    page.reload()
    assert page.locator('.hhba-letter-overlay').count()==0,'manual letter should not reappear on reload'
    desktop.close()

    # Explicit public-letter share URLs still open the envelope directly;
    # the winter campaign must not overlay it, even for a new visitor.
    shared=browser.new_context(viewport={"width":1280,"height":800})
    shared_page=shared.new_page()
    shared_page.goto(BASE+'?letter=1',wait_until='domcontentloaded')
    shared_page.locator('.hhba-letter-overlay[data-stage=envelope]').wait_for(timeout=15000)
    assert shared_page.locator('[data-hhba-winter-modal]').count()==0
    shared.close()

    # An ordinary close suppresses the current tab only; it must not create a
    # persistent preference, and a new browser visit can see the campaign.
    ordinary=browser.new_context(viewport={"width":1280,"height":800})
    ordinary_page=ordinary.new_page()
    ordinary_page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
    ordinary_popup=ordinary_page.locator('[data-hhba-winter-modal] [role=dialog]')
    ordinary_popup.wait_for(timeout=15000)
    assert not ordinary_popup.get_by_role('checkbox',name='不再显示寒假实习广告').is_checked()
    ordinary_popup.get_by_role('button',name='关闭寒假实习广告').click()
    assert ordinary_page.evaluate("localStorage.getItem('hhba:winter-internship-2027:hide:v1')") is None
    ordinary_new=ordinary.new_page()
    ordinary_new.goto(BASE,wait_until='domcontentloaded',timeout=60000)
    ordinary_new.locator('[data-hhba-winter-modal] [role=dialog]').wait_for(timeout=15000)
    ordinary.close()

    # Explicitly ticking "don't show again" before closing persists across
    # navigations and even in a fresh browser context that carries site storage.
    preference=browser.new_context(viewport={"width":1280,"height":800})
    preference_page=preference.new_page()
    preference_page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
    preference_popup=preference_page.locator('[data-hhba-winter-modal] [role=dialog]')
    preference_popup.wait_for(timeout=15000)
    dont_show=preference_popup.get_by_role('checkbox',name='不再显示寒假实习广告')
    dont_show.check()
    assert dont_show.is_checked()
    preference_page.screenshot(path='/tmp/hhba-winter-optout-desktop.png',full_page=False)
    preference_popup.get_by_role('button',name='关闭寒假实习广告').click()
    assert preference_page.evaluate("localStorage.getItem('hhba:winter-internship-2027:hide:v1')")=='1'
    stored=preference.storage_state()
    persisted=browser.new_context(storage_state=stored,viewport={"width":1280,"height":800})
    persisted_page=persisted.new_page()
    persisted_page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
    assert persisted_page.locator('[data-hhba-winter-modal]').count()==0
    assert persisted_page.get_by_role('button',name='读一封来自 HHBA 的信').is_visible()
    persisted.close()
    preference.close()

    # Checking opt-out and selecting "Join" must save the preference as well.
    participate=browser.new_context(viewport={"width":1280,"height":800})
    participate_page=participate.new_page()
    participate_page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
    participate_popup=participate_page.locator('[data-hhba-winter-modal] [role=dialog]')
    participate_popup.wait_for(timeout=15000)
    participate_popup.get_by_role('checkbox',name='不再显示寒假实习广告').check()
    participate_popup.get_by_role('link',name='立即参加').click()
    participate_page.get_by_role('heading',name='探索寒假实习机会').wait_for(timeout=15000)
    assert participate_page.evaluate("localStorage.getItem('hhba:winter-internship-2027:hide:v1')")=='1'
    participate.close()

    mobile=browser.new_context(viewport={"width":390,"height":844},device_scale_factor=1,is_mobile=True,has_touch=True)
    page=mobile.new_page()
    page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
    popup=page.locator('[data-hhba-winter-modal] [role=dialog]')
    popup.wait_for(timeout=60000)
    mobile_box=popup.bounding_box()
    assert mobile_box is not None and mobile_box['width'] <= 390, f"popup overflows mobile viewport: {mobile_box}"
    assert mobile_box['height'] <= 844, f"popup is taller than mobile viewport: {mobile_box}"
    assert popup.get_by_role('link',name='立即参加').is_visible()
    assert popup.get_by_role('checkbox',name='不再显示寒假实习广告').is_visible()
    page.screenshot(path='/tmp/hhba-winter-modal-mobile.png',full_page=False)
    popup.get_by_role('button',name='关闭寒假实习广告').click()
    assert page.locator('[data-hhba-winter-modal]').count()==0
    assert page.locator('.hhba-letter-overlay').count()==0
    page.get_by_role('button',name='读一封来自 HHBA 的信').click()
    page.locator('.hhba-letter-overlay[data-stage=envelope]').wait_for(timeout=15000)
    page.locator('.hhba-letter-close').first.click()
    page.reload()
    assert page.locator('[data-hhba-winter-modal]').count()==0
    assert page.locator('.hhba-letter-overlay').count()==0
    mobile.close()
    assert not errors,errors
    print('HHBA_WINTER_CAMPAIGN_BROWSER_ACCEPTANCE_OK')
    browser.close()
