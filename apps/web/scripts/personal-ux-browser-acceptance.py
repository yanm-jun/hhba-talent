"""Browser smoke and visual snapshots for the public HHBA personal career refresh.
Does not sign in, submit evidence, simulate payments, or access production user data.
"""
import os
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get("HHBA_BROWSER_URL", "http://127.0.0.1:4173")
OUT = Path(os.environ.get("HHBA_SCREENSHOT_DIR", "tmp/personal-ux-screens"))
OUT.mkdir(parents=True, exist_ok=True)

for _ in range(50):
    try:
        with urllib.request.urlopen(BASE + "/auth", timeout=2) as r:
            if r.status == 200:
                break
    except Exception:
        time.sleep(0.5)
else:
    raise AssertionError("Vite preview did not become ready")


def no_horizontal_overflow(page, tag):
    metrics = page.evaluate("""() => ({
        doc: document.documentElement.scrollWidth,
        width: window.innerWidth,
        body: document.body.scrollWidth
    })""")
    assert metrics["doc"] <= metrics["width"] + 2, f"{tag}: horizontal document overflow {metrics}"
    assert metrics["body"] <= metrics["width"] + 2, f"{tag}: horizontal body overflow {metrics}"


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for name, size in (
        ("desktop", {"width": 1440, "height": 900}),
        ("mobile", {"width": 390, "height": 844}),
    ):
        page = browser.new_page(viewport=size, device_scale_factor=1)
        page.goto(BASE + "/auth", wait_until="domcontentloaded")
        page.locator("#role-auth-title").wait_for()
        assert page.get_by_text("我是个人用户").is_visible()
        assert page.get_by_text("我是招聘方").is_visible()
        assert page.locator(".hhba-auth-v2-editorial").is_visible()
        assert page.locator(".hhba-auth-v2-panel").is_visible()
        assert page.locator(".hhba-auth-v2-milestone").count() == 3
        assert page.get_by_text("不止于找到工作。").is_visible()
        assert page.get_by_text("了解服务规划，当前尚未开放购买").is_visible()
        columns = page.locator(".hhba-auth-v2-layout").evaluate("(el) => getComputedStyle(el).gridTemplateColumns")
        assert len(columns.split()) == (2 if name == "desktop" else 1), f"Unexpected auth layout: {name} {columns}"
        assert page.locator('a[href*="/candidate/login"]').count() >= 1
        assert page.locator('a[href*="/recruiter/login"]').count() >= 1
        no_horizontal_overflow(page, name + "-auth")
        page.screenshot(path=str(OUT / f"{name}-auth.png"), full_page=True, animations="disabled")

        page.goto(BASE + "/candidate/account/rights", wait_until="domcontentloaded")
        page.get_by_text("职场权益中心", exact=True).first.wait_for()
        assert page.get_by_text("尚未开放购买").is_visible()
        assert page.get_by_text("¥24.90").is_visible()
        assert page.get_by_text("任职企业公开信息月报").is_visible()
        assert page.get_by_text("个人劳动权益核对").is_visible()
        assert page.get_by_text("职业成长档案").is_visible()
        assert page.get_by_text("不包含仲裁和诉讼代理", exact=False).count() >= 1
        assert page.locator('form[action*="checkout"], button:has-text("立即支付")').count() == 0
        no_horizontal_overflow(page, name + "-rights")
        page.screenshot(path=str(OUT / f"{name}-rights.png"), full_page=True, animations="disabled")
        page.close()
        print(name + ": login/rights text, routes, payment guard, and viewport checks OK", flush=True)
    browser.close()
