"""Real Chromium icon visual acceptance for HHBA web and admin preview.
Only local preview and public routes; no login, real resumes, payments or writes.
"""
import json
import os
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get("HHBA_BROWSER_URL", "http://127.0.0.1:4173").rstrip("/")
OUT = Path(os.environ.get("HHBA_SCREENSHOT_DIR", "tmp/icon-visual-screens"))
OUT.mkdir(parents=True, exist_ok=True)
PAGES = [
    ("/", "home"),
    ("/candidate/jobs", "jobs"),
    ("/candidate/match", "match"),
    ("/auth", "auth"),
    ("/membership/rules", "membership"),
    ("/rights/knowledge", "rights"),
    ("/join", "join"),
]
for i in range(50):
    try:
        with urllib.request.urlopen(BASE + "/", timeout=2) as response:
            if response.status == 200:
                break
    except Exception:
        time.sleep(.5)
else:
    raise AssertionError("Vite preview did not become ready")

def audit(page, tag, is_admin=False):
    result = page.evaluate("""() => {
      const iconSelector = 'svg.lucide, .nav-link svg[aria-hidden="true"]';
      const icons = [...document.querySelectorAll(iconSelector)];
      const problems = [];
      let visible = 0, controlIcons = 0;
      for (const svg of icons) {
        const style = getComputedStyle(svg);
        const rect = svg.getBoundingClientRect();
        if (style.display === 'none' || style.visibility === 'hidden' ||
            rect.width === 0 || rect.height === 0) continue;
        visible++;
        const cls = svg.getAttribute('class') || '';
        if (rect.width < 9 || rect.height < 9)
          problems.push({kind:'tiny',cls,box:[rect.width,rect.height]});
        const parent = svg.closest('button,a[href],[role="button"],[role="tab"]');
        if (parent && rect.width <= 75 && rect.height <= 75) {
          const pr = parent.getBoundingClientRect();
          // Skip virtualized/offscreen controls and scroll-viewport clips.
          if (pr.width < 10 || pr.height < 10 || pr.right < 0 || pr.left > innerWidth ||
              pr.bottom < 0 || pr.top > innerHeight) continue;
          controlIcons++;
          if (rect.left < pr.left-5 || rect.right > pr.right+5 ||
              rect.top < pr.top-5 || rect.bottom > pr.bottom+5)
            problems.push({kind:'out-of-control',cls,element:parent.tagName,
              icon:[rect.left,rect.top,rect.right,rect.bottom],
              parent:[pr.left,pr.top,pr.right,pr.bottom]});
        }
      }
      const width = document.documentElement.scrollWidth;
      return {width,viewport:innerWidth,visible,controlIcons,problems:problems.slice(0,15)};
    }""")
    assert result["visible"] > 0, f"{tag}: no rendered vector icons: {result}"
    assert result["width"] <= result["viewport"] + 3, f"{tag}: horizontal page overflow: {result}"
    assert not result["problems"], f"{tag}: icon geometry problems: {result}"
    return result

reports = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    try:
        for device, config in [
            ("desktop", {"viewport":{"width":1440,"height":900}, "device_scale_factor":1}),
            ("mobile", {"viewport":{"width":390,"height":844}, "device_scale_factor":1,
                        "is_mobile":True, "has_touch":True}),
        ]:
            context = browser.new_context(locale="zh-CN", **config)
            for path, label in PAGES:
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda err: errors.append(str(err)))
                response = page.goto(BASE+path, wait_until="domcontentloaded", timeout=45000)
                assert response and response.status == 200, f"{device}:{label} not HTTP 200"
                page.wait_for_function("document.body.innerText.length > 75", timeout=20000)
                page.wait_for_timeout(800)
                result = audit(page, device+"-"+label)
                page.screenshot(path=str(OUT/f"{device}-{label}.png"),
                                full_page=True, animations="disabled")
                assert not errors, f"{device}-{label} browser errors: {errors[:3]}"
                reports.append({"device":device,"page":label,**result})
                if label == "jobs":
                    # This is the *actual* market widget: its specialty selector is
                    # a custom listbox, unlike browser-native country selects.
                    major = page.get_by_role("combobox",name="搜索或选择所学专业")
                    assert major.count() == 1, "Actual recruitment market major filter missing"
                    major.click(timeout=10000)
                    options = page.locator(".unified-major-options")
                    options.wait_for(timeout=5000)
                    assert options.is_visible(), "Major menu must be visible after focus"
                    audit(page,device+"-job-major-open")
                    page.screenshot(path=str(OUT/f"{device}-job-major-open.png"),
                                    full_page=True,animations="disabled")
                    major.fill("市场营销")
                    assert page.locator(".unified-major-options [role=option]").count() > 0, "Expected real matching options"
                    major.press("Escape")
                    assert options.count() == 0, "Escape must close major listbox"
                    if device == "desktop":
                        icon_control = page.locator(".unified-job-search")
                        icon_control.hover()
                        page.wait_for_timeout(260)
                        assert icon_control.locator("svg.lucide").count() == 1
                if label == "membership":
                    details = page.locator("details")
                    if details.count():
                        first = details.first
                        first.locator("summary").click()
                        assert first.get_attribute("open") is not None, "FAQ details must open"
                        page.screenshot(path=str(OUT/f"{device}-faq-open.png"),animations="disabled")
                        first.locator("summary").click()
                        assert first.get_attribute("open") is None, "FAQ details must close"
                if label == "match":
                    # No personal resume is uploaded. Verify the public, disabled and
                    # loading states without invoking paid AI or modifying backend data.
                    assert page.locator(".hhba-ai-page").count() == 1
                if label == "home":
                    dialog = page.get_by_role("dialog")
                    assert dialog.count() == 1, "Winter popup should open on homepage visit"
                    close = dialog.get_by_role("button",name="关闭寒假实习广告")
                    assert close.is_visible()
                    audit(page,device+"-winter-popup-open")
                    close.click()
                    assert dialog.count() == 0, "Winter popup should close without trapping the interface"
                    page.screenshot(path=str(OUT/f"{device}-winter-popup-closed.png"),
                                    full_page=True,animations="disabled")
                    page.emulate_media(reduced_motion="reduce")
                    motion = page.locator("svg.lucide").first.evaluate(
                        "(svg) => ({animation:getComputedStyle(svg).animationName,"
                        " transition:getComputedStyle(svg).transitionDuration})")
                    assert motion["animation"] == "none", f"reduced motion icon animates: {motion}"
                    page.screenshot(path=str(OUT/f"{device}-reduced-motion.png"),
                                    animations="disabled")
                page.close()
            admin = context.new_page()
            response = admin.goto(BASE+"/preview-admin/",wait_until="domcontentloaded")
            assert response and response.status == 200
            admin.locator(".nav-link svg").first.wait_for()
            result = audit(admin,device+"-admin",True)
            admin.screenshot(path=str(OUT/f"{device}-admin.png"),
                             full_page=True,animations="disabled")
            reports.append({"device":device,"page":"admin",**result})
            admin.close()
            context.close()
    finally:
        browser.close()

(OUT/"results.json").write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding="utf8")
print("ICON_VISUAL_ACCEPTANCE_PASS",json.dumps(reports,ensure_ascii=False),flush=True)
