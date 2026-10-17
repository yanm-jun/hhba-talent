"""Local-only HHBA ATS preview over snapshots from the EXISTING engine collector.

This module does not fetch ATS data. First run the vendored, pinned upstream
scripts/stage_global_ats.py. The server then verifies its SHA-256 manifests,
exposes only factual metadata, and marks all unreviewed ATS records as internal
staging. It may optionally merge the public records from a running loopback
HHBA recruitment-engine API. Never deploy this preview server to the internet.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from hashlib import sha256
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, urlsplit, unquote
from urllib.request import Request, urlopen

ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
EXCLUDED_FIELDS = frozenset({
    "job_description_raw", "requirements_raw", "responsibilities_raw",
    "descriptionPlain", "descriptionHtml", "content", "jd_text", "jd_translation",
})
DETAIL_HOSTS = {
    "greenhouse": {"job-boards.greenhouse.io", "boards.greenhouse.io", "boards.eu.greenhouse.io"},
    "ashby": {"jobs.ashbyhq.com"},
    "lever": {"jobs.lever.co"},
}
ALLOWED_TYPES = {"", "CAMPUS", "SOCIAL", "INTERNSHIP", "SPECIAL", "UNKNOWN"}


def _text(value):
    return value.strip() if isinstance(value, str) and value.strip() else None


def _safe_detail(value, platform, slug):
    if not isinstance(value, str) or len(value) > 2048 or any(ord(c) < 32 for c in value):
        return None
    try:
        parsed = urlsplit(value)
    except ValueError:
        return None
    if (parsed.scheme != "https" or parsed.username or parsed.password
            or parsed.fragment or parsed.hostname not in DETAIL_HOSTS[platform]):
        return None
    if slug not in [part for part in parsed.path.split("/") if part]:
        return None
    return value


def load_staged_ats(stage_dir: Path):
    """Read exact SHA-bound snapshots, reject raw JD and never auto-approve."""
    if not stage_dir.is_dir():
        raise ValueError("ATS staging directory is missing")
    rows, sources, seen_jobs = [], [], set()
    manifests = sorted(stage_dir.glob("*.manifest.json"))
    if not manifests:
        raise ValueError("no ATS manifests; real staging is required")
    for manifest_path in manifests:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        sid = manifest.get("source_id")
        if not isinstance(sid, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,99}", sid):
            raise ValueError("invalid source ID in manifest")
        payload_path = stage_dir / (sid + ".jsonl")
        payload = payload_path.read_bytes()
        if len(payload) > 40 * 1024 * 1024:
            raise ValueError("staged ATS source exceeds size bound")
        digest = sha256(payload).hexdigest()
        if (manifest_path.name != sid + ".manifest.json"
                or manifest.get("sha256") != digest
                or manifest.get("snapshot_complete") is not True
                or manifest.get("publication_approved") is not False
                or manifest.get("JD_republication_approved") is not False
                or not isinstance(manifest.get("observed_at"), str)):
            raise ValueError("ATS snapshot hash/completeness/publication gate mismatch")
        platform = manifest.get("platform")
        if platform not in DETAIL_HOSTS:
            raise ValueError("unsupported ATS platform")
        evidence = manifest.get("source_evidence_url")
        if not isinstance(evidence, str):
            raise ValueError("missing board identity evidence URL")
        ep = urlsplit(evidence)
        if ep.scheme != "https" or ep.hostname not in DETAIL_HOSTS[platform] or ep.username or ep.password:
            raise ValueError("board evidence is not on the expected ATS host")
        segments = [part for part in ep.path.split("/") if part]
        if not segments:
            raise ValueError("board slug missing from evidence URL")
        slug = segments[0]
        lines = payload.decode("utf-8").splitlines()
        if not lines or len(lines) != manifest.get("indexed_rows"):
            raise ValueError("staged row count mismatch")
        names = set()
        for line in lines:
            item = json.loads(line)
            if not isinstance(item, dict) or EXCLUDED_FIELDS.intersection(item):
                raise ValueError("unsafe/non-metadata field in ATS stage")
            jid = item.get("job_id")
            if (not isinstance(jid, str) or not re.fullmatch(r"ATS-[0-9a-f]{24}", jid)
                    or jid in seen_jobs):
                raise ValueError("duplicate or invalid ATS job ID")
            if (item.get("source_id") != sid
                    or item.get("source_platform", "").lower() != platform
                    or item.get("company_id") != manifest.get("company_id")
                    or not _text(item.get("company_display_name"))
                    or not _text(item.get("job_title"))
                    or item.get("job_status") != "UNKNOWN"
                    or item.get("current_application_verified") is not False
                    or item.get("rights_status") != "RIGHTS_REVIEW_REQUIRED"):
                raise ValueError("staged ATS identity/status boundary mismatch")
            detail = _safe_detail(item.get("job_source_url"), platform, slug)
            if not detail:
                raise ValueError("job URL does not match the official ATS board")
            seen_jobs.add(jid)
            names.add(item["company_display_name"])
            rows.append({
                "job_id": jid, "company_id": item["company_id"], "source_id": sid,
                "company_display_name": item["company_display_name"], "job_title": item["job_title"],
                "work_city": _text(item.get("work_city")), "work_country": _text(item.get("work_country")),
                "work_mode": _text(item.get("work_mode")),
                "is_remote": item.get("is_remote") if isinstance(item.get("is_remote"), bool) else None,
                "employment_type": _text(item.get("employment_type")),
                "primary_recruitment_type": item.get("primary_recruitment_type")
                    if item.get("primary_recruitment_type") in ALLOWED_TYPES - {""} else "UNKNOWN",
                "education_min": None, "salary_display": "未公开", "job_status": "UNKNOWN",
                "public_visibility_status": "STAGING_ONLY", "application_access_status": "NOT_OBSERVED",
                "first_seen_at": _text(item.get("first_seen_at")),
                "last_verified_at": _text(item.get("last_verified_at")) or manifest["observed_at"],
                "status_checked_at": _text(item.get("last_verified_at")) or manifest["observed_at"],
                "published_at": _text(item.get("published_at")), "source_platform": platform.upper(),
                "official_detail_url": detail, "official_list_url": None, "application_url": None,
                "application_link_status": "OFFICIAL_DETAIL_ONLY", "current_application_verified": False,
                "application_verified_at": None, "application_expires_at": None,
                "record_kind": "ATS_STAGING_PREVIEW",
                "marketplace_status": "STAGING_SOURCE_REVIEW_REQUIRED",
                "source_review_status": "NOT_APPROVED_FOR_PUBLICATION",
            })
        sources.append({
            "source_id": sid, "platform": platform.upper(),
            "company": sorted(names)[0] if names else sid, "board_slug": slug,
            "rows": len(lines), "observed_at": manifest["observed_at"],
            "source_identity_and_rights_reviewed": False,
        })
    if not {"GREENHOUSE", "ASHBY", "LEVER"} <= {s["platform"] for s in sources}:
        raise ValueError("need real rows from Greenhouse, Ashby and Lever; no mock fallback")
    return rows, sources


def _read_loopback_json(url: str):
    parsed = urlsplit(url)
    if (parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
            or parsed.username or parsed.password or parsed.query or parsed.fragment):
        raise ValueError("domestic API must be a loopback HTTP origin")
    with urlopen(Request(url, headers={"Accept": "application/json"}), timeout=5) as response:
        if response.status != 200 or "json" not in response.headers.get("Content-Type", "").lower():
            raise ValueError("domestic API did not return JSON")
        data = json.load(response)
    return data


def load_domestic_api(api_origin: str | None):
    """Optionally consume only public-eligible rows from the running real engine."""
    if not api_origin:
        return []
    origin = api_origin.rstrip("/")
    first = _read_loopback_json(origin + "/api/v1/marketplace?limit=24&offset=0")
    total = first.get("total")
    if not isinstance(total, int) or total < 0 or not isinstance(first.get("items"), list):
        raise ValueError("invalid domestic marketplace response")
    rows = list(first["items"])
    for offset in range(24, total, 24):
        page = _read_loopback_json(origin + f"/api/v1/marketplace?limit=24&offset={offset}")
        if not isinstance(page.get("items"), list):
            raise ValueError("invalid domestic marketplace page")
        rows.extend(page["items"])
    if len(rows) != total:
        raise ValueError("domestic market pagination mismatch")
    return rows


def _matches(row, q, city, company, kind):
    if kind and row.get("primary_recruitment_type") != kind:
        return False
    if city and city not in str(row.get("work_city") or "").casefold():
        return False
    if company and company not in str(row.get("company_display_name") or "").casefold():
        return False
    searchable = " ".join(str(row.get(k) or "") for k in (
        "job_title", "company_display_name", "work_city", "work_country",
    )).casefold()
    return all(term in searchable for term in q.split())


def _project(row):
    keys = (
        "job_id", "company_id", "source_id", "company_display_name", "job_title",
        "work_city", "work_country", "work_mode", "is_remote", "employment_type",
        "primary_recruitment_type", "education_min", "salary_display", "job_status",
        "public_visibility_status", "application_access_status", "first_seen_at",
        "last_verified_at", "status_checked_at", "published_at", "source_platform",
        "official_detail_url", "official_list_url", "application_url",
        "application_link_status", "current_application_verified",
        "application_verified_at", "application_expires_at", "record_kind",
        "marketplace_status", "source_review_status",
    )
    return {key: row.get(key) for key in keys}


def create_handler(rows, stats):
    by_id = {row["job_id"]: row for row in rows}
    class Handler(BaseHTTPRequestHandler):
        def _json(self, status, payload):
            raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
        def do_GET(self):
            try:
                if not ipaddress.ip_address(self.client_address[0]).is_loopback:
                    return self._json(403, {"error": "loopback only"})
            except ValueError:
                return self._json(403, {"error": "loopback only"})
            parsed = urlsplit(self.path)
            try:
                if parsed.path == "/api/v1/stats":
                    return self._json(200, {
                        **stats, "mode": "INTERNAL_STAGING_ONLY",
                        "currently_verified_open": 0,
                        "disclaimer": "Local preview only; ATS source identity and metadata rights review incomplete.",
                    })
                if parsed.path.startswith("/api/v1/jobs/"):
                    jid = unquote(parsed.path.rsplit("/", 1)[-1])
                    if not ID_RE.fullmatch(jid) or jid not in by_id:
                        return self._json(404, {"error": "not found"})
                    return self._json(200, _project(by_id[jid]))
                if parsed.path not in {"/api/v1/marketplace", "/api/v1/jobs"}:
                    return self._json(404, {"error": "not found"})
                params = parse_qs(parsed.query, keep_blank_values=True, max_num_fields=8)
                allowed = {"q", "city", "company", "recruitment_type", "limit", "offset"}
                if set(params) - allowed or any(len(v) != 1 for v in params.values()):
                    raise ValueError("unknown or duplicate filter")
                get = lambda key, default="": params.get(key, [default])[0]
                q, city, company = (get(key).strip().casefold() for key in ("q", "city", "company"))
                if any(len(x) > 120 for x in (q, city, company)):
                    raise ValueError("filter too long")
                kind = get("recruitment_type")
                if kind not in ALLOWED_TYPES:
                    raise ValueError("invalid recruitment type")
                default_limit = 8 if parsed.path.endswith("marketplace") else 12
                limit, offset = int(get("limit", str(default_limit))), int(get("offset", "0"))
                max_limit = 24 if parsed.path.endswith("marketplace") else 100
                if not 1 <= limit <= max_limit or not 0 <= offset <= 1_000_000:
                    raise ValueError("invalid result window")
                matched = [row for row in rows if _matches(row, q, city, company, kind)]
                items = [_project(row) for row in matched[offset:offset + limit]]
                result = {"total": len(matched), "limit": limit, "offset": offset,
                          "items": items,
                          "disclaimer": "Internal staging only. Unreviewed ATS metadata must not be publicly published."}
                if parsed.path == "/api/v1/marketplace":
                    result.update({
                        "data_mode": "official_source_staging_only",
                        "all_current_application_statuses_unverified": not any(
                            row.get("current_application_verified") is True for row in matched),
                        "staging_notice": "内部验收预览：ATS 来源归属与元数据发布权限尚未人工审核；所有投递状态均未核验。禁止作为公网正式数据发布。",
                    })
                return self._json(200, result)
            except (ValueError, OverflowError):
                return self._json(400, {"error": "invalid query"})
        def do_POST(self):
            return self._json(405, {"error": "read-only service"})
        def log_message(self, *_):
            pass
    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage-dir", type=Path, required=True)
    parser.add_argument("--domestic-api", help="optional existing engine loopback origin, e.g. http://127.0.0.1:8766")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    try:
        bind_ip = ipaddress.ip_address(args.host)
    except ValueError:
        parser.error("host must be an explicit loopback IP")
    if not bind_ip.is_loopback or not 1 <= args.port <= 65535:
        parser.error("preview server can only bind to a loopback IP and valid port")
    ats, sources = load_staged_ats(args.stage_dir)
    domestic = load_domestic_api(args.domestic_api)
    combined = []
    seen = set()
    for row in domestic + ats:
        jid = row.get("job_id")
        if not isinstance(jid, str) or jid in seen:
            continue
        seen.add(jid)
        combined.append(row)
    combined.sort(key=lambda row: (str(row.get("last_verified_at") or ""), str(row.get("job_id") or "")), reverse=True)
    stats = {
        "domestic_public_rows": len([row for row in combined if row.get("record_kind") != "ATS_STAGING_PREVIEW"]),
        "ats_staging_rows": len([row for row in combined if row.get("record_kind") == "ATS_STAGING_PREVIEW"]),
        "total_rows": len(combined), "sources": sources,
    }
    print("HHBA_INTERNAL_STAGING_PREVIEW", json.dumps(stats, ensure_ascii=False), flush=True)
    with ThreadingHTTPServer((args.host, args.port), create_handler(combined, stats)) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()
