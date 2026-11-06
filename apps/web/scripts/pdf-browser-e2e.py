#!/usr/bin/env python3
"""Exercise actual Vite-served PDF.js + same-origin worker in Chromium.

Synthetic document only. No real applicant data, external API, or test account.
"""
from __future__ import annotations
import socket
import subprocess
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

PORT = 4174
BASE = f"http://127.0.0.1:{PORT}"
ROOT = Path(__file__).resolve().parents[1]

def synthetic_pdf() -> bytes:
    stream = (
        b"BT\n/F1 16 Tf\n45 720 Td\n(Name: Example Applicant) Tj\n"
        b"0 -22 Td\n(Email: sample@example.invalid) Tj\nET\n"
    )
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica "
        b"/Encoding /WinAnsiEncoding >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n"
        + stream + b"endstream",
    ]
    data = b"%PDF-1.4\n% browser synthetic acceptance fixture\n"
    offsets = [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(data)
    data += f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode()
    for offset in offsets[1:]:
        data += f"{offset:010d} 00000 n \n".encode()
    data += (
        f"trailer\n<< /Root 1 0 R /Size {len(objects)+1} >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    ).encode()
    return data

def await_server(proc: subprocess.Popen, timeout: float=30):
    start=time.monotonic()
    while time.monotonic()-start < timeout:
        if proc.poll() is not None:
            raise AssertionError("Vite development server exited unexpectedly")
        try:
            with socket.create_connection(("127.0.0.1",PORT), timeout=.4):
                return
        except (OSError, TimeoutError):
            time.sleep(.3)
    raise AssertionError("Vite development server did not start")

def main():
    with subprocess.Popen(
        ["npm","run","dev","--","--host","127.0.0.1","--port",str(PORT),"--strictPort"],
        cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT,
    ) as server:
        try:
            await_server(server)
            with sync_playwright() as p:
                browser=p.chromium.launch(headless=True)
                page=browser.new_page()
                denied=[]
                page.route("**/*",lambda route: (
                    route.continue_() if route.request.url.startswith(BASE+"/")
                    else (denied.append(route.request.url),route.abort())
                ))
                page.goto(BASE+"/",wait_until="domcontentloaded",timeout=20000)
                result=page.evaluate(
                    """async (bytes) => {
                      const {extractPdfText}=await import('/src/services/pdfProfile.mjs');
                      return await extractPdfText(Uint8Array.from(bytes).buffer);
                    }""",
                    list(synthetic_pdf()),
                )
                assert result["pages"]==1,result
                assert "Example Applicant" in result["text"],result
                assert "sample@example.invalid" in result["text"],result
                assert not denied,"unexpected outbound request(s): "+str(denied[:3])
                browser.close()
            print("PASS: real Chromium/Vite first-party PDF.js worker parsed the test PDF without external network")
        finally:
            server.terminate()
            try:server.wait(timeout=4)
            except subprocess.TimeoutExpired:server.kill()

if __name__=="__main__":
    main()
