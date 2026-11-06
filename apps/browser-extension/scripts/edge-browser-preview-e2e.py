#!/usr/bin/env python3
"""HHBA Edge P0: real Chromium MV3 popup flow using strictly synthetic API data.

Use Playwright's bundled Chromium with a persistent context, as recommended
by Playwright for extension testing. This is NOT a Windows/macOS Edge test,
nor an authenticated request to hhba.work or Cloudflare.
"""
from __future__ import annotations
import base64
import hashlib
import json
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

SOURCE = Path(__file__).resolve().parents[1]
PREVIEW = "https://preview-e2e.hhba-talent.pages.dev"
PAIR_CODE = "ABCDEFGHJKLM"
DEVICE = "hhbaext_" + "a" * 64

def extension_id(manifest: dict) -> str:
    digest = hashlib.sha256(base64.b64decode(manifest["key"])).digest()[:16]
    return "".join(chr(ord("a") + (b >> 4)) + chr(ord("a") + (b & 15)) for b in digest)

def main() -> None:
    with tempfile.TemporaryDirectory(prefix="hhba-edge-browser-e2e-") as td:
        root = Path(td)
        extension = root / "edge-preview"
        subprocess.run(
            ["node", str(SOURCE / "scripts" / "stage-preview.mjs"),
             PREVIEW, str(extension)], check=True, capture_output=True, text=True,
        )
        manifest = json.loads((extension / "manifest.json").read_text())
        ext_id = extension_id(manifest)
        assert manifest["optional_host_permissions"] == [PREVIEW+"/*"]
        assert "隔离预览测试" in manifest["name"]
        expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat().replace("+00:00","Z")
        calls: list[dict] = []
        claimed = False

        with sync_playwright() as playwright:
            context = playwright.chromium.launch_persistent_context(
                str(root / "profile"),
                channel="chromium",
                headless=True,
                args=[
                    f"--disable-extensions-except={extension}",
                    f"--load-extension={extension}",
                ],
            )
            try:
                def api_route(route) -> None:
                    nonlocal claimed
                    req = route.request
                    url = req.url
                    if not url.startswith(PREVIEW + "/api/apply/extension/"):
                        return route.abort("blockedbyclient")
                    path = url.split("/api/apply/extension/", 1)[1]
                    headers = req.headers
                    calls.append({
                        "path": path, "method": req.method,
                        "origin": headers.get("origin", ""),
                        "authenticated": headers.get("authorization", "") == "Bearer " + DEVICE,
                    })
                    # Even simulated requests must originate from this one
                    # loaded MV3 extension; reject all other origins.
                    if headers.get("origin") != f"chrome-extension://{ext_id}":
                        return route.fulfill(status=403, content_type="application/json",
                            body='{"ok":false,"error":"EXTENSION_ORIGIN_DENIED"}')
                    response = {"ok": True}
                    status = 200
                    if path == "claim" and req.method == "POST":
                        body = req.post_data_json
                        if body.get("code") != PAIR_CODE:
                            status, response = 400, {"ok": False, "error": "PAIR_CODE_INVALID"}
                        else:
                            response = {"ok": True, "token": DEVICE, "expiresAt": expires}
                    elif path == "wallet" and req.method == "GET":
                        if headers.get("authorization") != "Bearer " + DEVICE:
                            status, response = 401, {"ok":False,"error":"EXTENSION_SESSION_INVALID"}
                        else:
                            response = {"ok":True,"wallet":{"purchased":0,"consumed":0,"reserved":0,"available":0},"expiresAt":expires}
                    elif path == "profile/claim" and req.method == "POST":
                        if headers.get("authorization") != "Bearer " + DEVICE:
                            status,response=401,{"ok":False,"error":"EXTENSION_SESSION_INVALID"}
                        elif claimed:
                            status,response=404,{"ok":False,"error":"PROFILE_TRANSFER_NOT_READY"}
                        else:
                            claimed=True
                            response={"ok":True,"profile":{"fullName":"虚构测试用户","email":"sample@example.invalid","school":"示例学院","major":"艺术设计"}}
                    elif path == "disconnect" and req.method == "POST":
                        response={"ok":True}
                    else:
                        status,response=405,{"ok":False,"error":"METHOD_NOT_ALLOWED"}
                    return route.fulfill(
                        status=status,
                        content_type="application/json; charset=utf-8",
                        headers={
                            "Access-Control-Allow-Origin": f"chrome-extension://{ext_id}",
                            "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
                            "Access-Control-Allow-Headers":"Authorization, Content-Type",
                            "Cache-Control":"no-store",
                        },
                        body=json.dumps(response,ensure_ascii=False),
                    )
                # All Preview traffic is routed in-memory. No synthetic
                # token or personal data is sent over the internet.
                context.route(PREVIEW + "/**",api_route)
                page = context.new_page()
                page.goto(f"chrome-extension://{ext_id}/popup.html",wait_until="domcontentloaded")
                page.locator("#tab-account").click()
                expect(page.locator("#view-account")).to_be_visible()
                # No opt-in -> no profile claim request, even if already linked.
                page.locator("#profile-sync-claim").click()
                expect(page.locator("#status")).to_contain_text("请先确认本次")
                assert not any(c["path"]=="profile/claim" for c in calls)

                page.locator("#pair-code").fill(PAIR_CODE)
                page.locator("#pair-connect").click()
                expect(page.locator("#account-state")).to_contain_text("已连接", timeout=15000)
                expect(page.locator("#account-balance")).to_contain_text("剩余次数：0")
                assert any(c["path"]=="claim" for c in calls)
                assert any(c["path"]=="wallet" and c["authenticated"] for c in calls)

                page.locator("#profile-sync-consent").check()
                page.locator("#profile-sync-claim").click()
                expect(page.locator('#profile-fields input[name="fullName"]')).to_have_value("虚构测试用户")
                expect(page.locator('#profile-fields input[name="email"]')).to_have_value("sample@example.invalid")
                assert sum(c["path"]=="profile/claim" for c in calls)==1
                # Success requires explicit local storage, not just page display.
                saved = page.evaluate(
                    "() => chrome.storage.local.get('hhba.apply.profile.v1')"
                )
                assert saved["hhba.apply.profile.v1"]["fullName"] == "虚构测试用户"

                page.locator("#tab-account").click()
                page.on("dialog",lambda dialog: dialog.accept())
                page.locator("#profile-sync-consent").check()
                page.locator("#profile-sync-claim").click()
                expect(page.locator("#status")).to_contain_text("已过期/领取",timeout=7000)
                assert sum(c["path"]=="profile/claim" for c in calls)==2
                page.locator("#pair-disconnect").click()
                expect(page.locator("#account-state")).to_contain_text("已在本机断开")
                session = page.evaluate(
                    "() => chrome.storage.session.get('hhba.apply.extension.session.v1')"
                )
                assert not session.get("hhba.apply.extension.session.v1")
                assert any(c["path"]=="disconnect" for c in calls)
                assert all(c["origin"]==f"chrome-extension://{ext_id}" for c in calls)
                print("PASS: real Chromium MV3 popup pairing, explicit profile consent, local import, replay denial and disconnect")
            finally:
                context.close()

if __name__ == "__main__":
    main()
