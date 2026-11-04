"""Browser acceptance: HHBA public header -> universal search -> canonical public pages."""
import os
import time
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import quote
from playwright.sync_api import sync_playwright

BASE = os.environ.get("HHBA_SEARCH_PREVIEW_BASE", "http://127.0.0.1:4173/hhba-talent/")
for _ in range(30):
    try:
        with urlopen(BASE, timeout=3) as r:
            if r.status == 200:
                break
    except Exception:
        time.sleep(1)
else:
    raise RuntimeError("Vite branch static preview not available")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE, wait_until="domcontentloaded", timeout=60000)
    header = page.get_by_role("searchbox", name="搜索 HHBA 站内所有公开内容")
    header.wait_for(timeout=60000)
    assert header.is_visible(), "universal header search should be visible"
    page.screenshot(path="/tmp/hhba-global-search-header.png")

    header.fill("新西兰留学")
    page.get_by_role("button", name="提交全站搜索").click()
    page.get_by_role("heading", name="搜索 HHBA").wait_for(timeout=60000)
    page.get_by_role("heading", name="新西兰留学机会").first.wait_for(timeout=60000)
    assert "q=" in page.url and "/search" in page.url, page.url
    page.screenshot(path="/tmp/hhba-global-search-results.png")

    # Query the country name to include its actual published directional pages.
    page.goto(BASE+"search?q="+quote("新西兰"), wait_until="domcontentloaded")
    page.get_by_role("heading", name="新西兰硕士升学方向").wait_for(timeout=60000)
    # Prove canonical in-app detail navigation, not an external search engine.
    page.get_by_role("link").filter(has=page.get_by_role("heading", name="新西兰硕士升学方向")).first.click()
    page.get_by_role("heading", name="新西兰硕士升学方向").wait_for(timeout=60000)
    assert "/study-abroad/nz-masters" in page.url, page.url

    # A source-backed public policy must also be discoverable.
    page.goto(BASE+"search?q="+quote("济南"), wait_until="domcontentloaded")
    page.get_by_role("heading", name="搜索 HHBA").wait_for(timeout=60000)
    page.get_by_role("button", name="人才政策", exact=True).click()
    assert page.locator(".hhba-site-search-result").count() > 0, "city policy search returned no records"

    assert not errors, "browser exceptions: " + " | ".join(errors[:3])
    print("HHBA_GLOBAL_SEARCH_BROWSER_ACCEPTANCE_OK")
    browser.close()
