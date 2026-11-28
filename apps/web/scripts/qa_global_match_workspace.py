"""Actual matcher and body portal in desktop and mobile Chromium, no real AI."""
import io,json,zipfile,base64
from playwright.sync_api import sync_playwright,expect

doc=io.BytesIO()
with zipfile.ZipFile(doc,'w') as z:
    z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    z.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>合成测试简历：负责汽车门店日常运营、区域销售督导、销售数据整理、员工培训及客户服务流程优化工作。</w:t></w:r></w:p></w:body></w:document>')
    z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>')
fixture={'name':'synthetic.docx','mimeType':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','buffer':doc.getvalue()}
def exercise(browser, viewport):
    page=browser.new_page(viewport=viewport)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:4173/scripts/qa-global-match-workspace.html')
    def start():
        page.locator('#hhba-ai-resume').set_input_files(fixture)
        preview=page.locator('#hhba-ai-text-preview')
        expect(preview).to_be_visible(timeout=20000)
        preview.fill('合成测试简历：负责汽车门店日常运营、区域销售督导、销售数据整理、员工培训及客户服务流程优化工作。')
        page.locator('input[name=hhba-resume-storage][value=once]').check()
        page.locator('.hhba-ai-consent input').check()
        expect(page.locator('.hhba-ai-submit')).to_be_enabled()
        page.locator('.hhba-ai-submit').click()
        expect(page.get_by_role('button',name='最小化研究窗口')).to_be_visible()
    def minimize():
        page.get_by_role('button',name='最小化研究窗口').click()
        expect(page.get_by_role('button',name='恢复正在运行的岗位研究')).to_be_visible()
    def audit():
        return page.evaluate('window.qaAudit')
    start();minimize()
    page.get_by_role('link',name='测试首页').click()
    expect(page.get_by_test_id('current-route')).to_have_text('/')
    expect(page.get_by_role('button',name='恢复正在运行的岗位研究')).to_be_visible()
    assert audit()=={'requests':1,'aborted':0,'finished':0},audit()
    page.get_by_role('link',name='测试行业馆').click()
    expect(page.get_by_role('button',name='恢复正在运行的岗位研究')).to_be_visible()
    page.get_by_role('link',name='测试工作台匹配').click()
    expect(page.locator('#hhba-ai-text-preview')).to_be_visible()
    expect(page.locator('.hhba-ai-page')).to_have_class('hhba-ai-page hhba-ai-page-embedded')
    page.get_by_role('link',name='测试独立匹配').click()
    expect(page.locator('.hhba-ai-page')).to_have_class('hhba-ai-page')
    page.get_by_role('button',name='恢复正在运行的岗位研究').click()
    expect(page.get_by_role('button',name='最小化研究窗口')).to_be_visible()
    page.go_back()
    expect(page.get_by_role('button',name='恢复正在运行的岗位研究')).to_be_visible()
    page.get_by_role('link',name='测试首页').click()
    page.evaluate('window.qaComplete()')
    expect(page.get_by_role('button',name='查看岗位研究结果')).to_be_visible()
    assert audit()=={'requests':1,'aborted':0,'finished':1},audit()
    page.get_by_role('button',name='查看岗位研究结果').click()
    expect(page.get_by_text('合成验收：原任务完成并保留结果')).to_be_visible()
    page.get_by_role('button',name='完成查看').click()
    page.get_by_role('link',name='测试独立匹配').click()
    start();minimize()
    page.get_by_role('link',name='测试首页').click()
    page.evaluate('window.qaComplete(true)')
    expect(page.get_by_role('button',name='查看岗位研究异常')).to_be_visible()
    page.get_by_role('button',name='查看岗位研究异常').click()
    expect(page.get_by_text('AI 服务暂时异常',exact=False).last).to_be_visible()
    # Failure is not success: closing the failed window must only minimize.
    page.get_by_role('button',name='最小化',exact=True).click()
    expect(page.get_by_role('button',name='查看岗位研究异常')).to_be_visible()
    assert audit()=={'requests':2,'aborted':0,'finished':2},audit()
    # A separate, explicit user confirmation may terminate this failed task.
    page.get_by_role('button',name='查看岗位研究异常').click()
    page.get_by_role('button',name='终止匹配',exact=True).click()
    page.get_by_role('button',name='确认终止本次匹配').click()
    expect(page.locator('.hhba-match-task-dock')).to_have_count(0)
    page.get_by_role('link',name='测试独立匹配').click()
    start();minimize()
    page.get_by_role('link',name='测试首页').click()
    page.get_by_role('button',name='恢复正在运行的岗位研究').click()
    page.get_by_role('button',name='终止匹配',exact=True).click()
    page.get_by_role('button',name='确认终止本次匹配').click()
    expect(page.locator('.hhba-match-task-dock')).to_have_count(0)
    assert audit()=={'requests':3,'aborted':1,'finished':2},audit()
    page.get_by_role('link',name='测试独立匹配').click()
    start();minimize()
    page.get_by_role('link',name='测试首页').click()
    page.get_by_role('button',name='模拟切换账户').click()
    expect(page.locator('.hhba-match-task-dock')).to_have_count(0)
    assert audit()=={'requests':4,'aborted':2,'finished':2},audit()
    assert not errors,errors
    print('HHBA_GLOBAL_MATCH_BROWSER_PASS',json.dumps({'viewport':viewport,**audit()}))
    page.close()
def prestart_failure(browser):
    # Synthetic private-vault response intentionally omits the expected item,
    # simulating a rejected original-file save BEFORE any AI request starts.
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:4173/scripts/qa-global-match-workspace.html')
    page.locator('#hhba-ai-resume').set_input_files(fixture)
    preview=page.locator('#hhba-ai-text-preview')
    expect(preview).to_be_visible(timeout=20000)
    preview.fill('合成测试简历：负责区域门店运营和销售数据跟踪，培训销售团队并持续改进流程。')
    page.locator('input[name=hhba-resume-storage][value=save]').check()
    page.locator('.hhba-ai-consent input').check()
    page.locator('.hhba-ai-submit').click()
    expect(page.get_by_text('原文件尚未保存，本次 AI 匹配未启动',exact=False)).to_be_visible(timeout=15000)
    expect(page.get_by_role('button',name='开始智能匹配')).to_be_enabled()
    expect(page.locator('.hhba-match-task-dock')).to_have_count(0)
    expect(page.locator('.hhba-match-modal')).to_have_count(0)
    assert page.evaluate('window.qaAudit')['requests']==0,'rejected file storage must never make a paid AI request'
    page.locator('input[name=hhba-resume-storage][value=once]').check()
    expect(page.get_by_role('button',name='开始智能匹配')).to_be_enabled()
    assert not errors,errors
    page.close()

def duplicate_resume_choice(browser,viewport):
    page=browser.new_page(viewport=viewport)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:4173/scripts/qa-global-match-workspace.html')
    payload=base64.b64encode(doc.getvalue()).decode('ascii')
    page.evaluate('(payload)=>window.qaEnableDuplicate(payload)',payload)
    expect(page.locator('.hhba-ai-saved-picker-trigger')).to_be_visible(timeout=15000)
    page.locator('#hhba-ai-resume').set_input_files(fixture)
    dialog=page.get_by_role('alertdialog',name='检测到重复简历')
    expect(dialog).to_be_visible(timeout=15000)
    expect(dialog.get_by_text('synthetic.docx')).to_be_visible()
    expect(dialog.get_by_text('之前保存的简历.docx')).to_be_visible()
    assert page.evaluate('window.qaAudit.requests')==0,'duplicate check cannot start a paid AI task'
    assert page.evaluate('window.qaDuplicateAudit().uploads')==0,'duplicate check cannot upload the original'
    dialog.get_by_role('button',name='取消本次上传').click()
    expect(dialog).to_have_count(0)
    expect(page.get_by_text('已取消本次重复上传',exact=False)).to_be_visible()
    assert page.evaluate('window.qaAudit.requests')==0
    assert page.evaluate('window.qaDuplicateAudit().uploads')==0
    page.locator('#hhba-ai-resume').set_input_files(fixture)
    dialog=page.get_by_role('alertdialog',name='检测到重复简历')
    expect(dialog).to_be_visible(timeout=15000)
    dialog.get_by_role('button',name='使用已保存的简历').click()
    expect(dialog).to_have_count(0)
    expect(page.get_by_text('无需重复保存',exact=False)).to_be_visible()
    expect(page.locator('#hhba-ai-text-preview')).to_be_visible(timeout=15000)
    expect(page.locator('.hhba-ai-consent input')).to_be_enabled()
    assert page.evaluate('window.qaDuplicateAudit().uploads')==0
    page.locator('.hhba-ai-consent input').check()
    expect(page.get_by_role('button',name='开始智能匹配')).to_be_enabled()
    page.get_by_role('button',name='开始智能匹配').click()
    expect(page.get_by_role('button',name='最小化研究窗口')).to_be_visible(timeout=10000)
    assert page.evaluate('window.qaAudit.requests')==1
    page.evaluate('window.qaComplete()')
    expect(page.get_by_role('button',name='完成查看')).to_be_visible()
    assert not errors,errors
    print('HHBA_DUPLICATE_CHOICE_BROWSER_PASS',json.dumps({'viewport':viewport,**page.evaluate('window.qaDuplicateAudit()')}))
    page.close()

def malformed_report_view(browser,viewport):
    page=browser.new_page(viewport=viewport)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:4173/scripts/qa-global-match-workspace.html')
    page.evaluate('window.qaShowMalformedReport()')
    report=page.get_by_test_id('qa-malformed-report')
    expect(report.get_by_text('仅用于验收的 AI 参考岗位详情')).to_be_visible(timeout=15000)
    expect(report.get_by_text('准备真实运营案例')).to_be_visible()
    expect(report.get_by_text('不应显示')).to_have_count(0)
    expect(report.get_by_text('这份报告有有效的分析摘要',exact=False)).to_be_visible()
    expect(report.get_by_text('未命名岗位')).to_have_count(0)
    report.get_by_role('tab',name='机会探索').click()
    expect(report.get_by_text('数据助理')).to_be_visible()
    report.get_by_role('tab',name='职业画像').click()
    expect(report.get_by_text('职业转型')).to_be_visible()
    expect(report.get_by_text('已读取简历信息，正在整理职业背景。')).to_be_visible()
    assert not errors,errors
    print('HHBA_MALFORMED_REPORT_BROWSER_PASS',json.dumps({'viewport':viewport}))
    page.close()

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    prestart_failure(browser)
    malformed_report_view(browser,{'width':1440,'height':900})
    malformed_report_view(browser,{'width':390,'height':844})
    duplicate_resume_choice(browser,{'width':1440,'height':900})
    duplicate_resume_choice(browser,{'width':390,'height':844})
    exercise(browser,{'width':1440,'height':900})
    exercise(browser,{'width':390,'height':844})
    browser.close()
