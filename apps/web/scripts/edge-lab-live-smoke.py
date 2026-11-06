#!/usr/bin/env python3
"""Live network smoke of ONLY the isolated HHBA Edge P0 lab Pages deployment.

Never supplies a real login token, contact detail, document, or merchant API
credential. Asserts official-site payment is OFF in the lab and extension
Origin + device Bearer are enforced on the deployed Cloudflare runtime.
"""
from __future__ import annotations
import json
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse

SITE="https://hhba-edge-p0-lab.pages.dev"
EXT="chrome-extension://fjkcpgikachmfhajlghgekeicgbdagej"
TIMEOUT_SECONDS=240

def call(path,method="GET",origin=None,data=None,headers=None):
    assert path.startswith("/") and not path.startswith("//")
    assert urlparse(SITE).hostname=="hhba-edge-p0-lab.pages.dev"
    payload=json.dumps(data).encode("utf-8") if data is not None else None
    request=urllib.request.Request(SITE+path,data=payload,method=method,headers={
        "User-Agent":"HHBA-Edge-P0-Isolated-Smoke/1.0",
        **({"Origin":origin} if origin is not None else {}),
        **({"Content-Type":"application/json"} if payload is not None else {}),
        **(headers or {}),
    })
    try:
        with urllib.request.urlopen(request,timeout=12) as response:
            return response.status,dict(response.headers),response.read(10000)
    except urllib.error.HTTPError as e:
        return e.code,dict(e.headers),e.read(10000)

def json_result(result):
    status,headers,data=result
    try:return status,headers,json.loads(data.decode("utf-8"))
    except (ValueError,UnicodeDecodeError):
        raise AssertionError(f"Expected JSON (HTTP {status}), not an SPA fallback")

def ensure_loaded():
    deadline=time.monotonic()+TIMEOUT_SECONDS
    attempts=0
    while time.monotonic()<deadline:
        attempts+=1
        try:
            status,_,v=json_result(call("/api/apply/config"))
            if (status==200 and v.get("ok") is True and
                v.get("pairingEnabled") is True and
                v.get("profileSyncEnabled") is True):
                print(f"LAB_CONFIG_READY attempts={attempts}",flush=True)
                return v
        except (AssertionError,OSError,TimeoutError,urllib.error.URLError):
            pass
        time.sleep(5)
    raise AssertionError("Isolated lab did not serve configured pairing API within 240 seconds")

def main():
    v=ensure_loaded()
    assert v.get("paymentEnabled") is False,"Lab must not allow Alipay"
    assert v.get("tasksEnabled") is False,"Lab must not run paid application tasks"
    assert "HHBA_APPLY_PAIRING_PEPPER" not in str(v)
    assert "HHBA_APPLY_PROFILE_TRANSFER_KEY" not in str(v)

    # The browser extension may preflight the authenticated cross-origin POST.
    status,headers,body=call("/api/apply/extension/wallet","OPTIONS",EXT,headers={
        "Access-Control-Request-Method":"POST",
        "Access-Control-Request-Headers":"authorization",
    })
    assert status==204,(status,body[:200])
    assert headers.get("Access-Control-Allow-Origin")==EXT
    assert "POST" in headers.get("Access-Control-Allow-Methods","")
    assert headers.get("Access-Control-Allow-Credentials","")!="true"

    # Exact Origin is compulsory, even when the caller supplies a device-shaped
    # fake token. Never relax this to support an Origin-less GET request.
    bad_auth={"Authorization":"Bearer hhbaext_"+"0"*64}
    status,_,body=json_result(call("/api/apply/extension/wallet","POST",None,headers=bad_auth))
    assert status==403 and body.get("error")=="EXTENSION_ORIGIN_DENIED",(status,body)
    bad="chrome-extension://"+"a"*32
    status,_,body=json_result(call("/api/apply/extension/wallet","POST",bad,headers=bad_auth))
    assert status==403 and body.get("error")=="EXTENSION_ORIGIN_DENIED",(status,body)
    status,headers,body=json_result(call("/api/apply/extension/wallet","POST",EXT,headers=bad_auth))
    assert status==401 and body.get("error")=="EXTENSION_SESSION_INVALID",(status,body)
    assert headers.get("Access-Control-Allow-Origin")==EXT
    status,_,body=json_result(call("/api/apply/extension/wallet","GET",None,headers=bad_auth))
    assert status==403,(status,body)

    # Invalid pairing input cannot reveal or create a valid session.
    status,_,body=json_result(call("/api/apply/extension/claim","POST",EXT,{"code":"bad"}))
    assert status==400 and body.get("error")=="PAIR_CODE_INVALID",(status,body)
    status,_,body=json_result(call("/api/apply/profile-transfer/prepare","POST",SITE,
                                 {"consent":False,"resumeId":"bogus"}))
    assert status==401 and body.get("error")=="SESSION_INVALID",(status,body)

    status,_,html=call("/")
    assert status==200 and b"HHBA" in html
    status,headers,txt=call("/robots.txt")
    assert status==200 and b"Disallow: /" in txt
    status,_,privacy=call("/apply-extension-privacy.html")
    assert status==200 and b"HHBA" in privacy

    print("PASS: real Cloudflare Pages lab runtime, isolated keys present, CORS, Origin, "
          "device auth, payment OFF, private sync auth, non-indexable pages",flush=True)

if __name__=="__main__":
    main()
