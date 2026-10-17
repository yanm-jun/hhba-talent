"""HHBA real ATS read-only STAGING preview, never synthetic recruitment fixtures.

Fetch a narrow, explicit set of public Greenhouse, Ashby and Lever JSON boards.
All role/company/link facts must come from the ATS API response. No full JD
persistence or translation, no scraping, cookies, redirects, personal data,
license assumptions, automatic publication, or 'current apply' claims.

This is a local-only, ephemeral preview API for genuine-browser acceptance.
Real production admissions still require separate source/rights approval.
"""
from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import argparse
import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, HTTPRedirectHandler, build_opener

BOARDS = (
    ("GREENHOUSE", "greenhouse", "Greenhouse", "https://boards-api.greenhouse.io/v1/boards/greenhouse/jobs"),
    ("GREENHOUSE", "canonical", "Canonical", "https://boards-api.greenhouse.io/v1/boards/canonical/jobs"),
    ("ASHBY", "ashby", "Ashby", "https://api.ashbyhq.com/posting-api/job-board/ashby"),
    ("ASHBY", "airwallex", "Airwallex", "https://api.ashbyhq.com/posting-api/job-board/airwallex"),
    ("LEVER", "spotify", "Spotify", "https://api.lever.co/v0/postings/spotify?mode=json&skip=0&limit=100"),
    ("LEVER", "palantir", "Palantir Technologies", "https://api.lever.co/v0/postings/palantir?mode=json&skip=0&limit=100"),
)
OFFICIAL_DETAIL_HOSTS = {
    "GREENHOUSE": {"job-boards.greenhouse.io", "boards.greenhouse.io"},
    "ASHBY": {"jobs.ashbyhq.com"},
    "LEVER": {"jobs.lever.co"},
}
MAX_RESPONSE_BYTES=12*1024*1024
MAX_PER_BOARD=100
MAX_QUERY=120
ID_RE=re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def get_json(url: str):
    req=Request(url,method="GET",headers={
        "Accept":"application/json",
        "User-Agent":"HHBA-ATS-genuine-local-preview/0.1",
    })
    with build_opener(NoRedirect).open(req, timeout=22) as response:
        if response.status!=200 or "json" not in response.headers.get("Content-Type","").lower():
            raise ValueError("ATS source did not return JSON HTTP 200")
        body=response.read(MAX_RESPONSE_BYTES+1)
    if len(body)>MAX_RESPONSE_BYTES:
        raise ValueError("ATS source response exceeded bound")
    return json.loads(body)


def valid_detail(value, platform: str, slug: str) -> str | None:
    if not isinstance(value,str) or len(value)>2048 or any(ord(ch)<32 for ch in value):
        return None
    try:
        parsed=urlsplit(value)
    except ValueError:
        return None
    if (parsed.scheme!="https" or parsed.username or parsed.password or parsed.fragment
            or parsed.hostname not in OFFICIAL_DETAIL_HOSTS[platform]):
        return None
    if f"/{slug}/" not in parsed.path:
        return None
    return value


def as_text(v):
    return v.strip() if isinstance(v,str) and v.strip() else None


def to_job(platform: str, slug: str, company: str, source: dict,
           observed: str) -> dict | None:
    if not isinstance(source,dict):
        raise ValueError("ATS job response contains non-object")
    if platform=="ASHBY" and source.get("isListed") is False:
        return None
    if platform=="GREENHOUSE":
        native=source.get("id")
        title=as_text(source.get("title"))
        location=as_text((source.get("location") or {}).get("name"))
        detail=source.get("absolute_url")
        published=as_text(source.get("first_published"))
    elif platform=="ASHBY":
        native=source.get("id") or source.get("jobUrl")
        title=as_text(source.get("title"))
        location=as_text(source.get("location"))
        detail=source.get("jobUrl")
        published=as_text(source.get("publishedAt"))
    else:
        native=source.get("id")
        title=as_text(source.get("text"))
        location=as_text((source.get("categories") or {}).get("location"))
        detail=source.get("hostedUrl")
        published=None
    official=valid_detail(detail,platform,slug)
    if not title or not official or not isinstance(native,(str,int)) or isinstance(native,bool):
        raise ValueError("ATS posting lacks title, native ID or trusted original detail URL")
    jid="ATS-"+sha256(f"{platform}\0{slug}\0{native}".encode()).hexdigest()[:24]
    is_intern="intern" in title.casefold() or (
        platform=="ASHBY" and "intern" in (as_text(source.get("employmentType")) or "").casefold()
    )
    return {
        "job_id":jid, "record_kind":"HISTORICAL_MASTER",
        "job_title":title,
        "company_display_name":company,
        "source_id":f"ATS-{platform}-{slug.upper()}",
        "source_platform":platform,
        "work_city":location,
        "education_min":None,
        "primary_recruitment_type":"INTERNSHIP" if is_intern else "UNKNOWN",
        "last_verified_at":observed,
        "published_at":published,
        "salary_display":"未公开",
        "marketplace_status":"OFFICIAL_HISTORICAL_UNCONFIRMED",
        "job_status":"UNKNOWN",
        "official_detail_url":official,
        "official_list_url":None,
        "application_url":None,
        "application_link_status":"OFFICIAL_DETAIL_ONLY",
        "current_application_verified":False,
        "application_access_status":"NOT_OBSERVED",
        "application_verified_at":None,
        "application_expires_at":None,
    }


def read_genuine_public_ats() -> tuple[list[dict],list[dict]]:
    """Read minimal factual fields only, dropping JD/full native data in memory."""
    observations=[]
    source_jobs={}
    observed=datetime.now(timezone.utc).isoformat()
    for platform,slug,company,url in BOARDS:
        try:
            response=get_json(url)
            if platform=="LEVER":
                if not isinstance(response,list) or len(response)>100:
                    raise ValueError("Lever schema/page bound mismatch")
                native_jobs=response
            elif isinstance(response,dict) and isinstance(response.get("jobs"),list):
                native_jobs=response["jobs"]
                if platform=="GREENHOUSE" and isinstance((response.get("meta") or {}).get("total"),int):
                    if response["meta"]["total"]!=len(native_jobs):
                        raise ValueError("Greenhouse total mismatch")
            else:
                raise ValueError("ATS board JSON schema mismatch")
            # Do not claim the whole board was crawled; we intentionally cap to
            # 100 per board and Lever first page.  This is an interface pilot.
            minimal=[to_job(platform,slug,company,row,observed)
                     for row in native_jobs[:MAX_PER_BOARD]]
            minimal=[j for j in minimal if j is not None]
            if len({j["job_id"] for j in minimal})!=len(minimal):
                raise ValueError("duplicate native ATS job ID")
            source_jobs[(platform,slug)]=minimal
            observations.append({
                "platform":platform,"board":slug,"company":company,
                "response_rows":len(native_jobs),"staging_preview_rows":len(minimal),
                "complete_board_synced":False,
                "status":"READ_PUBLIC_JSON_AT_TEST_TIME",
            })
        except (ValueError,HTTPError,URLError,TimeoutError,UnicodeError,OSError) as exc:
            observations.append({
                "platform":platform,"board":slug,"company":company,
                "status":"SOURCE_UNAVAILABLE_NOT_SIMULATED",
                "error_type":type(exc).__name__,
            })
    for platform in ("GREENHOUSE","ASHBY","LEVER"):
        if not any(platform==p and rows for (p,_),rows in source_jobs.items()):
            raise RuntimeError(f"No genuine {platform} source available; refuse mock fallback")
    # Round robin to expose source diversity in the first screen without
    # creating any roles not actually observed from public official APIs.
    output=[]
    groups=list(source_jobs.values())
    for i in range(MAX_PER_BOARD):
        for rows in groups:
            if i<len(rows):
                output.append(rows[i])
    return output,observations


def filter_market(jobs: list[dict], params: dict[str,list[str]], *,
                  limit_default: int) -> dict:
    allowed={"recruitment_type","q","city","company","limit","offset"}
    if set(params)-allowed or any(len(x)!=1 for x in params.values()):
        raise ValueError("invalid or repeated filter")
    get=lambda name,default="": params.get(name,[default])[0]
    q,city,company=[get(k).strip().casefold() for k in ("q","city","company")]
    if any(len(s)>MAX_QUERY for s in (q,city,company)):
        raise ValueError("query too long")
    kind=get("recruitment_type")
    if kind not in {"","SOCIAL","CAMPUS","INTERNSHIP","UNKNOWN"}:
        raise ValueError("invalid recruitment type")
    limit,offset=int(get("limit",str(limit_default))),int(get("offset","0"))
    if not (1<=limit<=24 and 0<=offset<=1000000):
        raise ValueError("invalid result window")
    terms=q.split()
    matched=[j for j in jobs if
             (not kind or j["primary_recruitment_type"]==kind)
             and (not city or city in (j.get("work_city") or "").casefold())
             and (not company or company in j["company_display_name"].casefold())
             and (not terms or all(term in (
                 j["job_title"]+" "+j["company_display_name"]+" "+(j["work_city"] or "")
             ).casefold() for term in terms))]
    return {
        "data_mode":"official_source_historical_not_live",
        "all_current_application_statuses_unverified":True,
        "total":len(matched),
        "limit":limit,"offset":offset,"items":matched[offset:offset+limit],
        "disclaimer":"Actual public ATS JSON seen at test time, not live application verification. No JD publication permission asserted.",
    }


def serve(jobs: list[dict],host: str,port: int):
    lookup={j["job_id"]:j for j in jobs}
    class Handler(BaseHTTPRequestHandler):
        protocol_version="HTTP/1.1"
        def do_GET(self):
            parsed=urlsplit(self.path)
            if self.client_address[0] not in {"127.0.0.1","::1"}:
                return self.reply(403,{"error":"loopback only"})
            try:
                if parsed.path in {"/api/v1/marketplace","/api/v1/jobs"}:
                    result=filter_market(jobs,parse_qs(parsed.query,keep_blank_values=True),
                                         limit_default=8 if parsed.path.endswith("marketplace") else 12)
                elif parsed.path.startswith("/api/v1/jobs/"):
                    jid=parsed.path.rsplit("/",1)[-1]
                    if not ID_RE.fullmatch(jid) or jid not in lookup:
                        return self.reply(404,{"error":"not found"})
                    result=lookup[jid]
                elif parsed.path=="/api/v1/stats":
                    result={"total_jobs":len(jobs),"currently_verified_open":0,
                            "mode":"Genuine public ATS staging preview, no current apply verification"}
                else:
                    return self.reply(404,{"error":"not found"})
                return self.reply(200,result)
            except (ValueError,OverflowError):
                return self.reply(400,{"error":"invalid query"})
        def reply(self,status,data):
            raw=json.dumps(data,ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type","application/json; charset=utf-8")
            self.send_header("Cache-Control","no-store")
            self.send_header("Content-Length",str(len(raw)))
            self.send_header("X-Content-Type-Options","nosniff")
            self.end_headers()
            self.wfile.write(raw)
        def log_message(self,*_):
            pass
    with ThreadingHTTPServer((host,port),Handler) as server:
        print("Genuine ATS preview listening on loopback; real records:",len(jobs),flush=True)
        server.serve_forever()


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--host",default="127.0.0.1")
    p.add_argument("--port",type=int,default=8765)
    p.add_argument("--check-only",action="store_true")
    args=p.parse_args()
    if args.host!="127.0.0.1" or not 1<=args.port<=65535:
        p.error("loopback only")
    jobs,report=read_genuine_public_ats()
    print("REAL_ATS_OBSERVED_SUMMARY",json.dumps({
        "real_metadata_rows":len(jobs),"sources":report,
        "synthetic_job_count":0,"current_apply_verified":0,
        "full_jd_republished":False,
        "approved_for_public_production":False,
    },ensure_ascii=False),flush=True)
    if not args.check_only:
        serve(jobs,args.host,args.port)


if __name__=="__main__":
    main()
