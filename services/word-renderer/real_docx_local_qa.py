"""Real local/offline Word HTTP integration tests using genuine OOXML files.

All text, images and identities are synthetic. Requires LibreOffice, Poppler,
Noto Sans CJK, Pillow and python-docx. Never needs Cloudflare credentials.
This script runs against the actual HHBA private renderer endpoint locally.
"""
from __future__ import annotations

import base64
import hashlib
import http.client
import io
import json
import os
import re
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from zipfile import ZipFile, ZIP_DEFLATED
from xml.etree import ElementTree as ET

from docx import Document
from docx.shared import Cm, Pt
from PIL import Image, ImageDraw

import server

FONT = "Noto Sans CJK SC"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
OLD = "负责门店运营及日常数据整理工作"
NEW = "负责门店运营及业务数据整理"
OTHER = "第二页仅用于核验图片表格及位置均保持不变"


def package_rebuild(blob, changes):
    stream = io.BytesIO()
    with ZipFile(io.BytesIO(blob)) as old:
        with ZipFile(stream, "w") as new:
            for entry in old.infolist():
                data = changes.get(entry.filename, old.read(entry.filename))
                new.writestr(entry, data)
    return stream.getvalue()


def replace_node(blob, old, new):
    with ZipFile(io.BytesIO(blob)) as doc:
        raw = doc.read("word/document.xml")
    needle = (">" + old + "</w:t>").encode()
    new_node = (">" + new + "</w:t>").encode()
    if raw.count(needle) != 1:
        raise AssertionError("Fixture target must be one exact w:t run")
    return package_rebuild(blob, {"word/document.xml": raw.replace(needle, new_node)})


def build_real_docx(root):
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = FONT
    style.font.size = Pt(10.5)
    style._element.get_or_add_rPr().get_or_add_rFonts().set(W + "eastAsia", FONT)
    section = doc.sections[0]
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2.2)
    section.right_margin = Cm(2.2)
    header = section.header.paragraphs[0]
    header.text = "HHBA / REAL DOCX INTEGRATION QA"
    footer = section.footer.paragraphs[0]
    footer.text = "仅为自动化测试，不包含真实用户信息"

    h = doc.add_paragraph()
    run = h.add_run("中文多页简历 / Synthetic Resume")
    run.bold = True
    run.font.size = Pt(16)
    run.font.name = FONT
    run._element.get_or_add_rPr().get_or_add_rFonts().set(W + "eastAsia", FONT)

    doc.add_paragraph("姓名：虚构求职者　城市：虚构城市")
    p = doc.add_paragraph()
    r = p.add_run(OLD)
    r.font.name = FONT
    r._element.get_or_add_rPr().get_or_add_rFonts().set(W + "eastAsia", FONT)
    p = doc.add_paragraph("专业背景 / Professional Experience")
    p.runs[0].bold = True
    table = doc.add_table(rows=2, cols=2)
    table.style = "Table Grid"
    table.cell(0, 0).text = "岗位经历"
    table.cell(0, 1).text = "门店运营 / Sales Operations"
    table.cell(1, 0).text = "经历真实性"
    table.cell(1, 1).text = "不虚构任何业绩或任职记录"

    img = Image.new("RGB", (440, 110), "white")
    draw = ImageDraw.Draw(img)
    draw.rectangle((8, 8, 432, 100), outline=(44, 104, 156), width=3)
    draw.line((25, 79, 107, 53, 184, 67, 293, 25, 411, 39), fill=(43, 95, 162), width=3)
    path = root / "synthetic_chart.png"
    img.save(path)
    doc.add_picture(str(path), width=Cm(9))
    doc.add_page_break()
    doc.add_paragraph("第二页　Skills / Education").runs[0].bold = True
    doc.add_paragraph(OTHER)
    doc.add_paragraph("中文、英文、图表、页眉和页脚都要保持原排版。")
    path = root / "authored.docx"
    doc.save(path)
    raw = path.read_bytes()

    # The default python-docx template uses Office theme family attributes,
    # which the production renderer intentionally fails closed on. Build a
    # deliberate explicit-font fixture without silently substituting fonts.
    # Preserve every other OOXML prefix and metadata byte, including
    # mc:Ignorable declarations. Full ElementTree reserialization can drop
    # namespace declarations that Office still uses in mc:Ignorable.
    def explicit_font_tag(match):
        tag = match.group(0)
        for attr in ("asciiTheme", "hAnsiTheme", "eastAsiaTheme", "csTheme"):
            tag = re.sub(r'\\s+w:' + attr + r'="[^"]*"', "", tag)
        for attr in ("ascii", "hAnsi", "eastAsia", "cs"):
            pattern = r'w:' + attr + r'="[^"]*"'
            if re.search(pattern, tag):
                tag = re.sub(pattern, 'w:' + attr + '="' + FONT + '"', tag)
            else:
                tag = tag.replace("/>", ' w:' + attr + '="' + FONT + '"/>')
        return tag
    updates = {}
    with ZipFile(io.BytesIO(raw)) as pkg:
        for name in pkg.namelist():
            if name not in ("word/document.xml", "word/styles.xml") and not (
                name.startswith("word/header") or name.startswith("word/footer")
            ):
                continue
            if not name.endswith(".xml"):
                continue
            part = pkg.read(name).decode("utf-8")
            part = re.sub(r'<w:rFonts\\b[^>]*?/>', explicit_font_tag, part)
            updates[name] = part.encode("utf-8")
    explicit = package_rebuild(raw, updates)
    return raw, explicit


class RealChineseWordHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(os.environ.get("HHBA_REAL_WORD_QA_OUTPUT", "/tmp/hhba-real-word-ci"))
        cls.root.mkdir(parents=True, exist_ok=True)
        cls.theme_original, cls.original = build_real_docx(cls.root)
        cls.edited = replace_node(cls.original, OLD, NEW)
        cls.secret = "hhba-offline-only-" + "z" * 45
        os.environ["HHBA_WORD_RENDER_SHARED_SECRET"] = cls.secret
        for name, content in (
            ("original-real-cjk.docx", cls.original),
            ("edited-real-cjk.docx", cls.edited),
            ("theme-font-example-rejected.docx", cls.theme_original),
        ):
            (cls.root / name).write_bytes(content)
        cls.http = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.worker = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.worker.start()
        cls.results = []

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.worker.join(timeout=5)
        (cls.root / "real-word-http-report.json").write_text(
            json.dumps({"mode": "real_offline_docx_http", "results": cls.results},
                       ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def request(self, route, payload, auth=True):
        connection = http.client.HTTPConnection("127.0.0.1", self.http.server_address[1], timeout=90)
        headers = {"Content-Type": "application/json"}
        if auth:
            headers["Authorization"] = "Bearer " + self.secret
        connection.request("POST", route, json.dumps(payload).encode("utf-8"), headers)
        response = connection.getresponse()
        content = response.read()
        kind = response.getheader("Content-Type")
        status = response.status
        connection.close()
        return status, kind, content

    def payload(self, original=None, edited=None, old=OLD, new=NEW):
        p = {"original_b64": base64.b64encode(original if original is not None else self.original).decode()}
        if edited is not None:
            p.update(edited_b64=base64.b64encode(edited).decode(), old_text=old, new_text=new)
        return p

    def record(self, case, **fields):
        self.results.append(dict(case=case, **fields))

    def test_genuine_two_page_cjk_docx_renders_with_table_image_headers(self):
        server.docx_safe(self.original)
        server.require_original_fonts(self.original)
        code, kind, raw = self.request("/v1/render", self.payload())
        self.assertEqual(code, 200, raw[:250])
        self.assertEqual(kind, "application/pdf")
        self.assertTrue(raw.startswith(b"%PDF-"))
        pdf = self.root / "original-real-cjk.pdf"
        pdf.write_bytes(raw)
        details = subprocess.run(["pdfinfo", str(pdf)], text=True, capture_output=True, check=True)
        self.assertIn("Pages:           2", details.stdout)
        text = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], text=True,
                              capture_output=True, check=True).stdout
        self.assertIn(OLD, text)
        self.assertIn(OTHER, text)
        self.assertIn("门店运营", text)
        self.record("real_cjk_render", ok=True, pages=2,
                    sha256=hashlib.sha256(raw).hexdigest())

    def test_real_edited_docx_accepts_localized_edit_without_reflow(self):
        with ZipFile(io.BytesIO(self.original)) as original, ZipFile(io.BytesIO(self.edited)) as edited:
            self.assertEqual(original.namelist(), edited.namelist())
            for name in original.namelist():
                if name != "word/document.xml":
                    self.assertEqual(original.read(name), edited.read(name))
        code, kind, raw = self.request("/v1/verify", self.payload(edited=self.edited))
        self.assertEqual(code, 200, raw[:400])
        report = json.loads(raw)["report"]
        self.assertTrue(report["passed"])
        self.assertEqual(report["page_count"], 2)
        self.assertEqual(report["changed_region"]["page"], 1)
        self.assertGreater(report["changed_pixels"], 5)
        self.record("real_cjk_verify", ok=True, report=report)
        code, kind, raw = self.request("/v1/render", self.payload(self.edited))
        self.assertEqual(code, 200, raw[:300])
        self.assertEqual(kind, "application/pdf")
        (self.root / "edited-real-cjk.pdf").write_bytes(raw)

    def test_reject_unauthorized_and_unresolved_theme_fonts(self):
        code, _, _ = self.request("/v1/render", self.payload(), auth=False)
        self.assertEqual(code, 401)
        code, _, raw = self.request("/v1/render", self.payload(self.theme_original))
        self.assertEqual(code, 422, raw[:300])
        self.assertEqual(json.loads(raw)["error"], "WORD_FONT_UNVERIFIED")
        self.record("private_auth_and_theme_gate", ok=True, theme_error="WORD_FONT_UNVERIFIED")

    def test_reject_unavailable_font_instead_of_substituting(self):
        with ZipFile(io.BytesIO(self.original)) as z:
            original = z.read("word/document.xml")
        altered = package_rebuild(self.original, {
            "word/document.xml": original.replace(FONT.encode(), b"HHBA Missing Font 2026")
        })
        code, _, raw = self.request("/v1/render", self.payload(altered))
        self.assertEqual(code, 422, raw[:300])
        self.assertEqual(json.loads(raw)["error"], "WORD_FONT_UNAVAILABLE")
        self.record("missing_font", ok=True, error="WORD_FONT_UNAVAILABLE")

    def test_reject_reflow_or_a_hidden_change_on_second_page(self):
        with ZipFile(io.BytesIO(self.edited)) as z:
            document = z.read("word/document.xml")
        self.assertEqual(document.count(OTHER.encode()), 1)
        corrupt = package_rebuild(self.edited, {
            "word/document.xml": document.replace(
                OTHER.encode(), "第二页已被偷偷更改，不属于用户确认的修改".encode()
            )
        })
        code, _, raw = self.request("/v1/verify", self.payload(edited=corrupt))
        self.assertEqual(code, 422, raw[:300])
        self.assertEqual(json.loads(raw)["error"], "WORD_LAYOUT_MOVED")
        self.record("unapproved_second_page_change", ok=True, error="WORD_LAYOUT_MOVED")

    def test_reject_external_relationships(self):
        with ZipFile(io.BytesIO(self.original)) as z:
            rel = z.read("word/_rels/document.xml.rels")
        self.assertIn(b"</Relationships>", rel)
        insert = (b'<Relationship Id="rIdExternalQA" '
                  b'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
                  b'Target="https://example.invalid/test.png" TargetMode="External"/>')
        malicious = package_rebuild(self.original, {
            "word/_rels/document.xml.rels": rel.replace(b"</Relationships>", insert + b"</Relationships>")
        })
        code, _, raw = self.request("/v1/render", self.payload(malicious))
        self.assertEqual(code, 422, raw[:300])
        self.assertEqual(json.loads(raw)["error"], "WORD_EXTERNAL_RESOURCE")
        self.record("external_resource_blocked", ok=True, error="WORD_EXTERNAL_RESOURCE")


if __name__ == "__main__":
    unittest.main(verbosity=2)
