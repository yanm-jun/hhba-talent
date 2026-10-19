"""Public Greenhouse, Lever and Ashby GET connectors for HHBA.
Isolated fact-only staging. Never sends applications or republishes full JD.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import re
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

PLATFORMS = frozenset({"greenhouse", "ashby", "lever"})
SLUG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$")
IDENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$")
MAX_BYTES = 20 * 1024 * 1024
LEVER_PAGE_SIZE = 100
LEVER_MAX_PAGES = 100


@dataclass(frozen=True)
class Board:
    company_id: str
    company_name: str
    platform: str
    slug: str
    source_id: str
    evidence_url: str
    lever_region: str = "global"

    @classmethod
    def from_dict(cls, data: dict) -> "Board":
        board = cls(**data)
        if not board.company_name or not IDENT.fullmatch(board.company_id) or not IDENT.fullmatch(board.source_id):
            raise ValueError("safe company ID, name and source ID are required")
        if board.platform not in PLATFORMS or not SLUG.fullmatch(board.slug):
            raise ValueError("unsupported platform or invalid board slug")
        if board.lever_region not in {"global", "eu"}:
            raise ValueError("invalid Lever region")
        if not _safe_https(board.evidence_url):
            raise ValueError("official board evidence must use HTTPS")
        return board


def _safe_https(value: object) -> str | None:
    if not isinstance(value, str) or any(ord(c) < 32 for c in value):
        return None
    try:
        p = urlsplit(value)
        if p.scheme != "https" or not p.hostname or p.username or p.password or p.fragment:
            return None
    except ValueError:
        return None
    return value


def _str(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _get(d: dict, *keys: str) -> Any:
    x: Any = d
    for key in keys:
        if not isinstance(x, dict):
            return None
        x = x.get(key)
    return x


def _endpoint(board: Board, *, skip: int = 0) -> str:
    slug = quote(board.slug, safe="")
    if board.platform == "greenhouse":
        return f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
    if board.platform == "ashby":
        return f"https://api.ashbyhq.com/posting-api/job-board/{slug}"
    host = "api.eu.lever.co" if board.lever_region == "eu" else "api.lever.co"
    return f"https://{host}/v0/postings/{slug}?mode=json&skip={skip}&limit={LEVER_PAGE_SIZE}"


class ATSFetchError(ValueError):
    """Classified external ATS request failure (status without body or token)."""
    def __init__(self, message: str, http_status: int | None = None):
        super().__init__(message)
        self.http_status = http_status


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _read_json(url: str) -> Any:
    """Known ATS host, HTTPS GET, no redirect, no cookies, bounded response."""
    req = Request(url, headers={"Accept": "application/json", "User-Agent": "HHBA-public-job-index/0.1"}, method="GET")
    try:
        with build_opener(_NoRedirect).open(req, timeout=25) as response:
            if response.status != 200:
                raise ValueError(f"ATS HTTP status {response.status}")
            if "json" not in (response.headers.get("Content-Type") or "").lower():
                raise ValueError("ATS response is not JSON")
            data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise ValueError("ATS response too large")
            return json.loads(data.decode("utf-8"))
    except HTTPError as exc:
        raise ATSFetchError(f"ATS HTTP status {exc.code}", http_status=exc.code) from exc
    except URLError as exc:
        raise ATSFetchError("ATS network or DNS failure") from exc


def _native_key(board: Board, row: dict) -> str | None:
    if board.platform == "ashby":
        # Ashby exposes a stable UUID, which survives changes to job URLs.
        native = row.get("id")
        if isinstance(native, str) and native.strip():
            return native.strip()
        return _safe_https(row.get("jobUrl"))
    value = row.get("id")
    return str(value).strip() if isinstance(value, (str, int)) and not isinstance(value, bool) and str(value).strip() else None


def _normalize(board: Board, row: dict, observed_at: str) -> dict | None:
    title = _str(row.get("title") if board.platform != "lever" else row.get("text"))
    native_id = _native_key(board, row)
    if not title or not native_id:
        return None
    if board.platform == "greenhouse":
        detail = _safe_https(row.get("absolute_url"))
        location = _str(_get(row, "location", "name"))
        published = _str(row.get("first_published"))
        updated = _str(row.get("updated_at"))
        description = _str(row.get("content"))
        kind = remote = country = workplace = apply_url = None
    elif board.platform == "ashby":
        if row.get("isListed") is False:
            return None
        detail = _safe_https(row.get("jobUrl"))
        location = _str(row.get("location"))
        published = _str(row.get("publishedAt"))
        updated = None
        description = _str(row.get("descriptionPlain"))
        kind = _str(row.get("employmentType"))
        remote = row.get("isRemote") if isinstance(row.get("isRemote"), bool) else None
        workplace = _str(row.get("workplaceType"))
        country = _str(_get(row, "address", "postalAddress", "addressCountry"))
        apply_url = _safe_https(row.get("applyUrl"))
    else:
        detail = _safe_https(row.get("hostedUrl"))
        location = _str(_get(row, "categories", "location"))
        published = updated = None
        description = _str(row.get("descriptionPlain")) or _str(row.get("descriptionBodyPlain"))
        kind = _str(_get(row, "categories", "commitment"))
        workplace = _str(row.get("workplaceType"))
        remote = True if workplace == "remote" else False if workplace in {"on-site", "hybrid"} else None
        country = _str(row.get("country"))
        apply_url = _safe_https(row.get("applyUrl"))
    if not detail:
        return None
    digest = hashlib.sha256(f"{board.platform}\0{board.slug}\0{native_id}".encode()).hexdigest()[:24]
    recruitment_type = "INTERNSHIP" if "intern" in (kind or "").lower() else "UNKNOWN"
    from .global_ats_jd import inspect_jd
    jd = inspect_jd(board.platform, row)
    previous_jd = inspect_jd(board.platform, row, legacy=True)
    return {
        **jd.metadata(),
        "jd_parser_version": "explicit-headings-v2",
        "jd_requirements_v1_detected": bool(previous_jd.requirements),
        "jd_responsibilities_v1_detected": bool(previous_jd.responsibilities),
        "job_id": f"ATS-{digest}", "company_id": board.company_id,
        "source_id": board.source_id, "original_job_id": native_id,
        "company_display_name": board.company_name, "source_platform": board.platform.upper(),
        "job_title": title, "work_city": location, "work_country": country,
        "work_mode": workplace, "is_remote": remote, "employment_type": kind,
        "primary_recruitment_type": recruitment_type,
        "job_source_url": detail, "application_url_candidate": apply_url,
        "published_at": published, "updated_at": updated,
        "first_seen_at": observed_at, "last_verified_at": observed_at,
        "job_status": "UNKNOWN", "source_observation_type": "PUBLIC_LIST_JSON",
        "source_verification_status": "PENDING_SOURCE_REVIEW",
        "application_access_status": "NOT_OBSERVED",
        "current_application_verified": False,
        "rights_status": "RIGHTS_REVIEW_REQUIRED",
        "translation_status": "PENDING",
    }


def collect_board(board: Board, *, fetch: Callable[[str], Any] = _read_json,
                  observed_at: str | None = None) -> tuple[list[dict], dict]:
    """Stage a board's listed jobs; no live status promise or production write."""
    observed_at = observed_at or datetime.now(timezone.utc).isoformat()
    rows: list[dict] = []
    total_read = 0
    if board.platform == "lever":
        for page in range(LEVER_MAX_PAGES):
            response = fetch(_endpoint(board, skip=page * LEVER_PAGE_SIZE))
            if not isinstance(response, list):
                raise ValueError("Lever schema changed (expected list)")
            if len(response) > LEVER_PAGE_SIZE:
                raise ValueError("Lever page over limit")
            rows.extend(response)
            total_read += len(response)
            if len(response) < LEVER_PAGE_SIZE:
                break
        else:
            raise ValueError("Lever max pages reached: incomplete, no stage admission")
    else:
        response = fetch(_endpoint(board))
        if not isinstance(response, dict) or not isinstance(response.get("jobs"), list):
            raise ValueError("ATS schema changed (expected jobs list)")
        rows = response["jobs"]
        total_read = len(rows)
        meta_total = _get(response, "meta", "total")
        if board.platform == "greenhouse" and isinstance(meta_total, int) and meta_total != len(rows):
            raise ValueError("Greenhouse total disagrees with returned list")
    jobs: list[dict] = []
    seen: set[str] = set()
    skipped_unlisted = 0
    for row in rows:
        if board.platform == "ashby" and isinstance(row, dict) and row.get("isListed") is False:
            skipped_unlisted += 1
            continue
        if not isinstance(row, dict):
            raise ValueError("malformed ATS job: non-object")
        job = _normalize(board, row, observed_at)
        if job is None:
            raise ValueError("malformed ATS job: required title/id/HTTPS link missing")
        if job["job_id"] in seen:
            raise ValueError("duplicate posting ID in board snapshot")
        seen.add(job["job_id"])
        jobs.append(job)
    report = {
        "platform": board.platform, "company_id": board.company_id,
        "source_id": board.source_id, "snapshot_complete": True,
        "raw_rows": total_read, "indexed_rows": len(jobs),
        "unlisted_excluded": skipped_unlisted, "observed_at": observed_at,
        "jd_available_count": sum(bool(j["jd_available"]) for j in jobs),
        "jd_requirements_heading_count": sum(bool(j["jd_requirements_detected"]) for j in jobs),
        "jd_responsibilities_heading_count": sum(bool(j["jd_responsibilities_detected"]) for j in jobs),
        "jd_requirements_v1_count": sum(bool(j["jd_requirements_v1_detected"]) for j in jobs),
        "jd_responsibilities_v1_count": sum(bool(j["jd_responsibilities_v1_detected"]) for j in jobs),
        "jd_parser_version": "explicit-headings-v2",
        "publication_approved": False, "JD_republication_approved": False,
        "recruitment_availability_verified": False,
    }
    return jobs, report
