"""HHBA real-browser acceptance for two public free knowledge products.

Runs against a local production Vite preview, not customer accounts or real case records.
Validates common-language retrieval, route hand-off, exact expanded steps,
responsive layouts, no overflow and browser-only progress.
"""
import json
import os
import re
import time
import urllib.request
import unicodedata
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("HHBA_BROWSER_URL", "http://127.0.0.1:4173").rstrip("/")
OUT = Path(os.environ.get("HHBA_SCREENSHOT_DIR", "tmp/rights-guide-screens"))
OUT.mkdir(parents=True, exist_ok=True)
ROOT = Path(__file__).resolve().parents[1]
INTENTS = json.loads((ROOT / "src/data/laborRightsSearchIntents.json").read_text(encoding="utf-8"))
GROUPS = json.loads((ROOT / "src/data/laborRightsBrowseGroups.json").read_text(encoding="utf-8"))
REGRESSION = json.loads((ROOT / "src/data/laborRightsQueryFixtures.json").read_text(encoding="utf-8"))
MAIN_BY_INTENT = {intent["id"]: intent["primary"] for intent in INTENTS["intents"]}

def normalized(text):
    return "".join(ch for ch in unicodedata.normalize("NFKC", text).lower()
                   if not ch.isspace() and not unicodedata.category(ch).startswith("P"))

def matched_intents(query):
    q = normalized(query)
    return [intent for intent in INTENTS["intents"]
            if any(normalized(term) in q for term in intent["phrases"])]

for _ in range(60):
    try:
        with urllib.request.urlopen(BASE + "/rights/knowledge", timeout=2) as response:
            if response.status == 200:
                break
    except Exception:
        time.sleep(0.5)
else:
    raise AssertionError("Local Vite production preview did not become ready")


def assert_no_overflow(page, name):
    values = page.evaluate("""() => ({
        viewport: innerWidth,
        html: document.documentElement.scrollWidth,
        body: document.body.scrollWidth
    })""")
    assert values["html"] <= values["viewport"] + 2, f"{name}: html overflow {values}"
    assert values["body"] <= values["viewport"] + 2, f"{name}: body overflow {values}"


CASES = [
    ("公司三个月不发工资", "unpaid-wages", None),
    ("领导今天扣钱了", "unpaid-wages", "payroll-deductions"),
    ("销售提成一直没结算", "unpaid-wages", "commissions-bonuses"),
    ("入职后一直没签合同", "labor-contracts", "written-contract"),
    ("试用期工资怎么算", "labor-contracts", "probation-rules"),
    ("试用期不交社保", "social-insurance", "probation-insurance"),
    ("加班不给钱怎么办", "overtime-leave", "overtime-proof"),
    ("未休年假怎么办", "overtime-leave", "annual-leave"),
    ("被裁员补偿怎么算", "unlawful-dismissal", "severance-compensation"),
    ("不给离职证明", "labor-contracts", "departure-certificate"),
    ("公司强制调岗", "transfer-paycuts", "change-agreement"),
    ("竞业限制影响找工作", "labor-contracts", "non-compete"),
    ("劳动仲裁怎么申请", "unlawful-dismissal", "arbitration-timing"),
    ("上班受伤怎么申请", "work-injury", None),
]


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for name, viewport in [
        ("desktop", {"width": 1440, "height": 900}),
        ("mobile", {"width": 390, "height": 844}),
    ]:
        context = browser.new_context(viewport=viewport, device_scale_factor=1)
        page = context.new_page()
        page.goto(BASE + "/rights/knowledge", wait_until="domcontentloaded")
        page.locator(".hhba-knowledge-search input").wait_for(timeout=20000)
        assert page.get_by_role("heading", name="你遇到了什么职场问题？").count() == 1
        buttons = page.locator("button.hhba-knowledge-category")
        assert buttons.count() == 6, f"{name}: category navigation must have six entries"
        assert page.locator(".hhba-law-topic").count() == 1
        assert page.locator(".hhba-knowledge-subtopic-card").count() == 2
        assert page.get_by_text("200 条原创建议", exact=False).count() >= 1
        assert_no_overflow(page, name + ":knowledge")
        page.screenshot(path=str(OUT / f"{name}-knowledge.png"), full_page=False, animations="disabled")

        # All twenty real source-backed topic routes must still be available by
        # choosing the six categories. No double listing and no missing route.
        discovered = set()
        for group in GROUPS["groups"]:
            button = page.get_by_role("button", name=group["label"], exact=True)
            button.click()
            assert button.get_attribute("aria-pressed") == "true"
            rows = page.locator("a.hhba-knowledge-result-row")
            assert rows.count() == len(group["topics"]), (
                f"{name}: {group['label']} has a wrong number of linked questions"
            )
            for topic in group["topics"]:
                href = f"/rights/knowledge/{topic['slug']}"
                assert page.locator(f'a.hhba-knowledge-result-row[href="{href}"]').count() == 1, (
                    f"{name}: real article missing: {href}"
                )
                discovered.add(topic["slug"])
        assert len(discovered) == 20, f"{name}: lost or duplicated a real legal article"
        page.get_by_role("button", name="工资与报酬", exact=True).click()
        assert_no_overflow(page, name + ":categories")

        search = page.locator(".hhba-knowledge-search input")
        for phrase, main_slug, sub_slug in CASES:
            search.fill(phrase)
            assert page.locator(f'a.hhba-law-topic[href$="/rights/knowledge/{main_slug}"]').count() > 0, (
                f"{name}: wrong major rights topic for {phrase}"
            )
            if sub_slug:
                assert page.locator(
                    f'a.hhba-knowledge-subtopic-card[href$="/rights/knowledge/{sub_slug}"]'
                ).count() > 0, f"{name}: missing detailed topic {sub_slug} for {phrase}"
            matching_intents = [
                intent for intent in INTENTS["intents"]
                if any(term.lower() in phrase.lower() for term in intent["phrases"])
            ]
            assert matching_intents, f"{name}: missing intent for {phrase}"
            expected_first_id = matching_intents[0]["featuredActions"][0]
            first_action_href = page.locator(".hhba-knowledge-action").first.get_attribute("href")
            assert first_action_href == f"/rights/guide?tip={expected_first_id}", (
                f"{name}: {phrase} should prioritize a concrete next step {expected_first_id}; got {first_action_href}"
            )
        # Real regression: 70 independently written workplace questions and 15 unrelated controls.
        for case in REGRESSION["cases"]:
            phrase = case["query"]
            search.fill(phrase)
            intents_for_case = matched_intents(phrase)
            expected = case["expectedIntent"]
            if expected is None:
                assert not intents_for_case, f"{name}: unrelated phrase unexpectedly has an intent: {phrase}"
                assert page.locator(".hhba-law-topic").count() == 0, f"{name}: out-of-scope law match: {phrase}"
                assert page.locator(".hhba-knowledge-subtopic-card").count() == 0, f"{name}: out-of-scope subtopic match: {phrase}"
                assert page.locator(".hhba-knowledge-action").count() == 0, f"{name}: out-of-scope advice match: {phrase}"
                continue
            assert any(item["id"] == expected for item in intents_for_case), (
                f"{name}: missing intent {expected} for {phrase}"
            )
            main_slug = MAIN_BY_INTENT[expected]
            assert page.locator(f'a.hhba-law-topic[href$="/rights/knowledge/{main_slug}"]').count() > 0, (
                f"{name}: missing legal topic {main_slug} for {phrase}"
            )
            expected_first_id = intents_for_case[0]["featuredActions"][0]
            first_href = page.locator(".hhba-knowledge-action").first.get_attribute("href")
            assert first_href == f"/rights/guide?tip={expected_first_id}", (
                f"{name}: {phrase} should prioritize {expected_first_id}; got {first_href}"
            )
        search.fill("公司三个月不发工资")
        linked = page.locator(".hhba-knowledge-action").first
        linked.wait_for()
        url = linked.get_attribute("href")
        assert url and url.startswith("/rights/guide?tip=") and re.fullmatch(r"[a-z]+", url.split("tip=", 1)[1]), f"broken guide URL {url}"
        linked.click()
        page.locator(".hhba-edition-reading").wait_for(timeout=20000)
        assert page.locator(".hhba-edition-article-header h1").count() == 1
        assert page.locator(".hhba-edition-practical-steps li").count() == 3
        assert page.locator(".hhba-edition-next-reads a").count() >= 1
        assert_no_overflow(page, name + ":reading")
        page.screenshot(path=str(OUT / f"{name}-reading.png"), full_page=False, animations="disabled")
        page.reload(wait_until="domcontentloaded")
        page.locator(".hhba-edition-practical-steps li").first.wait_for(timeout=20000)
        assert page.locator(".hhba-edition-practical-steps li").count() == 3

        page.goto(BASE + "/rights/guide", wait_until="domcontentloaded")
        page.locator(".hhba-edition-cover").wait_for(timeout=20000)
        assert page.locator(".hhba-edition-cover h1").count() == 1
        assert "职场这条路" in page.locator(".hhba-edition-cover h1").inner_text()
        assert "200 条原创建议" in page.locator(".hhba-edition-cover-footer").inner_text()
        assert page.locator(".hhba-edition-feature").count() == 1
        assert page.locator(".hhba-edition-result-row").count() == 0, (
            f"{name}: a visitor should see the editorial cover rather than a card/list wall"
        )
        assert_no_overflow(page, name + ":cover")
        page.screenshot(path=str(OUT / f"{name}-guide-cover.png"), full_page=False, animations="disabled")

        guide_search = page.locator(".hhba-edition-search input")
        guide_search.fill("工资")
        results = page.locator(".hhba-edition-result-row")
        results.first.wait_for(timeout=10000)
        assert results.count() <= 8, f"{name}: search should paginate cleanly"
        assert_no_overflow(page, name + ":search")
        guide_search.fill("")
        page.get_by_role("button", name="浏览全部章节").click()
        chapters = page.locator(".hhba-edition-chapters button")
        assert chapters.count() == 8, f"{name}: all eight chapters must remain available"
        chapters.filter(has_text="离职与跳槽").click()
        assert "找到 25 篇" in page.locator(".hhba-edition-results-top").inner_text()
        page.wait_for_function("document.querySelectorAll('.hhba-edition-result-row').length === 8", timeout=10000)
        page.get_by_role("button", name=re.compile("继续查看")).click()
        assert page.locator(".hhba-edition-result-row").count() == 16
        assert_no_overflow(page, name + ":chapters")
        page.screenshot(path=str(OUT / f"{name}-chapters.png"), full_page=False, animations="disabled")

        page.locator(".hhba-edition-result-row").first.click()
        page.locator(".hhba-edition-reading-action button").wait_for(timeout=20000)
        page.get_by_role("button", name="标记已完成").click()
        assert page.locator(".hhba-edition-reading-action button").get_attribute("aria-pressed") == "true"
        saved = page.evaluate("localStorage.getItem('hhba:guide:completed:v1')")
        assert saved and json.loads(saved), f"{name}: completed reading progress not stored locally"
        page.reload(wait_until="domcontentloaded")
        page.locator(".hhba-edition-reading-action button").wait_for(timeout=20000)
        assert page.get_by_role("button", name="已标记完成").get_attribute("aria-pressed") == "true"
        assert_no_overflow(page, name + ":saved")
        page.screenshot(path=str(OUT / f"{name}-reader-complete.png"), full_page=False, animations="disabled")

        page.close()
        context.close()
        print(f"{name}: 85 rights queries, 20 topics, magazine cover, 8 chapters, article reader and local progress OK", flush=True)
    browser.close()
