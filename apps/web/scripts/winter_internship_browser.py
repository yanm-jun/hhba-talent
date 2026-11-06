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
    assert dialog.get_by_role('checkbox').count()==0, 'obsolete opt-out must not be shown'
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
    # Dataset and grouping checks are independent of source order; new batches
    # must not break test navigation due to pagination reordering.
    assert '67 条公开岗位及招聘批次结果' in page.locator('.hhba-winter-list-summary').inner_text()
    assert page.locator('.hhba-winter-role-group-title').count()>=1
    assert page.get_by_label('按行业分组筛选寒假岗位').count()==1

    def search(term):
        field=page.get_by_role('searchbox',name='搜索寒假实习具体岗位')
        field.fill(term)
        # Search responds while typing; submission must remain supported.
        page.get_by_role('button',name='搜索岗位').click()

    def reset():
        page.locator('.hhba-winter-filters-reset').click()

    # Batch08: three individually sourced mainland postings, each with
    # honest winter-schedule caveats and a usable internal detail route.
    new_cases=[
        ('海尔','haier-qd-vision-algorithm-intern-20261104','maker.haier.net'),
        ('海信','hisense-qd-hr-intern-j44475','jobs.hisense.com'),
        ('京东方','boe-bj-2027-software-intern-j54754','boe.zhiye.com')
    ]
    for term,jobid,domain in new_cases:
        search(term)
        assert page.locator(f'[data-winter-job="{jobid}"]').count()==1,jobid
        assert page.get_by_text('寒假时间待核实',exact=False).count()>0
        page.locator(f'[data-winter-job="{jobid}"]').get_by_role('link',name='岗位详情').click()
        assert jobid in page.url
        assert domain in page.get_by_role('link',name='前往企业官方岗位核实及申请').get_attribute('href')
        assert page.get_by_text('寒假',exact=False).count()>0
        page.get_by_role('link',name='返回寒假实习岗位列表').click()
    reset()
    # Mainland, role group, and major facets must change the actual results.
    page.get_by_label('按地区筛选寒假岗位').select_option('中国内地')
    assert page.locator('[data-winter-job]').count()>=3
    assert page.locator('[data-winter-job]').count()==page.locator('[data-winter-job] .hhba-winter-role-company').count()
    page.get_by_label('按行业分组筛选寒假岗位').select_option('先进制造')
    assert page.locator('[data-winter-job="boe-bj-2027-software-intern-j54754"]').count()==1
    assert page.locator('[data-winter-job="hisense-qd-hr-intern-j44475"]').count()==0
    reset()
    page.get_by_label('按专业筛选寒假岗位').select_option('人力资源管理')
    assert page.locator('[data-winter-job="hisense-qd-hr-intern-j44475"]').count()==1
    reset()

    # Multi-keyword search, cross-region employer search, and programme-only
    # lookup must work without creating fake concrete vacancy entries.
    search('上海 传播')
    assert page.locator('[data-winter-job="apco-shanghai-winter-start-1787"]').count()==1
    assert page.locator('[data-winter-job]').count()==1
    search('BDO IT')
    assert page.locator('[data-winter-job="bdo-hk-spring-it-audit-2027"]').count()==1
    search('ReCube')
    assert page.locator('[data-winter-job]').count()==7
    search('毕马威')
    assert page.locator('[data-winter-job]').count()==0
    assert page.locator('[data-winter-program="kpmg-2027-winter"]').count()==1
    assert page.locator('[data-winter-program-archive]').get_attribute('open') is not None
    reset()

    # Batch09: all three brands must be discoverable by Chinese keywords.
    # Bondi has two separately indexed winter postings, not duplicate cards.
    for name,ident,homepage in [
        ('民生银行','cmbc-ningbo-2027-winter-intern-30','career.cmbc.com.cn'),
        ('邦戴数科','bondi-sh-2027-winter-discretionary-trader','bonditech.com.cn'),
        ('邦戴数科','bondi-sh-2027-winter-cpp-developer','bonditech.com.cn'),
        ('长春万富','changchun-wanda-vista-2027-short-winter-intern','ncss.cn')
    ]:
        search(name)
        assert page.locator(f'[data-winter-job="{ident}"]').count()==1,ident
        page.locator(f'[data-winter-job="{ident}"]').get_by_role('link',name='岗位详情').click()
        assert ident in page.url
        assert homepage in page.get_by_role('link',name='企业招聘首页（非岗位直投）').get_attribute('href')
        assert page.get_by_text('招聘',exact=False).count()>=1
        page.get_by_role('link',name='返回寒假实习岗位列表').click()
    reset()
    search('邦戴数科')
    assert page.locator('[data-winter-job]').count()==2
    search('长春 2027寒假')
    assert page.locator('[data-winter-job="changchun-wanda-vista-2027-short-winter-intern"]').count()==1
    reset()
    page.get_by_label('按行业分组筛选寒假岗位').select_option('教育文旅')
    assert page.locator('[data-winter-job="changchun-wanda-vista-2027-short-winter-intern"]').count()==1
    reset()
    page.get_by_label('按地区筛选寒假岗位').select_option('中国内地')
    search('宁波')
    assert page.locator('[data-winter-job="cmbc-ningbo-2027-winter-intern-30"]').count()==1
    reset()

    # Batch10: all three China-mainland employer names should search correctly,
    # and closed historical leads must not appear as newly opened winter posts.
    for name,jobid,domain,link_label in [
        ('作业帮素养','zuoyebang-hz-2026-winter-teaching-assistant-archive','app.mokahr.com','查看雇主已截止岗位公告'),
        ('平方和投资','alpha2-sh-winter-quant-strategy-source-check-2026','alpha2fund.com','企业招聘首页（非岗位直投）'),
        ('国泰海通证券','gtht-sh-winter-convert-bond-underwriting-20260909','hr.gtht.com','企业招聘首页（非岗位直投）')
    ]:
        search(name)
        assert page.locator(f'[data-winter-job="{jobid}"]').count()==1,jobid
        page.locator(f'[data-winter-job="{jobid}"]').get_by_role('link',name='岗位详情').click()
        assert jobid in page.url
        assert domain in page.get_by_role('link',name=link_label).get_attribute('href')
        assert page.locator('.hhba-winter-warning').count()>=1,'uncertainty must be visible in job details'
        page.get_by_role('link',name='返回寒假实习岗位列表').click()
    reset()
    search('作业帮素养')
    assert page.get_by_text('已过申请截止日',exact=False).count()>=1
    search('国泰海通')
    assert page.get_by_text('待官网复核',exact=False).count()>=1
    reset()
    page.get_by_label('按地区筛选寒假岗位').select_option('中国内地')
    page.get_by_label('按行业分组筛选寒假岗位').select_option('教育文旅')
    search('作业帮')
    assert page.locator('[data-winter-job="zuoyebang-hz-2026-winter-teaching-assistant-archive"]').count()==1
    reset()
    page.get_by_label('按行业分组筛选寒假岗位').select_option('金融银行')
    search('平方和')
    assert page.locator('[data-winter-job="alpha2-sh-winter-quant-strategy-source-check-2026"]').count()==1
    reset()

    # Batch11: independent bank, research and education winter leads.
    for term,ident,linktext,linkhost in [
        ('恒丰银行','hfbank-bj-2027winter-admin-support-20261105','企业招聘首页（非岗位直投）','career.hfbank.com.cn'),
        ('TABS','tabs-sh-2027winter-engineering-assistant-20270125','查看第三方招聘平台的独立岗位','shixiseng.com/intern/inn_bpbngqctny7q'),
        ('TABS','tabs-sh-2027winter-biochemistry-assistant-20270125','查看第三方招聘平台的独立岗位','shixiseng.com/intern/inn_2nsclxzsc0qp'),
        ('TABS','tabs-sz-2027winter-biomed-assistant-20270214','查看第三方招聘平台的独立岗位','shixiseng.com/intern/inn_mqy9upzdcjnd'),
        ('乐亦思','roys-hz-2027winter-class-assistant-source-review','查看2027招聘汇总（非寒假直投）','jdjianli.com/campus/51040')
    ]:
        search(term)
        assert page.locator(f'[data-winter-job="{ident}"]').count()==1,ident
        page.locator(f'[data-winter-job="{ident}"]').get_by_role('link',name='岗位详情').click()
        assert ident in page.url
        assert linkhost in page.get_by_role('link',name=linktext).get_attribute('href')
        assert page.locator('.hhba-winter-warning').count()>0,'winter evidence limits must appear'
        page.get_by_role('link',name='返回寒假实习岗位列表').click()
    reset()
    search('恒丰银行')
    assert page.locator('[data-winter-job]').count()==3,'3 distinct bank roles in one 6-person announcement'
    search('TABS')
    assert page.locator('[data-winter-job]').count()==3,'3 independently published 2027 winter project roles'
    search('乐亦思')
    assert page.locator('[data-winter-job]').count()==1,'one Roys winter lead, not full-time teaching jobs'
    reset()
    page.get_by_label('按地区筛选寒假岗位').select_option('中国内地')
    page.get_by_label('按行业分组筛选寒假岗位').select_option('教育文旅')
    search('TABS')
    assert page.locator('[data-winter-job]').count()==3
    reset()
    page.get_by_label('按地区筛选寒假岗位').select_option('中国内地')
    page.get_by_label('按行业分组筛选寒假岗位').select_option('金融银行')
    search('恒丰')
    assert page.locator('[data-winter-job]').count()==3
    reset()

    # Batch12: three new mainland employers and four distinct winter-tagged postings.
    for term,ident,expected_url in [
        ('陆芯科技','luxin-sh-power-semiconductor-winter-tag-20261023','inn_lrlnlhezssyb'),
        ('空地互联','airlink-sh-wifi-data-analyst-winter-tag-20261104','inn_jhwbqfhkwtoa'),
        ('同道猎聘','liepin-bj-rpo-intern-winter-tag-20261020','inn_tpt19ipuu8np'),
        ('同道猎聘','liepin-hz-sales-consultant-winter-tag-20260910','inn_22u67vker7bb')
    ]:
        search(term)
        assert page.locator(f'[data-winter-job="{ident}"]').count()==1,ident
        page.locator(f'[data-winter-job="{ident}"]').get_by_role('link',name='岗位详情').click()
        assert ident in page.url
        source=page.get_by_role('link',name='查看第三方招聘平台的独立岗位').get_attribute('href')
        assert expected_url in source
        assert page.locator('.hhba-winter-warning').count()>0,'job limitations must be visible'
        page.get_by_role('link',name='返回寒假实习岗位列表').click()
    reset()
    search('同道猎聘')
    assert page.locator('[data-winter-job]').count()==2,'show RPO and sales, do not multiply same-name jobs by city'
    page.get_by_label('按地区筛选寒假岗位').select_option('中国内地')
    page.get_by_label('按行业分组筛选寒假岗位').select_option('企业职能')
    assert page.locator('[data-winter-job="liepin-bj-rpo-intern-winter-tag-20261020"]').count()==1
    assert page.locator('[data-winter-job="liepin-hz-sales-consultant-winter-tag-20260910"]').count()==0
    page.get_by_label('按行业分组筛选寒假岗位').select_option('市场传播')
    assert page.locator('[data-winter-job="liepin-bj-rpo-intern-winter-tag-20261020"]').count()==0
    assert page.locator('[data-winter-job="liepin-hz-sales-consultant-winter-tag-20260910"]').count()==1
    reset()
    search('陆芯科技')
    page.get_by_label('按行业分组筛选寒假岗位').select_option('先进制造')
    assert page.locator('[data-winter-job="luxin-sh-power-semiconductor-winter-tag-20261023"]').count()==1
    reset()
    search('空地互联')
    page.get_by_label('按行业分组筛选寒假岗位').select_option('科技研发')
    assert page.locator('[data-winter-job="airlink-sh-wifi-data-analyst-winter-tag-20261104"]').count()==1
    reset()
    search('航空 Wi-Fi')
    assert page.locator('[data-winter-job="airlink-sh-wifi-data-analyst-winter-tag-20261104"]').count()==1
    reset()

    # Batch13: three mainland firms with concrete 2027 Jan-Apr/May internship
    # dates in their recruiting requirements, not third-party winter tags.
    for name,jobid,domain in [
        ('立信会计师事务所','bdo-sz-tax-intern-winter-20270104','bdochina.zhiye.com/intern/detail'),
        ('立信会计师事务所','bdo-sz-audit-intern-winter-20270104','bdochina.zhiye.com/intern/detail'),
        ('天健会计师事务所','pccpa-hz-workpaper-delivery-winter-202612','zhaopin.pccpa.cn/hr/recruit/internship/detail'),
        ('大华会计师事务所','dahua-ty-data-parsing-winter-202701-j10719','zhaopin.dahua-cpa.com/campus/detail'),
        ('大华会计师事务所','dahua-ty-confirmation-specialist-winter-202701-j10717','zhaopin.dahua-cpa.com/campus/detail')
    ]:
        search(name)
        assert page.locator(f'[data-winter-job="{jobid}"]').count()==1,jobid
        page.locator(f'[data-winter-job="{jobid}"]').get_by_role('link',name='岗位详情').click()
        assert jobid in page.url
        href=page.get_by_role('link',name='前往企业官方岗位核实及申请').get_attribute('href')
        assert domain in href,jobid+' must point to official employer application site'
        assert page.locator('.hhba-winter-warning').count()>0,'cross-semester qualification warning missing'
        page.get_by_role('link',name='返回寒假实习岗位列表').click()
    reset()
    search('立信会计师事务所')
    assert page.locator('[data-winter-job]').count()==2,'two BDO China jobs, not a collection of project slots'
    search('天健会计师事务所')
    assert page.locator('[data-winter-job]').count()==1,'one winter-spanning Tianjian position'
    search('大华会计师事务所')
    assert page.locator('[data-winter-job]').count()==2,'two genuinely distinct Dahua requisitions'
    reset()
    page.get_by_label('按地区筛选寒假岗位').select_option('中国内地')
    page.get_by_label('按行业分组筛选寒假岗位').select_option('审计咨询')
    search('立信')
    assert page.locator('[data-winter-job]').count()==2
    search('天健')
    assert page.locator('[data-winter-job]').count()==1
    search('大华')
    assert page.locator('[data-winter-job]').count()==2
    reset()
    page.get_by_label('按地区筛选寒假岗位').select_option('中国内地')
    search('太原 函证')
    assert page.locator('[data-winter-job="dahua-ty-confirmation-specialist-winter-202701-j10717"]').count()==1
    reset()

    # Key legacy official jobs continue to have source-backed detail routes.
    for term,jobid in [
        ('HSBC','hsbc-hk-student-placement-1367003857'),
        ('QIMA','qima-hk-sales-intern-744000154586189'),
        ('L059656859','informa-markets-hk-2027-jan-jun-intern-l059656859'),
        ('BNP Paribas','bnp-hk-2027-securities-services-ref118477'),
        ('SSCPC02515','lvmh-hk-beauty-2027-jan-sscpc02515'),
        ('2026-115202','creditagricole-hk-2027-finance-intern-115202')
    ]:
        search(term)
        assert page.locator(f'[data-winter-job="{jobid}"]').count()==1,jobid
        page.locator(f'[data-winter-job="{jobid}"]').get_by_role('link',name='岗位详情').click()
        assert jobid in page.url
        page.get_by_role('link',name='返回寒假实习岗位列表').click()
    reset()

    # Stable ten-per-page browsing, including the new final partial page.
    assert page.locator('[data-winter-job]').count()==10
    for number in range(6):
        page.get_by_role('button',name='下一页').click()
    assert page.locator('[data-winter-job]').count()==7, '67 independent records = six full pages and seven final records'
    page.get_by_role('button',name='上一页').click()
    assert page.locator('[data-winter-job]').count()==10
    reset()

    # Legacy employer programmes remain informational and have valid detail links.
    page.locator('[data-winter-program-archive] summary').click()
    page.locator('[data-winter-program="pwc-hk-2027-winter"]').get_by_role('link',name='项目资料与官网').click()
    assert page.get_by_role('link',name='查看补充招聘证据').get_attribute('href').startswith('https://pip.erg.cuhk.edu.hk/')
    page.get_by_role('link',name='返回寒假实习岗位列表').click()
    page.goto(BASE,wait_until='domcontentloaded')
    dialog=page.locator('[data-hhba-winter-modal] [role=dialog]')
    dialog.wait_for(timeout=15000)
    assert page.locator('.hhba-letter-overlay').count()==0,'letter must not auto-open'
    # Ordinary dismissal only closes the current display; refresh reopens.
    dialog.get_by_role('button',name='关闭寒假实习广告').click()
    assert page.locator('[data-hhba-winter-modal]').count()==0
    page.reload()
    dialog.wait_for(timeout=15000)
    dialog.get_by_role('button',name='关闭寒假实习广告').click()
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
    page.locator('[data-hhba-winter-modal] [role=dialog]').wait_for(timeout=15000)
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

    # Old saved "never show again" + prior session "seen" keys must NOT block
    # the campaign, even after a new page, reload, or internal navigation.
    legacy=browser.new_context(viewport={"width":1280,"height":800})
    legacy_page=legacy.new_page()
    legacy_page.add_init_script("""(() => {
        localStorage.setItem('hhba:winter-internship-2027:hide:v1','1');
        sessionStorage.setItem('hhba:winter-internship-2027:seen:v1','1');
    })();""")
    legacy_page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
    legacy_dialog=legacy_page.locator('[data-hhba-winter-modal] [role=dialog]')
    legacy_dialog.wait_for(timeout=15000)
    assert legacy_dialog.get_by_role('checkbox').count()==0
    legacy_dialog.get_by_role('button',name='关闭寒假实习广告').click()
    assert legacy_page.locator('[data-hhba-winter-modal]').count()==0
    legacy_page.reload()
    legacy_dialog.wait_for(timeout=15000)
    # Clicking the CTA should not set a suppression preference either.
    legacy_dialog.get_by_role('link',name='立即参加').click()
    legacy_page.get_by_role('heading',name='探索寒假实习机会').wait_for(timeout=15000)
    assert legacy_page.evaluate("localStorage.getItem('hhba:winter-internship-2027:hide:v1')")=='1'
    # Returning to the homepage is a new homepage entry: open again.
    legacy_page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
    legacy_dialog.wait_for(timeout=15000)
    legacy_page.screenshot(path='/tmp/hhba-winter-every-visit-legacy-storage.png',full_page=False)
    legacy.close()
    fresh=browser.new_context(viewport={"width":1280,"height":800})
    fresh_page=fresh.new_page()
    fresh_page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
    fresh_page.locator('[data-hhba-winter-modal] [role=dialog]').wait_for(timeout=15000)
    fresh.close()

    mobile=browser.new_context(viewport={"width":390,"height":844},device_scale_factor=1,is_mobile=True,has_touch=True)
    page=mobile.new_page()
    page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
    popup=page.locator('[data-hhba-winter-modal] [role=dialog]')
    popup.wait_for(timeout=60000)
    mobile_box=popup.bounding_box()
    assert mobile_box is not None and mobile_box['width'] <= 390, f"popup overflows mobile viewport: {mobile_box}"
    assert mobile_box['height'] <= 844, f"popup is taller than mobile viewport: {mobile_box}"
    assert popup.get_by_role('link',name='立即参加').is_visible()
    assert popup.get_by_role('checkbox').count()==0
    page.screenshot(path='/tmp/hhba-winter-modal-mobile.png',full_page=False)
    popup.get_by_role('button',name='关闭寒假实习广告').click()
    assert page.locator('[data-hhba-winter-modal]').count()==0
    assert page.locator('.hhba-letter-overlay').count()==0
    page.get_by_role('button',name='读一封来自 HHBA 的信').click()
    page.locator('.hhba-letter-overlay[data-stage=envelope]').wait_for(timeout=15000)
    page.locator('.hhba-letter-close').first.click()
    page.reload()
    page.locator('[data-hhba-winter-modal] [role=dialog]').wait_for(timeout=15000)
    assert page.locator('.hhba-letter-overlay').count()==0
    mobile.close()
    assert not errors,errors
    print('HHBA_WINTER_CAMPAIGN_BROWSER_ACCEPTANCE_OK')
    browser.close()
