#!/usr/bin/env python3
"""Verify Wikimedia HTTP 429 cannot break HHBA's Schneider media preparation.

This test intentionally blocks the remote source. It reads the one canonical
GitHub Pages media step shared by Cloudflare Pages and checks that the tracked,
brand-identified fallback remains byte-for-byte untouched.
"""
from pathlib import Path
import hashlib
import subprocess
import sys
import textwrap
import yaml

root=Path(__file__).resolve().parents[3]
workflow=yaml.safe_load((root/'.github/workflows/hhba-github-pages-preview.yml').read_text())
steps=workflow['jobs']['build']['steps']
matching=[s for s in steps if s.get('name')=='Import source-backed Schneider Electric complete wordmark']
assert len(matching)==1, 'Canonical Schneider preparation step missing'
source=matching[0]['run']
assert source.count("python - <<'PY'")==1 and source.rstrip().endswith('PY')
body=textwrap.dedent(source.split("python - <<'PY'",1)[1].rsplit('PY',1)[0]).strip()
assert 'check_svg(cached,False)' in body and "SCHNEIDER_VERIFIED_LOCAL_ICON_FALLBACK" in body
local=root/'apps/web/public/images/autumn-real-logos/cn-autumn-002.svg'
before=local.read_bytes()
assert '<title>Schneider Electric</title>' in before.decode('utf-8'), 'Unverified fallback identity'
hash_before=hashlib.sha256(before).hexdigest()
inject="""import urllib.request,urllib.error
def blocked(*args,**kwargs):
    raise urllib.error.HTTPError('https://upload.wikimedia.org',429,'rate limited',None,None)
urllib.request.urlopen=blocked
"""
run=subprocess.run([sys.executable,'-c',inject+'\n'+body],cwd=root,capture_output=True,text=True)
assert run.returncode==0, run.stdout+'\n'+run.stderr
assert 'SCHNEIDER_VERIFIED_LOCAL_ICON_FALLBACK' in run.stdout,run.stdout
assert hashlib.sha256(local.read_bytes()).hexdigest()==hash_before, 'Fallback unexpectedly modified tracked asset'
print('SCHNEIDER_429_LOCAL_FALLBACK_VERIFIED',len(before))
