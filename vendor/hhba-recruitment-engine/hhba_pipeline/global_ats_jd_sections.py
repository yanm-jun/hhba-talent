"""Conservative, explainable explicit ATS job-description section headings.

Only literal source-supplied headings may label responsibilities or requirements.
Do NOT infer sections from ordinary role prose or employ an LLM. This classifier
never persists or sends the source JD text.
"""
from __future__ import annotations

import re

REQUIREMENTS = re.compile(
    r"^(?:required|requirements|qualifications?|minimum qualifications?|preferred qualifications?|"
    r"what (?:we're|we are) looking for|who you are|your (?:skills|experience|background)|"
    r"任职要求|岗位要求|资格条件|申请条件)$", re.I
)
RESPONSIBILITIES = re.compile(
    r"^(?:responsibilities|what you(?:'ll| will) do|your responsibilities|"
    r"your role|job duties|what you'll be doing|岗位职责|工作职责|工作内容)$", re.I
)
OTHER = re.compile(
    r"^(?:benefits?|perks?|compensation|salary|about us|about the company|what we offer|"
    r"equal opportunity|how to apply|福利待遇|公司介绍|薪资福利|申请方式)$", re.I
)
REQUIREMENTS_V2 = re.compile(
    r"^(?:"
    r"(?:minimum|basic|required|preferred|essential|desired|ideal|key)\s+"
    r"(?:qualifications?|requirements?|skills?|experience|competencies)|"
    r"(?:job\s+)?requirements?(?:\s+(?:and|&)\s+qualifications?)?|"
    r"(?:professional\s+)?qualifications?(?:\s+(?:and|&)\s+(?:experience|skills?))?|"
    r"(?:skills?|experience)\s+(?:and|&)\s+(?:qualifications?|skills?)|"
    r"what\s+(?:you(?:'ll| will)?\s+(?:bring|need|have)|we(?:'re| are)\s+looking\s+for)|"
    r"(?:who|whom)\s+we(?:'re| are)\s+looking\s+for|"
    r"(?:who|what)\s+you\s+are|"
    r"(?:you(?:'ll| will)?\s+need)|"
    r"(?:must|nice)\s+to\s+have(?:s)?|"
    r"(?:the\s+)?ideal\s+candidate|"
    r"(?:your\s+)?(?:skills?|experience|background)|"
    r"(?:任职|岗位|资格|申请|招聘)(?:要求|条件|资格)|"
    r"(?:必备|优先)(?:资格|条件|技能)"
    r")$", re.I
)
RESPONSIBILITIES_V2 = re.compile(
    r"^(?:"
    r"(?:key|main|primary|core|major|job|day.to.day|your)\s+"
    r"(?:responsibilities|duties|tasks)|"
    r"(?:roles?\s+(?:and|&)\s+)?responsibilities|"
    r"(?:duties\s+(?:and|&)\s+responsibilities)|"
    r"what\s+you(?:'ll| will)\s+(?:do|be\s+doing|work\s+on|own)|"
    r"(?:what\s+you\s+do)|"
    r"(?:how|where)\s+you(?:'ll| will)\s+(?:contribute|make\s+an?\s+impact)|"
    r"(?:your\s+)?(?:impact|role\s+(?:and|&)\s+responsibilities)|"
    r"(?:岗位|工作|主要)(?:职责|内容|任务)|"
    r"(?:你的|您将负责的)(?:工作|职责)"
    r")$", re.I
)
OTHER_V2 = re.compile(
    r"^(?:"
    r"(?:compensation\s+(?:and|&)\s+benefits|salary\s+(?:and|&)\s+benefits)|"
    r"(?:about|meet)\s+(?:us|the\s+company|our\s+(?:company|team))|"
    r"(?:what|why)\s+we\s+offer|"
    r"(?:our\s+)?(?:benefits?|perks?|compensation|salary|culture|values)|"
    r"(?:equal\s+opportunity(?:\s+employer)?|"
    r"equal\s+employment\s+opportunity)|"
    r"(?:how\s+to\s+apply|application\s+process|apply\s+now)|"
    r"(?:福利待遇|公司介绍|薪资福利|申请方式|关于我们|平等就业)"
    r")$", re.I
)
MARKDOWN_HEADER = re.compile(r"^(?:#{1,6}\s+|\d{1,2}[.)]\s+|[IVX]{1,5}[.)]\s+)", re.I)
SAME_LINE_LABEL = re.compile(r"^\s*([^:：]{3,85})[:：]\s+(.+)$")


def _heading(line: str, *, legacy: bool = False) -> str | None:
    if legacy:
        label = line.strip().rstrip(":").strip()
    else:
        label = MARKDOWN_HEADER.sub("", line.strip())
        label = label.strip().strip("*_~").strip().rstrip(":：–—").strip()
        if len(label) > 100 or len(label.split()) > 13 or not label:
            return None
    if RESPONSIBILITIES.fullmatch(label) or (not legacy and RESPONSIBILITIES_V2.fullmatch(label)):
        return "responsibilities"
    if REQUIREMENTS.fullmatch(label) or (not legacy and REQUIREMENTS_V2.fullmatch(label)):
        return "requirements"
    if OTHER.fullmatch(label) or (not legacy and OTHER_V2.fullmatch(label)):
        return "unclassified"
    return None


def classify_explicit_line(line: str, *, legacy: bool = False) -> tuple[str | None, str | None]:
    """Return (classification, first-content-text), never inferred content.

    Legacy path emulates original v1 standalone labels; v2 additionally handles
    markdown headings, conservative exact labels and explicitly labelled inline
    text such as "Required Skills: Python".
    """
    category = _heading(line, legacy=legacy)
    if category is not None or legacy:
        return category, None
    pair = SAME_LINE_LABEL.fullmatch(line)
    if pair:
        category = _heading(pair.group(1))
        if category is not None:
            return category, pair.group(2)
    return None, None
