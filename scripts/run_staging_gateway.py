"""HHBA V0.4 local/staging same-origin gateway (stdlib, fail closed).

Routes:
  / and React client paths       -> compiled apps/web/dist only
  /api/v1/*                      -> existing talent API (cookie + CSRF preserved)
  /recruitment/api/v1/marketplace, /jobs, /jobs/<ID>, /stats
                                  -> independent recruitment data API (GET/HEAD only;
                                     NO auth/cookie/referrer forwarding)
Never expose the recruitment engine's /ops, /api/v1/review, or admin routes.
Bind to loopback only. This is not a production TLS or identity gateway.
"""
from __future__ import annotations

import argparse
import http.client
import json
import mimetypes
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

_ROOT = Path(__file__).resolve().parents[1]
_DIST = _ROOT / "apps" / "web" / "dist"
_PUBLIC_ID = re.compile(r"[A-Za-z0-9_-]{1,64}\Z")
_MARKET_ALLOWED = re.compile(r"/api/v1/(?:marketplace|jobs|jobs/[A-Za-z0-9_-]{1,64}|stats)\Z")
_INTERNAL_JD_ALLOWED = re.compile(r"/api/v1/internal/ats-jd/[A-Za-z0-9_-]{1,64}\Z")
_BLOCKED_HEADERS = {"connection", "transfer-encoding", "keep-alive", "proxy-authenticate",
                    "proxy-authorization", "te", "trailer", "upgrade", "content-length",
                    "host", "set-cookie", "access-control-allow-origin",
                    "access-control-allow-credentials"}
_SAFE_RESPONSES = {"content-type", "content-disposition", "etag", "last-modified"}
_MAX_BODY = 20 * 1024 * 1024
_CSP = ("default-src 'self'; script-src 'self'; style-src 'self'; "
        "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; "
        "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")


def validate_target(spec: str) -> tuple[str, int]:
    parsed = urlsplit(spec)
    if (parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost"}
            or parsed.username or parsed.password or parsed.path not in {"", "/"}
            or parsed.query or parsed.fragment or not parsed.port
            or not 1 <= parsed.port <= 65535):
        raise ValueError("upstream must be a loopback HTTP origin with an explicit port")
    return "127.0.0.1", parsed.port


def make_handler(dist: Path, talent: tuple[str, int], recruitment: tuple[str, int], *,
                 allow_internal_jd: bool = False):
    dist = dist.resolve()
    if not dist.is_dir() or not (dist / "index.html").is_file():
        raise ValueError("build apps/web first (npm ci && npm run build)")

    class Handler(BaseHTTPRequestHandler):
        server_version = "HHBAStaging/0.4"
        protocol_version = "HTTP/1.1"

        def _send(self, status: int, data: bytes, kind: str = "application/json",
                  extra: dict[str, str] | None = None, cookies: list[str] | None = None):
            self.send_response(status)
            self.send_header("Content-Type", kind)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Content-Security-Policy", _CSP)
            for key, value in (extra or {}).items():
                if key.lower() in _SAFE_RESPONSES and "\r" not in value and "\n" not in value:
                    self.send_header(key, value)
            # Session cookies belong ONLY to the original talent auth API.
            for cookie in cookies or []:
                if len(cookie) <= 4096 and "\r" not in cookie and "\n" not in cookie:
                    self.send_header("Set-Cookie", cookie)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(data)

        def _error(self, status: int, code: str):
            self._send(status, json.dumps({"error": code}).encode())

        def _host_ok(self) -> bool:
            host = (self.headers.get("Host") or "").lower()
            return bool(re.fullmatch(r"(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?", host))

        def _route(self):
            if not self._host_ok():
                self._error(403, "invalid_host")
                return
            parsed = urlsplit(self.path)
            path = parsed.path
            if path.startswith("/recruitment/") or path == "/recruitment":
                stripped = path.removeprefix("/recruitment")
                is_internal_jd = bool(_INTERNAL_JD_ALLOWED.fullmatch(stripped))
                if is_internal_jd:
                    # Explicit localhost operator flag and non-simple header;
                    # never let the browser use staging for a production JD feed.
                    if (not allow_internal_jd or self.command != "GET"
                            or parsed.query or self.headers.get("X-HHBA-Internal-Preview") != "1"):
                        self._error(404, "internal_jd_disabled")
                        return
                elif self.command not in {"GET", "HEAD"} or not _MARKET_ALLOWED.fullmatch(stripped):
                    self._error(404 if self.command in {"GET", "HEAD"} else 405,
                                "recruitment_route_forbidden")
                    return
                self._proxy(recruitment, stripped + (("?" + parsed.query) if parsed.query else ""),
                            recruit=True, internal_jd=is_internal_jd)
                return
            if path.startswith("/api/v1/"):
                if self.command not in {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"}:
                    self._error(405, "method_not_allowed")
                    return
                self._proxy(talent, path + ("?" + parsed.query if parsed.query else ""),
                            recruit=False)
                return
            if self.command not in {"GET", "HEAD"}:
                self._error(405, "method_not_allowed")
                return
            self._static(path)

        def _proxy(self, target: tuple[str, int], resource: str, *, recruit: bool,
                   internal_jd: bool = False):
            size = self.headers.get("Content-Length", "0")
            if self.headers.get("Transfer-Encoding"):
                self._error(400, "chunked_not_supported")
                return
            try:
                length = int(size)
                if length < 0 or length > _MAX_BODY:
                    self._error(413, "invalid_payload_size")
                    return
            except ValueError:
                self._error(400, "invalid_payload_size")
                return
            # The recruitment engine receives no identity-bearing request headers.
            # Talent API retains its cookie and CSRF flows unchanged.
            allow = {"accept"} if recruit else {
                "accept", "content-type", "cookie", "authorization",
                "x-csrf-token", "origin", "referer", "accept-language"}
            if internal_jd:
                allow.add("x-hhba-internal-preview")
            headers = {"Host": f"{target[0]}:{target[1]}"}
            for key, value in self.headers.items():
                if key.lower() in allow and "\r" not in value and "\n" not in value:
                    headers[key] = value
            if recruit:
                headers["Accept"] = "application/json"
            body = self.rfile.read(length) if length else None
            upstream = http.client.HTTPConnection(*target, timeout=8)
            try:
                upstream.request(self.command, resource, body=body, headers=headers)
                resp = upstream.getresponse()
                payload = resp.read(_MAX_BODY + 1)
                if len(payload) > _MAX_BODY:
                    self._error(502, "upstream_payload_too_large")
                    return
                response_headers = {key: val for key, val in resp.getheaders()
                                    if key.lower() in _SAFE_RESPONSES}
                # Never copy the upstream's cookies or unsafe hop-by-hop headers.
                kind = response_headers.pop("Content-Type",
                       response_headers.pop("content-type", "application/json"))
                cookies = ([value for key, value in resp.getheaders()
                            if key.lower() == "set-cookie"] if not recruit else [])
                self._send(resp.status, payload, kind, response_headers, cookies)
            except (TimeoutError, OSError, http.client.HTTPException):
                self._error(503, "upstream_unavailable")
            finally:
                upstream.close()

        def _static(self, raw_path: str):
            if raw_path == "/" or (not Path(raw_path).suffix and
                                   raw_path.startswith(("/candidate", "/recruiter", "/employer",
                                                        "/workspace", "/auth", "/organizations"))):
                path = dist / "index.html"
            else:
                # Only a compiled static web asset, never a source or directory.
                if "%" in raw_path or "\\" in raw_path or "\x00" in raw_path:
                    self._error(404, "not_found")
                    return
                path = (dist / raw_path.lstrip("/")).resolve()
                if not path.is_relative_to(dist) or not path.is_file() or path.name.startswith("."):
                    self._error(404, "not_found")
                    return
            try:
                data = path.read_bytes()
            except OSError:
                self._error(404, "not_found")
                return
            content_type, _ = mimetypes.guess_type(str(path))
            self._send(200, data, content_type or "application/octet-stream")

        do_GET = _route
        do_HEAD = _route
        do_POST = _route
        do_PUT = _route
        do_PATCH = _route
        do_DELETE = _route

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8088)
    parser.add_argument("--talent", default="http://127.0.0.1:8003")
    parser.add_argument("--recruitment", default="http://127.0.0.1:8765")
    parser.add_argument("--dist", type=Path, default=_DIST)
    parser.add_argument("--allow-internal-ats-jd", action="store_true",
                        help="local review only; never enable on a public-facing gateway")
    args = parser.parse_args()
    if args.host != "127.0.0.1":
        parser.error("staging gateway may bind to 127.0.0.1 ONLY")
    talent = validate_target(args.talent)
    recruitment = validate_target(args.recruitment)
    if talent == recruitment:
        parser.error("talent and recruitment must be separate local services")
    with ThreadingHTTPServer((args.host, args.port),
                             make_handler(args.dist, talent, recruitment, allow_internal_jd=args.allow_internal_ats_jd)) as server:
        print(f"HHBA staging: http://127.0.0.1:{server.server_port}/", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
