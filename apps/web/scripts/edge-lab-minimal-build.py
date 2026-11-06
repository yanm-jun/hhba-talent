#!/usr/bin/env python3
"""Build only a non-public-facing Edge P0 protocol lab.

Cloudflare Pages Functions are served from apps/web/functions, but the built
site intentionally does not expose the HHBA consumer UI, private resume vault,
admin pages or recruitment catalogue. Never substitute for the regular HHBA
Pages production build.
"""
from __future__ import annotations
import json
import shutil
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
ROOT = WEB / "dist"
ROOT.mkdir(exist_ok=True)
(ROOT/"index.html").write_text(
    '<!doctype html><html lang="zh-CN"><head>'
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    '<title>HHBA Edge P0 · 仅限内部联调</title>'
    '<meta name="robots" content="noindex,nofollow,noarchive"></head>'
    '<body><main style="max-width:700px;margin:50px auto;font:16px/1.7 Arial,sans-serif">'
    '<h1>HHBA Edge P0 · 内部联调</h1>'
    '<p>仅用于测试浏览器插件安全配对与一次性简历资料传输。'
    '不是 HHBA 正式站点，禁止上传真实简历或提供个人资料。</p>'
    '<p>正式服务请前往 <a href="https://hhba.work">hhba.work</a>。</p>'
    '</main></body></html>', encoding="utf-8")
shutil.copy2(WEB/"public"/"apply-extension-privacy.html",
             ROOT/"apply-extension-privacy.html")
# Pages functions route allowlist. Other APIs do not execute in the lab.
(ROOT/"_routes.json").write_text(
    json.dumps({"version":1,"include":["/api/apply/*"],"exclude":[]},
               separators=(",",":"))+"\n",encoding="utf-8")
print("EDGE_LAB_API_ONLY_BUILD=1")
