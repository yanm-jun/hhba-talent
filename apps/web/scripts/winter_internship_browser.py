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
    assert page.locator('[data-winter-job]').count()==10, '10 entries fit the first page, 12 verified-record rows total'
    assert page.locator('[data-winter-program]').count()==5, 'unverified programme references must be secondary'
    assert page.locator('[data-winter-program-archive]').get_attribute('open') is None
    page.screenshot(path='/tmp/hhba-winter-directory-desktop.png',full_page=False)
    # Verify compact job rows and the three distinct original employer job links.
    for jobid in ['apco-shanghai-winter-start-1787','hsbc-hk-student-placement-1367003857','qima-hk-sales-intern-744000154586189']:
        assert page.locator(f'[data-winter-job="{jobid}"]').count()==1, jobid
    assert page.get_by_role('heading',name='政府事务与战略传播实习生（2027 冬季入职）').is_visible()
    assert page.get_by_role('link',name='官网核实').count()==10
    # Multi-word search must match title, location and major, with no invented programme results.
    page.get_by_role('searchbox',name='搜索寒假实习具体岗位').fill('上海 传播')
    page.get_by_role('button',name='搜索岗位').click()
    assert page.locator('[data-winter-job]').count()==1
    assert page.locator('[data-winter-job="apco-shanghai-winter-start-1787"]').count()==1
    page.get_by_role('searchbox',name='搜索寒假实习具体岗位').fill('')
    page.get_by_role('button',name='搜索岗位').click()
    # Major matching: exact discipline first; unrestricted roles remain after relevant results.
    page.get_by_label('按专业筛选寒假岗位').select_option('传播学')
    assert page.locator('[data-winter-job]').count()>=3,'ReCube marketing plus unrestricted internships increase match count'
    assert page.locator('[data-winter-job]').first.get_attribute('data-winter-job')=='apco-shanghai-winter-start-1787'
    page.get_by_label('按地区筛选寒假岗位').select_option('中国香港')
    assert page.locator('[data-winter-job]').count()>=2,'ReCube marketing joins old Hong Kong records'
    page.get_by_role('button',name='重置').click()
    assert page.locator('[data-winter-job]').count()==10
    assert '25 条公开岗位及招聘批次结果' in page.locator('.hhba-winter-list-summary').inner_text()
    # Each real job opens a distinct internal role detail and first-party application URL.
    page.locator('[data-winter-job="hsbc-hk-student-placement-1367003857"]').get_by_role('link',name='岗位详情').click()
    assert 'hsbc-hk-student-placement-1367003857' in page.url
    assert page.get_by_text('需要现有合法香港工作资格',exact=False).count()>0 or page.get_by_text('必须具备合法香港工作资格',exact=False).count()>0
    assert page.get_by_text('官方截止日期出现不一致',exact=False).count()>0
    assert page.get_by_role('link',name='前往企业官方岗位核实及申请').get_attribute('href').startswith('https://apply.careers.hsbc.com/')
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.locator('[data-winter-job="qima-hk-sales-intern-744000154586189"]').get_by_role('link',name='岗位详情').click()
    assert page.get_by_text('1,200 欧元',exact=False).count()>0
    assert page.get_by_role('link',name='前往企业官方岗位核实及申请').get_attribute('href').startswith('https://jobs.smartrecruiters.com/QIMA/')
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.locator('[data-winter-job="apco-shanghai-winter-start-1787"]').get_by_role('link',name='岗位详情').click()
    assert 'apco-shanghai-winter-start-1787' in page.url
    assert page.get_by_role('link',name='前往企业官方岗位核实及申请').get_attribute('href').endswith('/1787')
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    # Batch 02: three companies and five independent official job descriptions.
    new_ids=[
        'bdo-hk-spring-assurance-2027',
        'bdo-hk-spring-it-audit-2027',
        'atkinsrealis-hk-winter-2027-r164310',
        'rsm-hk-spring-audit-assurance-2027',
        'rsm-hk-spring-tech-consulting-2027'
    ]
    for identifier in new_ids:
        assert page.locator(f'[data-winter-job="{identifier}"]').count()==1,identifier
    # One company may have multiple real posting URLs, not repeated company marketing cards.
    page.get_by_role('searchbox',name='搜索寒假实习具体岗位').fill('BDO IT')
    page.get_by_role('button',name='搜索岗位').click()
    assert page.locator('[data-winter-job]').count()==1
    assert page.locator('[data-winter-job="bdo-hk-spring-it-audit-2027"]').count()==1
    page.get_by_role('button',name='重置').click()
    page.locator('[data-winter-job="bdo-hk-spring-assurance-2027"]').get_by_role('link',name='岗位详情').click()
    assert 'bdo-hk-spring-assurance-2027' in page.url
    assert page.get_by_text('11 月 20 日',exact=False).count()>0
    assert page.get_by_role('link',name='前往企业官方岗位核实及申请').get_attribute('href').startswith('https://recruitment.bdo.com.hk/')
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.locator('[data-winter-job="bdo-hk-spring-it-audit-2027"]').get_by_role('link',name='岗位详情').click()
    assert page.get_by_text('11 月 30 日',exact=False).count()>0
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.locator('[data-winter-job="atkinsrealis-hk-winter-2027-r164310"]').get_by_role('link',name='岗位详情').click()
    assert 'atkinsrealis-hk-winter-2027-r164310' in page.url
    assert page.get_by_text('13 个单独招聘岗位',exact=False).count()>0
    assert 'r-164310' in page.get_by_role('link',name='前往企业官方岗位核实及申请').get_attribute('href')
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.locator('[data-winter-job="rsm-hk-spring-tech-consulting-2027"]').get_by_role('link',name='岗位详情').click()
    assert page.get_by_text('确切起始月份尚未公布',exact=False).count()>0
    assert page.get_by_role('link',name='前往企业官方岗位核实及申请').get_attribute('href').startswith('https://www.rsm.global/')
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.locator('[data-winter-job="rsm-hk-spring-audit-assurance-2027"]').get_by_role('link',name='岗位详情').click()
    assert page.get_by_text('3 个月春季实习',exact=False).count()>0
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    # Batch 03: 3 employers, 4 concrete posting records; 10-per-page pagination.
    page.locator('[data-winter-job="richemont-hk-talent-acquisition-jr134347"]').get_by_role('link',name='岗位详情').click()
    assert 'richemont-hk-talent-acquisition-jr134347' in page.url
    assert 'JR134347' in page.get_by_role('link',name='前往企业官方岗位核实及申请').get_attribute('href').upper()
    assert page.get_by_text('2026 年 12 月至 2027 年 5 月',exact=False).count()>0
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.locator('[data-winter-job="tianzh-international-haikou-audit-j10722"]').get_by_role('link',name='岗位详情').click()
    assert page.get_by_text('官方岗位写明',exact=False).count()>0
    assert page.get_by_role('link',name='前往企业官方岗位核实及申请').get_attribute('href')=='https://tzcpa.zhiye.com/intern/jobs'
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.get_by_role('button',name='下一页').click()
    assert page.locator('[data-winter-job]').count()==10
    page.locator('[data-winter-job="tianzh-international-xian-workcenter-j11175"]').get_by_role('link',name='岗位详情').click()
    assert page.get_by_role('link',name='查看补充招聘时间证据').get_attribute('href').startswith('https://www.shixiseng.com/')
    assert page.get_by_text('未证明为同一招聘编号',exact=False).count()>0
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    # Job detail and list are the same React route component; it preserves page 2 on return.
    assert page.locator('[data-winter-job]').count()==10
    page.locator('[data-winter-job="crowe-hk-spring-audit-2027-review"]').get_by_role('link',name='岗位详情').click()
    assert page.get_by_text('官方网页存在年度版本冲突',exact=False).count()>0
    assert page.get_by_role('link',name='前往企业官方岗位核实及申请').get_attribute('href').startswith('https://www.crowe.com/')
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.get_by_role('button',name='上一页').click()
    assert page.locator('[data-winter-job]').count()==10
    # Batch 04: three companies and four additional records, on page two.
    page.get_by_role('button',name='下一页').click()
    assert page.locator('[data-winter-job]').count()==10
    for identifier in [
        'ey-tw-2027-peak-season-intake',
        'shinewing-hk-2027-winter-audit-tax-advisory',
        'shinewing-hk-2027-tax-business-advisory-l0607873647',
        'luoshu-final-year-quant-intern-2027'
    ]:
        assert page.locator(f'[data-winter-job="{identifier}"]').count()==1,identifier
    page.locator('[data-winter-job="ey-tw-2027-peak-season-intake"]').get_by_role('link',name='岗位详情').click()
    assert page.get_by_text('2026 年 11 月 8 日',exact=False).count()>0
    assert page.get_by_text('不拆分为四个虚拟岗位',exact=False).count()>0
    assert page.get_by_role('link',name='前往企业官方岗位核实及申请').get_attribute('href').startswith('https://www.ey.com/')
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.locator('[data-winter-job="shinewing-hk-2027-winter-audit-tax-advisory"]').get_by_role('link',name='岗位详情').click()
    assert page.get_by_text('Jobsdb 招聘记录',exact=False).count()>0
    assert page.get_by_role('link',name='查看补充招聘时间证据').get_attribute('href').startswith('https://hk.jobsdb.com/')
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.locator('[data-winter-job="shinewing-hk-2027-tax-business-advisory-l0607873647"]').get_by_role('link',name='岗位详情').click()
    assert page.get_by_text('L0607873647',exact=False).count()>0
    assert page.get_by_role('link',name='查看补充招聘时间证据').get_attribute('href').startswith('https://www.recruit.com.hk/')
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.locator('[data-winter-job="luoshu-final-year-quant-intern-2027"]').get_by_role('link',name='岗位详情').click()
    assert page.get_by_text('寒假时间',exact=False).count()>0 or page.get_by_text('寒假批次',exact=False).count()>0
    assert page.get_by_role('link',name='前往企业官方岗位核实及申请').get_attribute('href')=='https://www.luoshu.com/join-us'
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.get_by_role('button',name='上一页').click()
    assert page.locator('[data-winter-job]').count()==10
    # Batch 05: page two carries four ReCube roles, page three the other three and two Papergames posts.
    page.get_by_role('searchbox',name='搜索寒假实习具体岗位').fill('ReCube')
    page.get_by_role('button',name='搜索岗位').click()
    assert page.locator('[data-winter-job]').count()==7
    assert page.get_by_text('高校公开冬季职位',exact=False).count()>=7
    page.locator('[data-winter-job="recube-hk-winter-product-uiux-260900318"]').get_by_role('link',name='岗位详情').click()
    assert page.get_by_text('2026 年 11 月 14 日',exact=False).count()>0
    assert page.get_by_role('link',name='企业官网（非岗位直投）').get_attribute('href')=='https://www.recube.hk/'
    assert page.get_by_role('link',name='查看高校公开职位与截止日').get_attribute('href').startswith('https://cpdc.osa.cuhk.edu.hk/')
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.get_by_role('button',name='重置').click()
    page.get_by_role('button',name='下一页').click()
    page.get_by_role('button',name='下一页').click()
    assert page.locator('[data-winter-job]').count()==5,'25 records = 10+10+5'
    for jobid in ['recube-hk-winter-hardware-260900322','recube-hk-winter-website-designer-260900317','recube-hk-winter-data-ai-260900320','papergames-shanghai-recruiting-game-rd-intern-2027-review','papergames-shanghai-nikki-world-ecology-planning-280350']:
        assert page.locator(f'[data-winter-job="{jobid}"]').count()==1,jobid
    page.locator('[data-winter-job="papergames-shanghai-nikki-world-ecology-planning-280350"]').get_by_role('link',name='岗位详情').click()
    assert page.get_by_text('每周5天',exact=False).count()>0
    assert page.get_by_role('link',name='查看补充招聘时间证据').get_attribute('href').startswith('https://www.deizao.cn/')
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.get_by_role('button',name='上一页').click()
    page.get_by_role('button',name='上一页').click()
    assert page.locator('[data-winter-job]').count()==10
    page.locator('[data-winter-program-archive] summary').click()
    page.locator('[data-winter-program="cmb-guangzhou-2027-winter-internship-review"]').get_by_role('link',name='项目资料与官网').click()
    assert page.get_by_text('2026寒假',exact=False).count()>0
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    # Old employer programmes still have working detail pages, but are not jobs.
    page.locator('[data-winter-program-archive] summary').click()
    assert page.locator('[data-winter-program-archive]').get_attribute('open') is not None
    page.locator('[data-winter-program="pwc-hk-2027-winter"]').get_by_role('link',name='项目资料与官网').click()
    assert page.get_by_role('link',name='查看补充招聘证据').get_attribute('href').startswith('https://pip.erg.cuhk.edu.hk/')
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.locator('[data-winter-program-archive] summary').click()
    page.locator('[data-winter-program="ey-china-winter-2027-review"]').get_by_role('link',name='项目资料与官网').click()
    assert page.get_by_text('2026—2027 具体实习日期尚待官方岗位确认',exact=False).count()>0
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
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
