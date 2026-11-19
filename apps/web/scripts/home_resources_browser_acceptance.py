"""Real browser acceptance for HHBA's editorial homepage resources.
Checks desktop/mobile visual structure, link destinations and existing brand geometry.
Does not call private endpoints or depend on user accounts.
"""
import os
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.environ.get("HHBA_BROWSER_URL","http://127.0.0.1:4173").rstrip("/")
OUT=Path(os.environ.get("HHBA_SCREENSHOT_DIR","tmp/home-resources-screens"))
OUT.mkdir(parents=True,exist_ok=True)

for _ in range(60):
    try:
        with urllib.request.urlopen(BASE+"/",timeout=2) as response:
            if response.status==200:
                break
    except Exception:
        time.sleep(.5)
else:
    raise AssertionError("Local Vite production preview is not responding")

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True)
    for name,width,height in [("desktop",1440,900),("mobile",390,844)]:
        context=browser.new_context(viewport={"width":width,"height":height},device_scale_factor=1,reduced_motion="reduce")
        page=context.new_page()
        page.goto(BASE+"/",wait_until="domcontentloaded")
        # The homepage intentionally displays a winter-internship modal on each visit.
        # Dismiss it only in the visual test, so the screenshot shows the requested section.
        page.locator("[data-winter-close]").click(timeout=15000)
        assert page.locator("[data-hhba-winter-modal]").count()==0, f"{name}: modal obscures visual acceptance"
        section=page.locator(".hhba-home-workplace")
        section.wait_for(timeout=30000)
        assert section.locator("h2").inner_text().strip()=="让职业选择更有依据。"
        cards=section.locator("a.hhba-home-resource-card")
        assert cards.count()==2, f"{name}: expected two clearly separated resource cards"
        assert cards.nth(0).get_attribute("href")=="/rights/knowledge"
        assert cards.nth(1).get_attribute("href")=="/rights/guide"
        assert "20 个专题" in cards.nth(0).inner_text()
        assert "200 条原创建议" in cards.nth(1).inner_text()
        assert section.locator(".hhba-home-price-block").count()==0
        assert section.locator(".hhba-home-distribution-values").count()==0
        assert section.locator(".hhba-home-phase-grid").count()==0
        pledge=section.locator(".hhba-home-pledge")
        assert pledge.get_by_role("heading",name="透明，是我们做事的方式。").count()==1
        assert pledge.locator('a[href="/transparency"]').count()==1
        assert "不承诺固定金额或分配比例" in pledge.inner_text()
        rects=[cards.nth(i).bounding_box() for i in range(2)]
        assert all(rects),f"{name}: missing card geometry"
        first,second=rects
        if name=="desktop":
            assert second["x"]>first["x"]+first["width"]-.5,f"{name}: cards should be side-by-side: {rects}"
        else:
            assert second["y"]>first["y"]+first["height"]-.5,f"{name}: cards should stack: {rects}"
        overflow=page.evaluate("() => ({width:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth})")
        assert overflow["html"]<=overflow["width"]+3 and overflow["body"]<=overflow["width"]+3, f"{name}: horizontal overflow {overflow}"
        section.screenshot(path=str(OUT/f"{name}-home-resources.png"),animations="disabled")
        # Route integrity independent from any homepage popup or overlay.
        page.goto(BASE+"/rights/knowledge",wait_until="domcontentloaded")
        page.locator(".hhba-knowledge-search input").wait_for(timeout=20000)
        page.goto(BASE+"/rights/guide",wait_until="domcontentloaded")
        page.locator(".hhba-vguide-card").first.wait_for(timeout=20000)
        context.close()
        print(f"{name}: two real resource cards, compact pledge, public routes and responsive layout OK",flush=True)
    browser.close()
