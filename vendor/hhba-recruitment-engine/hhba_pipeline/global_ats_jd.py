"""Transient, rights-aware JD parser and translation handoff for HHBA.

This module accepts raw public ATS responses in process memory. It never
writes source JD or Chinese translations into public search or Git by itself.
Full translation/publication require a job-specific, independently checked
rights grant and subsequent editorial quality approval.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from hashlib import sha256
from html import unescape
from html.parser import HTMLParser
import re
from typing import Any, Callable, Mapping

from .global_ats_jd_sections import classify_explicit_line

REQUIREMENTS = re.compile(
    r"^(?:required|requirements|qualifications?|minimum qualifications?|preferred qualifications?|"
    r"what (?:we're|we are) looking for|who you are|your (?:skills|experience|background)|"
    r"任职要求|岗位要求|资格条件|申请条件)\s*:?\s*$", re.I
)
RESPONSIBILITIES = re.compile(
    r"^(?:responsibilities|what you(?:'ll| will) do|your responsibilities|"
    r"your role|job duties|what you'll be doing|岗位职责|工作职责|工作内容)\s*:?\s*$", re.I
)
OTHER_SECTION = re.compile(
    r"^(?:benefits?|perks?|compensation|salary|about us|about the company|what we offer|"
    r"equal opportunity|how to apply|福利待遇|公司介绍|薪资福利|申请方式)\s*:?\s*$", re.I
)
SPACE = re.compile(r"[ \t]+")

class _Text(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in {"li", "p", "div", "br", "h1", "h2", "h3", "h4", "section", "tr"}:
            self.parts.append("\n")
    def handle_endtag(self, tag: str) -> None:
        if tag in {"li", "p", "div", "h1", "h2", "h3", "h4", "section", "tr"}:
            self.parts.append("\n")
    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def _clean(raw: Any, *, html: bool = False) -> str:
    if not isinstance(raw, str):
        return ""
    # An ATS can supply HTML entities even in "plain" fields.
    data = unescape(raw)
    if html:
        parser = _Text()
        parser.feed(data)
        data = "".join(parser.parts)
    data = data.replace("\r\n", "\n").replace("\r", "\n")
    lines = [SPACE.sub(" ", line).strip() for line in data.split("\n")]
    return "\n".join(line for line in lines if line).strip()


def _lever_text(row: Mapping[str, Any]) -> str:
    parts = [_clean(row.get("descriptionPlain") or row.get("descriptionBodyPlain"))]
    if not parts[0]:
        parts = [_clean(row.get("description"), html=True)]
    lists = row.get("lists") or []
    if not isinstance(lists, list):
        lists = []
    for item in lists:
        if not isinstance(item, dict):
            continue
        heading = _clean(item.get("text"))
        # Lever "content" is an HTML list body, not plain text.
        content = _clean(item.get("content"), html=True)
        if heading and content:
            parts.append(heading + "\n" + content)
    ending = _clean(row.get("additionalPlain"))
    if not ending:
        ending = _clean(row.get("additional"), html=True)
    if ending:
        parts.append(ending)
    return "\n".join(p for p in parts if p)


@dataclass(frozen=True)
class JDDocument:
    source_sha256: str
    full_text: str
    responsibilities: str
    requirements: str
    unclassified: str
    section_evidence: str
    character_count: int

    def metadata(self) -> dict:
        return {
            "jd_available": bool(self.full_text),
            "jd_sha256": self.source_sha256 if self.full_text else None,
            "jd_character_count": self.character_count,
            "jd_requirements_detected": bool(self.requirements),
            "jd_responsibilities_detected": bool(self.responsibilities),
            "jd_section_evidence": self.section_evidence,
        }


def inspect_jd(platform: str, source_row: Mapping[str, Any], *, legacy: bool = False) -> JDDocument:
    """Preserve every extracted line and split ONLY using explicit headings."""
    if platform == "greenhouse":
        body = _clean(source_row.get("content"), html=True)
    elif platform == "ashby":
        body = _clean(source_row.get("descriptionPlain"))
        if not body:
            body = _clean(source_row.get("descriptionHtml"), html=True)
    elif platform == "lever":
        body = _lever_text(source_row)
    else:
        raise ValueError("unsupported ATS JD source")
    sections: dict[str, list[str]] = {"responsibilities": [], "requirements": [], "unclassified": []}
    active = "unclassified"
    discovered = False
    for line in body.splitlines():
        category, remainder = classify_explicit_line(line, legacy=legacy)
        if category is not None:
            active = category
            if category != "unclassified":
                discovered = True
            if remainder:
                sections[active].append(remainder)
        else:
            sections[active].append(line)
    # If source headings are ambiguous, we DO NOT claim responsibilities or
    # requirements were inferred from the full body.
    digest = sha256(body.encode("utf-8")).hexdigest() if body else ""
    return JDDocument(
        source_sha256=digest,
        full_text=body,
        responsibilities="\n".join(sections["responsibilities"]),
        requirements="\n".join(sections["requirements"]),
        unclassified="\n".join(sections["unclassified"]),
        section_evidence="EXPLICIT_HEADINGS" if discovered else "UNCLASSIFIED",
        character_count=len(body),
    )


def prepare_full_translation(job_id: str, jd: JDDocument,
                             grant: Mapping[str, Any],
                             translate: Callable[[str], str]) -> dict:
    """Translate only under independently confirmed FULL JD rights.

    Outputs a PRIVATE, non-publishable editorial draft; a separate human QA
    signoff plus public operation compliance review must precede publication.
    No provider implementation is bundled and this function never sends data
    to any remote service by itself.
    """
    if (not jd.full_text or grant.get("job_id") != job_id or
            grant.get("source_sha256") != jd.source_sha256 or
            grant.get("rights_scope") != "FULL_JD_TRANSLATION_AND_REPUBLICATION" or
            grant.get("review_status") != "INDEPENDENTLY_CONFIRMED" or
            not grant.get("rights_evidence_url") or
            not str(grant.get("rights_evidence_url")).startswith("https://") or
            not grant.get("reviewer") or
            grant.get("valid_until", "") < date.today().isoformat()):
        raise PermissionError("verified job-specific full JD rights grant required")
    translated = translate(jd.full_text)
    if not isinstance(translated, str) or len(translated.strip()) < 10:
        raise ValueError("empty or implausibly short full JD translation")
    # Translation must never be assumed complete or public until QA signs off.
    return {
        "job_id": job_id, "source_sha256": jd.source_sha256,
        "source_length": len(jd.full_text), "translation_zh": translated.strip(),
        "translation_sha256": sha256(translated.strip().encode()).hexdigest(),
        "translation_status": "PENDING_HUMAN_QA",
        "public_visibility_status": "BLOCKED_UNTIL_EDITORIAL_AND_COMPLIANCE_APPROVAL",
        "sections_in_source": jd.metadata(),
    }
