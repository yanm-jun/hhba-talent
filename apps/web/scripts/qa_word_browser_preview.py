"""Actual Chromium smoke for HHBA's local-only DOCX renderer.

Runs only under GitHub Actions against a synthetic python-docx fixture.
No real candidate account, API key, Cloudflare database or production URL.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = os.environ.get("HHBA_QA_URL", "http://127.0.0.1:4173")
ARTIFACTS = Path(os.environ.get("HHBA_WORD_BROWSER_ARTIFACT_DIR", "/tmp/hhba-word-browser-qa"))
ARTIFACTS.mkdir(parents=True, exist_ok=True)
URL = BASE + "/scripts/qa-word-browser-preview.html"
for _ in range(80):
    try:
        with urllib.request.urlopen(URL, timeout=2) as response:
            if response.status == 200:
                break
    except Exception:
        time.sleep(0.5)
else:
    raise AssertionError("HHBA development-only browser fixture never became ready")

reports = []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
    for name, viewport in (
        ("desktop", {"width": 1440, "height": 900}),
        ("mobile", {"width": 390, "height": 844}),
    ):
        page = browser.new_page(viewport=viewport, locale="zh-CN", device_scale_factor=1)
        browser_errors = []
        external_requests = []
        page.on("pageerror", lambda error: browser_errors.append(str(error)))
        def capture(request):
            if not request.url.startswith(BASE + "/") and not request.url.startswith("data:") and not request.url.startswith("blob:"):
                external_requests.append(request.url[:250])
        page.on("request", capture)
        page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_function("window.__HHBA_WORD_QA !== undefined", timeout=90000)
        result = page.evaluate("window.__HHBA_WORD_QA")
        report = {"viewport": name,
                  "state": result["state"],
                  "pages": result.get("pageCount"),
                  "anchors": len(result.get("anchors", [])),
                  "images": result.get("images"),
                  "browserErrors": browser_errors,
                  "externalRequests": external_requests}
        reports.append(report)
        page.screenshot(path=str(ARTIFACTS / f"{name}-synthetic-docx.png"),
                        full_page=True, animations="disabled")
        assert result["state"] == "ok", f"{name}: {result}"
        assert result["pageCount"] >= 1, f"{name}: no DOCX pages rendered"
        assert "负责门店运营及日常数据整理工作" in result["text"], f"{name}: missing original candidate wording"
        assert "第二页仅用于核验图片表格及位置均保持不变" in result["text"], f"{name}: missing second-page content"
        assert "岗位经历" in result["text"], f"{name}: missing table contents"
        assert result["images"] >= 1, f"{name}: embedded graphic not shown"
        assert result["remoteImageCount"] == 0, f"{name}: external image found"
        assert result["scriptTags"] == 0, f"{name}: document injected scripts"
        matches = [a for a in result["anchors"]
                   if a["text"] == "负责门店运营及日常数据整理工作"]
        assert len(matches) == 1, f"{name}: unique editable source text cannot be anchored"
        assert sum(a["text"] == "虚构测试：多节点岗位运营经历" for a in result["anchors"]) == 1, f"{name}: split paragraph anchor missing"
        assert result["splitPreview"] and result["splitRestored"], f"{name}: split paragraph Siri preview failed"
        assert len(external_requests) == 0, f"{name}: DOCX preview attempted unexpected external requests: {external_requests}"
        assert len(browser_errors) == 0, f"{name}: unhandled browser errors {browser_errors}"
        page.close()
    browser.close()
(ARTIFACTS / "report.json").write_text(
    json.dumps(reports, ensure_ascii=False, indent=2), encoding="utf-8")
print("HHBA_BROWSER_DOCX_QA", json.dumps(reports, ensure_ascii=False))
