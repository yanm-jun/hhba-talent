#!/usr/bin/env python3
"""Build ONLY the existing HHBA admin UI for standalone admin.hhba.work.

Do not run the public website's media/Vite build, and do not expose any
production database exports as public static files. Cloudflare Pages Functions
still guard the private pages and APIs via verified administrator sessions.
"""
from __future__ import annotations
import os
import shutil
import subprocess
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
REPO = WEB.parents[1]
SOURCE = REPO / "apps" / "admin-preview"
DIST = WEB / "dist"

def main():
    branch = os.environ.get("CF_PAGES_BRANCH", "")
    if branch != "feat/admin-password-console-20261112":
        raise SystemExit("Refusing standalone admin build on an unapproved branch: " + branch)
    # The private employer baseline lives in admin-only KV catalog:baseline:v1.
    # Never download a one-hour D1 export URL at build time: that expiring
    # dependency previously blocked otherwise-safe production deployments.
    # Pages Functions read this private baseline only after admin verification.
    admin = DIST / "admin-preview"
    admin.mkdir(parents=True, exist_ok=True)
    files = [
        "index.html","dashboard.js","styles.css","library.js","library.css",
        "library-file-ui.js","library-file-import.js","admin-console-ui.js",
        "favicon.svg"
    ]
    for f in files:
        shutil.copy2(SOURCE / f, admin / f)

    # Versioned filenames prevent a browser from combining new HTML/logo with
    # a previously cached stylesheet from earlier production deployments.
    shutil.copy2(SOURCE / "styles.css", admin / "styles-hhba-v2.css")
    shutil.copy2(SOURCE / "library.css", admin / "library-hhba-v2.css")
    page = (admin / "index.html").read_text(encoding="utf-8")
    rewrites = [
        ('href="/styles.css"','href="./styles-hhba-v2.css"'),
        ('src="/dashboard.js"','src="./dashboard.js"'),
        ('src="/library.js"','src="./library.js"'),
        ('src="/library-file-ui.js"','src="./library-file-ui.js"'),
        ('href="/library.css"','href="./library-hhba-v2.css"'),
        ('href="/favicon.svg"','href="./favicon.svg"'),
    ]
    for old, new in rewrites:
        if old not in page:
            raise SystemExit("Missing admin asset anchor: " + old)
        page = page.replace(old, new)
    if "</body>" not in page:
        raise SystemExit("Missing admin body closing tag")
    page = page.replace("</body>",'<script type="module" src="./admin-console-ui.js"></script></body>')
    (admin / "index.html").write_text(page,encoding="utf-8")

    for route in ["login","setup"]:
        dest = DIST / route
        dest.mkdir(parents=True,exist_ok=True)
        shutil.copy2(SOURCE / route / "index.html",dest / "index.html")
    for f in ["admin-login.css","admin-login.js","favicon.svg"]:
        shutil.copy2(SOURCE / f, DIST / f)
    shutil.copy2(SOURCE / "admin-login.css", DIST / "admin-login-brand-v2.css")
    # Fail a deployment rather than silently shipping HTML whose CSS cannot load.
    for route in ("login", "setup"):
        html = (DIST / route / "index.html").read_text(encoding="utf-8")
        if 'href="/admin-login-brand-v2.css"' not in html or 'width="48" height="48"' not in html:
            raise SystemExit("Versioned login CSS and bounded logo not linked in "+route)

    (DIST / "index.html").write_text(
        '<!doctype html><html lang="zh-CN"><meta charset="utf-8"/>'
        '<meta name="robots" content="noindex,nofollow"/>'
        '<meta http-equiv="refresh" content="0;url=/admin-preview/"/>'
        '<title>HHBA 管理后台</title>'
        '<a href="/admin-preview/">进入管理后台</a></html>',encoding="utf-8")
    # Invoke the root password middleware for ALL routes, including static files.
    # This ensures an unauthenticated visitor cannot fetch the raw admin HTML.
    (DIST / "_routes.json").write_text(
        '{"version":1,"include":["/*"],"exclude":[]}\n',encoding="utf-8")
    (DIST / "_headers").write_text(
        "/*\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n"
        "  X-Content-Type-Options: nosniff\n"
        "  Cache-Control: no-cache, max-age=0, must-revalidate\n"
        "  Permissions-Policy: camera=(), microphone=(), geolocation=()\n",
        encoding="utf-8")
    checks=[admin/f for f in files]+[
        DIST/"login/index.html",DIST/"setup/index.html",
        DIST/"admin-login.css",DIST/"admin-login-brand-v2.css",DIST/"admin-login.js",DIST/"index.html",
        admin/"styles-hhba-v2.css",admin/"library-hhba-v2.css"]
    assert all(x.exists() and x.stat().st_size>0 for x in checks)
    print("HHBA_PASSWORD_ADMIN_SITE_BUILD_READY files="+str(len(checks))+" route=/login/",flush=True)

if __name__=="__main__":
    main()
