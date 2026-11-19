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
        assert page.get_by_role("heading", name="了解劳动权益，从可靠的依据开始。").count() == 1
        assert page.locator(".hhba-law-topic").count() == 8
        assert page.locator(".hhba-knowledge-subtopic-card").count() == 12
        assert page.get_by_text("200 条行动建议", exact=False).count() >= 1
        assert_no_overflow(page, name + ":knowledge")
        page.screenshot(path=str(OUT / f"{name}-knowledge.png"), full_page=False, animations="disabled")

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
        page.locator(".hhba-vguide-card.is-targeted details[open]").wait_for(timeout=20000)
        assert page.get_by_text("已定位到指定建议", exact=False).count() >= 1
        assert page.evaluate("window.scrollY") > 100, f"{name}: did not scroll to detailed advice"
        assert_no_overflow(page, name + ":targeted")
        page.screenshot(path=str(OUT / f"{name}-targeted.png"), full_page=False, animations="disabled")

        page.reload(wait_until="domcontentloaded")
        page.locator(".hhba-vguide-card.is-targeted details[open]").wait_for(timeout=20000)
        assert_no_overflow(page, name + ":reload")

        page.goto(BASE + "/rights/guide", wait_until="domcontentloaded")
        page.locator(".hhba-vguide-card").first.wait_for(timeout=20000)
        assert page.get_by_role("heading", name="高性价比职场指南").count() == 1
        assert page.locator(".hhba-vguide-metrics strong").first.inner_text() == "200"
        assert page.locator(".hhba-vguide-card").count() == 24
        page.get_by_role("button", name=re.compile("继续查看下一批建议")).click()
        assert page.locator(".hhba-vguide-card").count() == 48
        assert_no_overflow(page, name + ":guide")
        page.screenshot(path=str(OUT / f"{name}-guide.png"), full_page=False, animations="disabled")

        page.get_by_role("button", name="离职与跳槽", exact=True).click()
        assert "找到 25 条" in page.locator(".hhba-vguide-result-head").inner_text()
        assert page.locator(".hhba-vguide-card").count() == 24
        page.get_by_role("button", name="全部阶段", exact=True).click()

        checkbox = page.locator(".hhba-vguide-card").first.locator('input[type="checkbox"]')
        checkbox.check()
        saved = page.evaluate("localStorage.getItem('hhba:guide:completed:v1')")
        assert saved and json.loads(saved), "Guide progress should be saved to this browser only"
        page.reload(wait_until="domcontentloaded")
        page.locator(".hhba-vguide-card").first.wait_for()
        assert page.locator(".hhba-vguide-card").first.locator('input[type="checkbox"]').is_checked()
        assert_no_overflow(page, name + ":persisted")

        page.close()
        context.close()
        print(f"{name}: 85 real-world query regressions, 20 topics, precise jump, responsive layout and local progress OK", flush=True)
    browser.close()
