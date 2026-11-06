#!/usr/bin/env python3
"""Mark only the separate Edge P0 lab Pages project as non-indexable.

This is run by the lab project's build command after the canonical HHBA
Cloudflare build. The main hhba-talent Pages project does NOT invoke it.
"""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1] / "dist"
if not (ROOT / "index.html").is_file():
    raise SystemExit("Refuse to edit output: canonical HHBA build has not finished")
(ROOT / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")
# Label the isolated test hostname so no visitor confuses it with the public HHBA site.
page = ROOT / "index.html"
html = page.read_text(encoding="utf-8")
if "<body>" not in html:
    raise SystemExit("No body element found in generated test build")
banner = ('<div role="note" id="hhba-edge-lab-banner" '
          'style="position:fixed;top:0;left:0;right:0;z-index:2147483647;'
          'background:#fff3c1;color:#573300;padding:8px 14px;'
          'text-align:center;font:600 13px Arial,sans-serif">'
          'HHBA 插件内部联调环境 · 非正式网站 · 请勿提交个人真实简历'
          '</div>')
page.write_text(html.replace("<body>", "<body>"+banner, 1), encoding="utf-8")
headers = ROOT / "_headers"
prior = headers.read_text(encoding="utf-8") if headers.exists() else ""
headers.write_text(prior.rstrip()+"\n\n/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n", encoding="utf-8")
print("EDGE_LAB_NONINDEXABLE=1")
