"""Exercise same-origin HHBA gateway with two real local HTTP upstreams.

No internet, no repository writes, only synthetic fixture responses.
"""
from __future__ import annotations
import json
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from scripts.run_staging_gateway import make_handler, validate_target


class Stub(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def service(self):
        self.server.log.append({"method":self.command,"path":self.path,
                                "headers":dict(self.headers),
                                "body":self.rfile.read(int(self.headers.get("Content-Length","0")))})
        if self.path.startswith("/api/v1/internal/ats-jd/"):
            value={"review_scope":"INTERNAL_SOURCE_INSPECTION_ONLY",
                   "full_text":"SYNTHETIC INTERNAL-ONLY UNIT TEST"}
        elif self.path.startswith("/api/v1/marketplace"):
            value={"data_mode":"official_source_historical_not_live",
                   "all_current_application_statuses_unverified":True,"total":0,"items":[]}
        elif self.path.startswith("/api/v1/auth/"):
            value={"status":"synthetic_talent_auth"}
        else:
            value={"status":"synthetic_talent_api"}
        body=json.dumps(value).encode()
        self.send_response(200)
        self.send_header("Content-Type","application/json")
        self.send_header("Content-Length",str(len(body)))
        if self.server.is_talent:
            self.send_header("Set-Cookie","session=synthetic; HttpOnly; SameSite=Lax; Path=/")
        else:
            self.send_header("Set-Cookie","recruitment_should_not_leak=1; Path=/")
        self.end_headers()
        if self.command != "HEAD": self.wfile.write(body)
    do_GET = service
    do_POST = service
    do_HEAD = service
    def log_message(self, *_): pass


class GatewayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        cls.dist=Path(cls.tmp.name)/"dist"
        (cls.dist/"assets").mkdir(parents=True)
        (cls.dist/"index.html").write_text(
            '<html><body><div id="root">HHBA compiled entry</div></body></html>')
        (cls.dist/"assets/app.js").write_text("console.log('compiled');")
        cls.talent=ThreadingHTTPServer(("127.0.0.1",0), Stub)
        cls.talent.is_talent=True;cls.talent.log=[]
        cls.jobs=ThreadingHTTPServer(("127.0.0.1",0), Stub)
        cls.jobs.is_talent=False;cls.jobs.log=[]
        cls.gateway=ThreadingHTTPServer(("127.0.0.1",0),make_handler(
            cls.dist, cls.talent.server_address, cls.jobs.server_address))
        cls.threads=[]
        for server in (cls.talent,cls.jobs,cls.gateway):
            t=threading.Thread(target=server.serve_forever,daemon=True)
            t.start();cls.threads.append(t)
        cls.base="http://127.0.0.1:"+str(cls.gateway.server_port)

    @classmethod
    def tearDownClass(cls):
        for srv,t in zip((cls.talent,cls.jobs,cls.gateway),cls.threads):
            srv.shutdown();t.join(timeout=5);srv.server_close()
        cls.tmp.cleanup()

    def request(self,path,method="GET",headers=None,body=None):
        return urlopen(Request(self.base+path,data=body,method=method,
                               headers=headers or {}),timeout=5)

    def test_single_site_role_and_candidate_deep_links(self):
        for path in ("/","/candidate","/recruiter/register","/candidate/jobs",
                     "/candidate/jobs/JOB-000001","/assets/app.js"):
            with self.subTest(path=path),self.request(path) as response:
                self.assertEqual(response.status,200)
                self.assertIn("default-src 'self'",response.headers["Content-Security-Policy"])
                self.assertEqual(response.headers["Cache-Control"],"no-store")
                data=response.read()
                self.assertTrue(data)
        with self.assertRaises(HTTPError) as e:self.request("/.env")
        self.assertEqual(e.exception.code,404)

    def test_marketplace_read_only_without_user_credentials(self):
        before=len(self.jobs.log)
        headers={"Cookie":"session=private-session","Authorization":"Bearer SECRET_TOKEN",
                 "X-CSRF-Token":"PRIVATE_CSRF","Referer":"http://127.0.0.1:8088/private",
                 "Accept":"application/json"}
        with self.request("/recruitment/api/v1/marketplace?limit=8",headers=headers) as response:
            data=json.loads(response.read())
            self.assertEqual(data["total"],0)
            self.assertIsNone(response.headers.get("Set-Cookie"))
        self.assertEqual(len(self.jobs.log),before+1)
        log=self.jobs.log[-1]
        self.assertEqual(log["path"],"/api/v1/marketplace?limit=8")
        for private in ("Cookie","Authorization","X-CSRF-Token","Referer"):
            self.assertNotIn(private,log["headers"])
        for path in ("/recruitment/api/v1/review","/recruitment/api/v1/ops",
                     "/recruitment/api/v1/not-real"):
            with self.subTest(path=path),self.assertRaises(HTTPError) as e:self.request(path)
            self.assertEqual(e.exception.code,404)
        with self.assertRaises(HTTPError) as e:self.request(
            "/recruitment/api/v1/marketplace",method="POST",body=b"{}")
        self.assertEqual(e.exception.code,405)

    def test_talent_existing_login_and_csrf_flow_survive(self):
        with self.request("/api/v1/auth/session",method="POST",
              headers={"Cookie":"session=private-session",
                       "X-CSRF-Token":"TOKEN","Content-Type":"application/json"},
              body=b'{"synthetic":true}') as r:
            result=json.loads(r.read())
            self.assertEqual(result["status"],"synthetic_talent_auth")
            self.assertIn("session=synthetic",r.headers["Set-Cookie"])
        log=self.talent.log[-1]
        self.assertEqual(log["headers"]["Cookie"],"session=private-session")
        self.assertEqual({k.lower():v for k,v in log["headers"].items()}["x-csrf-token"],"TOKEN")
        self.assertEqual(log["body"],b'{"synthetic":true}')

    def test_dangerous_host_and_local_file_path_are_blocked(self):
        with self.assertRaises(HTTPError) as e:self.request(
            "/",headers={"Host":"evil.test"})
        self.assertEqual(e.exception.code,403)
        for path in ("/assets/not-exist.js","/secrets.txt","/.git/config",
                     "/%2e%2e/%2e%2e/etc/passwd"):
            with self.subTest(path=path),self.assertRaises(HTTPError) as bad:
                self.request(path)
            self.assertEqual(bad.exception.code,404)

    def test_gateway_is_loopback_only_and_targets_validate(self):
        for x in ("https://127.0.0.1:8003","http://example.com:8080",
                  "http://127.0.0.1:8080/secret","http://user:pass@localhost:8080"):
            with self.subTest(x=x),self.assertRaises(ValueError):
                validate_target(x)
        self.assertEqual(validate_target("http://localhost:8765"),("127.0.0.1",8765))

    def test_internal_jd_route_is_off_by_default_and_opt_in_restricts_headers(self):
        fake_id="ATS-"+("a"*24)
        path="/recruitment/api/v1/internal/ats-jd/"+fake_id
        with self.assertRaises(HTTPError) as no_auth:
            self.request(path,headers={"X-HHBA-Internal-Preview":"1"})
        self.assertEqual(no_auth.exception.code,404)
        preview=ThreadingHTTPServer(("127.0.0.1",0),make_handler(
            self.dist,self.talent.server_address,self.jobs.server_address,
            allow_internal_jd=True))
        thread=threading.Thread(target=preview.serve_forever,daemon=True)
        thread.start()
        url=f"http://127.0.0.1:{preview.server_port}"+path
        try:
            with self.assertRaises(HTTPError) as no_header:
                urlopen(Request(url,method="GET"),timeout=5)
            self.assertEqual(no_header.exception.code,404)
            with self.assertRaises(HTTPError) as query:
                urlopen(Request(url+"?bad=1",headers={"X-HHBA-Internal-Preview":"1"}),timeout=5)
            self.assertEqual(query.exception.code,404)
            with urlopen(Request(url,headers={"X-HHBA-Internal-Preview":"1",
                  "Cookie":"SESSION_PRIVATE","Authorization":"Bearer SENSITIVE"}),timeout=5) as response:
                body=json.loads(response.read())
                self.assertEqual(body["review_scope"],"INTERNAL_SOURCE_INSPECTION_ONLY")
            self.assertEqual(self.jobs.log[-1]["headers"].get("X-Hhba-Internal-Preview"),"1")
            self.assertNotIn("Cookie",self.jobs.log[-1]["headers"])
            self.assertNotIn("Authorization",self.jobs.log[-1]["headers"])
        finally:
            preview.shutdown();thread.join(timeout=3);preview.server_close()


if __name__ == "__main__":
    unittest.main()
