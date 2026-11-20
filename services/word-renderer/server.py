"""HHBA private Word page renderer (internal service, never a public document URL).

Only trusted HHBA server calls with a shared bearer secret are accepted.
No source document or generated document is persisted after a request.
Every export must pass the strict rendered-page visual comparison gate.
"""
from __future__ import annotations

import base64
import binascii
import hmac
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from zipfile import ZipFile, BadZipFile
import xml.etree.ElementTree as ET

QA_PATH = Path(__file__).with_name("word_layout.py")
spec = importlib.util.spec_from_file_location("word_layout", QA_PATH)
assert spec and spec.loader
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

MAX_FILE = 3 * 1024 * 1024
MAX_REQUEST = 9 * 1024 * 1024
MAX_PDF = 12 * 1024 * 1024
MAX_ITEMS = 1200
MAX_PART_SIZE = 8 * 1024 * 1024
MAX_TOTAL_EXPANDED = 30 * 1024 * 1024
MAX_PAGES = 20
IN_FLIGHT = threading.BoundedSemaphore(2)
RELS_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"

def docx_safe(contents: bytes) -> None:
    if not 100 <= len(contents) <= MAX_FILE or not contents.startswith(b"PK"):
        raise ValueError("WORD_INVALID_FILE")
    try:
        with ZipFile(__import__("io").BytesIO(contents)) as z:
            names = z.namelist()
            if len(names) > MAX_ITEMS or len(set(names)) != len(names) or \
               "word/document.xml" not in names or \
               "[Content_Types].xml" not in names or \
               "_rels/.rels" not in names:
                raise ValueError("WORD_INVALID_FILE")
            total = 0
            for item in z.infolist():
                name = item.filename
                if item.flag_bits & 1 or name.startswith("/") or "\\" in name or \
                   ".." in name.split("/") or \
                   any(s in name.lower() for s in ("vbaproject", "activex", "embeddings/", "oleobject")):
                    raise ValueError("WORD_UNSAFE_FILE")
                total += item.file_size
                if item.file_size > MAX_PART_SIZE or total > MAX_TOTAL_EXPANDED:
                    raise ValueError("WORD_UNSAFE_FILE")
                if name.endswith(".rels"):
                    if item.file_size > 500000:
                        raise ValueError("WORD_UNSAFE_FILE")
                    root = ET.fromstring(z.read(item))
                    for rel in root.iter(RELS_NS):
                        if rel.attrib.get("TargetMode", "").lower() == "external":
                            raise ValueError("WORD_EXTERNAL_RESOURCE")
            body = z.read("word/document.xml")
            if b"<!DOCTYPE" in body or b"<!ENTITY" in body:
                raise ValueError("WORD_UNSAFE_FILE")
    except (BadZipFile, ET.ParseError, OSError, RuntimeError, KeyError) as exc:
        raise ValueError("WORD_INVALID_FILE") from exc

def parse_json(raw: bytes) -> dict:
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise ValueError("WORD_INVALID_REQUEST") from exc
    if not isinstance(value, dict):
        raise ValueError("WORD_INVALID_REQUEST")
    return value

def source_bytes(value: object) -> bytes:
    if not isinstance(value, str) or len(value) > 4 * MAX_FILE // 3 + 8:
        raise ValueError("WORD_INVALID_FILE")
    try:
        data = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("WORD_INVALID_FILE") from exc
    docx_safe(data)
    return data

def render_pdf(docx: bytes) -> bytes:
    with tempfile.TemporaryDirectory(prefix="hhba-docx-preview-") as directory:
        root = Path(directory)
        original = root / "resume.docx"
        original.write_bytes(docx)
        pdf = qa.convert_word(original, root / "output", root / "profile")
        try:
            pages = subprocess.run(
                ["pdfinfo", str(pdf)], capture_output=True, text=True,
                timeout=12, check=True
            ).stdout
        except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            raise ValueError("WORD_RENDER_FAILED") from exc
        found = re.search(r"^Pages:\s*(\d+)\s*$", pages, re.M)
        if not found or not 1 <= int(found.group(1)) <= MAX_PAGES:
            raise ValueError("WORD_PAGE_LIMIT")
        if pdf.stat().st_size > MAX_PDF:
            raise ValueError("WORD_RENDER_TOO_LARGE")
        data = pdf.read_bytes()
        if not data.startswith(b"%PDF-") or len(data) < 500:
            raise ValueError("WORD_RENDER_FAILED")
        return data

class Handler(BaseHTTPRequestHandler):
    server_version = "HHBA-Word-Private"
    sys_version = ""

    def log_message(self, *_args) -> None:
        # User document paths and contents must never enter access logs.
        pass

    def reply(self, code: int, body: bytes, mime: str = "application/json") -> None:
        self.send_response(code)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(body)

    def error(self, message: str, code: int = 422) -> None:
        self.reply(code, json.dumps({"ok": False, "error": message}).encode("utf-8"))

    def do_GET(self) -> None:
        if self.path == "/health":
            self.reply(200, b'{"ok":true,"service":"hhba-private-word"}')
        else:
            self.error("NOT_FOUND", 404)

    def do_POST(self) -> None:
        secret = os.getenv("HHBA_WORD_RENDER_SHARED_SECRET", "")
        auth = self.headers.get("Authorization", "")
        if len(secret) < 32 or not hmac.compare_digest(auth, "Bearer " + secret):
            self.error("NOT_AUTHORIZED", 401)
            return
        if self.path not in ("/v1/render", "/v1/verify"):
            self.error("NOT_FOUND", 404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 10 <= length <= MAX_REQUEST:
                raise ValueError("WORD_INVALID_REQUEST")
            if self.headers.get("Content-Type", "").split(";", 1)[0] != "application/json":
                raise ValueError("WORD_INVALID_REQUEST")
            if not IN_FLIGHT.acquire(blocking=False):
                self.error("WORD_BUSY", 503)
                return
            try:
                body = parse_json(self.rfile.read(length))
                original = source_bytes(body.get("original_b64"))
                if self.path == "/v1/render":
                    self.reply(200, render_pdf(original), "application/pdf")
                    return
                edited = source_bytes(body.get("edited_b64"))
                old_text, new_text = body.get("old_text"), body.get("new_text")
                if not isinstance(old_text, str) or not isinstance(new_text, str) or \
                   not 1 <= len(old_text) <= 300 or not 1 <= len(new_text) <= 300:
                    raise ValueError("WORD_INVALID_REQUEST")
                report = qa.verify_layout_preserved(
                    original, edited, old_text=old_text, new_text=new_text
                )
                self.reply(200, json.dumps(
                    {"ok": True, "verified": True, "report": report},
                    ensure_ascii=False, separators=(",", ":")
                ).encode("utf-8"))
            finally:
                IN_FLIGHT.release()
        except ValueError as exc:
            self.error(str(exc))
        except qa.WordLayoutError as exc:
            self.error(str(exc))
        except (OSError, RuntimeError, subprocess.TimeoutExpired):
            self.error("WORD_RENDER_FAILED", 503)

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
