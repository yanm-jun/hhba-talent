from __future__ import annotations
import io
import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from fastapi.testclient import TestClient
from docx import Document

import server
from matcher import profile_from_llm, rank_official_jobs, valid_official_url

ROLE_ID="greenhouse-airtable-858000"
ROLE_URL="https://job-boards.greenhouse.io/airtable/jobs/858000"
HASH="a"*64
ROLE={
 "id":ROLE_ID,"platform":"greenhouse","source":"airtable",
 "title":"Software Engineer, Backend","company":"Airtable","location":"Singapore",
 "url":ROLE_URL,"domestic":False,"remote":False,
}
FACET={
 "countryCode":"SG","cityKey":"singapore","education":"BACHELOR",
 "experienceMinYears":2,"skills":["python","sql"],
 "jobType":"REGULAR","original_source_hash":HASH,
}
AUDIT={
 "status":"OFFICIAL_JD_AND_REQUIREMENTS_FOUND",
 "full_original_jd_verified":True,"jd_sha256":HASH,
}
PROFILE={
 "education":"BACHELOR","education_evidence":"Bachelor of Science",
 "experience_years":3,"experience_evidence":"3 years experience",
 "skills":[{"name":"python","evidence":"Python"}],
 "target_roles":["Software Engineer"],"warnings":[],
}

def docx_payload():
 doc=Document()
 doc.add_paragraph(
  "Software Engineer. Bachelor of Science. 3 years experience using Python, "
  "SQL, backend APIs and cloud systems. Delivered services with well documented "
  "architecture and teams in software engineering environments."
 )
 f=io.BytesIO()
 doc.save(f)
 return f.getvalue()

class MatcherSecurityTests(unittest.TestCase):
 def test_evidence_for_profiles_only(self):
  source="Bachelor of Science. Three years experience in Python and AWS. Software Engineer."
  extracted={
   "education":{"level":"BACHELOR","evidence":"Bachelor of Science"},
   "experience_years":3,"experience_evidence":"Three years experience",
   "skills":[{"name":"Python","evidence":"Python"},
             {"name":"Kubernetes","evidence":"not actually in source"}],
   "target_roles":[{"role":"Software Engineer","evidence":"Software Engineer"}]
  }
  p=profile_from_llm(extracted,source)
  self.assertEqual(p["education"],"BACHELOR")
  self.assertEqual(p["experience_years"],3)
  self.assertEqual([x["name"] for x in p["skills"]],["python"])
  self.assertEqual(p["target_roles"],["Software Engineer"])

 def test_work_history_must_appear_verbatim_in_resume(self):
  resume="Acme Corp Sales Manager 2022-2025. Bachelor of Science. 3 years experience."
  candidate=profile_from_llm({
   "experiences":[
    {"role":"Sales Manager","organization":"Acme Corp","period":"2022-2025",
     "evidence":"Acme Corp Sales Manager 2022-2025"},
    {"role":"CTO","organization":"Another","period":"2021-2022",
     "evidence":"unrelated invented work"},
   ]
  },resume)
  self.assertEqual(len(candidate["experiences"]),1)
  self.assertEqual(candidate["experiences"][0]["role"],"Sales Manager")
  self.assertEqual(candidate["experiences"][0]["organization"],"Acme Corp")

 def test_unknown_degree_is_never_called_unrestricted(self):
  p=rank_official_jobs(PROFILE,[ROLE],{ROLE_ID:{**FACET,"education":None}},{ROLE_ID:AUDIT})
  self.assertEqual(len(p),1)
  self.assertTrue(any("不能当作不限学历" in text for text in p[0]["needs_verification"]))

 def test_official_hash_mismatch_or_fake_employer_link_cannot_recommend(self):
  self.assertEqual(rank_official_jobs(PROFILE,[ROLE],
    {ROLE_ID:{**FACET,"original_source_hash":"b"*64}},{ROLE_ID:AUDIT}),[])
  self.assertEqual(rank_official_jobs(PROFILE,[{**ROLE,"url":"https://fake-airtable.example/jobs/858000"}],
    {ROLE_ID:FACET},{ROLE_ID:AUDIT}),[])
  self.assertEqual(rank_official_jobs(PROFILE,[ROLE],{ROLE_ID:FACET},
    {ROLE_ID:{**AUDIT,"full_original_jd_verified":False}}),[])

 def test_skills_experience_degree_and_skills_not_proven_are_not_claimed_as_missing_ability(self):
  matches=rank_official_jobs(PROFILE,[ROLE],{ROLE_ID:FACET},{ROLE_ID:AUDIT})
  self.assertEqual(len(matches),1)
  result=matches[0]
  self.assertEqual(result["official_url"],ROLE_URL)
  self.assertGreater(result["reference_score"],1)
  self.assertTrue(any("Python".lower() in m.lower() for m in result["matched"]))
  self.assertTrue(any("尚未证明" in m for m in result["not_evidenced"]))
  self.assertTrue(any("签证" in m for m in result["needs_verification"]))

 def test_invalid_llm_education_cannot_crash_verifier(self):
  p=profile_from_llm({"education":{"level":["PHD"],"evidence":"Bachelor of Science"}}, "Bachelor of Science 2018")
  self.assertIsNone(p["education"])

class ApiConsentTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix="hhba-match-tests-")
  self.database=sqlite3.connect(Path(self.temp.name)/"quota.sqlite",isolation_level=None,check_same_thread=False)
  self.database.execute("CREATE TABLE usage (day TEXT NOT NULL,scope TEXT NOT NULL,used INTEGER NOT NULL,PRIMARY KEY(day,scope))")
  self.old_client=server.quota_db
  self.old_public=server.MATCH_PUBLIC_ENABLED
  self.old_budget=server.MAX_REQUEST_PER_DAY
  self.old_per_client=server.MAX_CLIENT_PER_DAY
  server.quota_db=self.database
  server.active_count=0
  server.MATCH_PUBLIC_ENABLED=False
  server.MAX_REQUEST_PER_DAY=5
  server.MAX_CLIENT_PER_DAY=2
  self.client=TestClient(server.app,raise_server_exceptions=True)
  self._key=patch.dict(os.environ,{"DEEPSEEK_API_KEY":"test-only-key-value"})
  self._key.start()
 def tearDown(self):
  self._key.stop()
  self.client.close()
  server.MATCH_PUBLIC_ENABLED=self.old_public
  server.MAX_REQUEST_PER_DAY=self.old_budget
  server.MAX_CLIENT_PER_DAY=self.old_per_client
  server.quota_db=self.old_client
  self.database.close()
  self.temp.cleanup()
 def submit(self,*,consent="true",origin="https://yanm-jun.github.io",name="resume.docx"):
  return self.client.post("/api/v1/match/resume",data={"consent":consent,"limit":"10"},
   files={"file":(name,docx_payload(),"application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
   headers={"Origin":origin})
 def test_platform_admin_off_disallows_costly_upload(self):
  r=self.submit()
  self.assertEqual(r.status_code,503)
  self.assertEqual(r.json()["error"],"ADMIN_HAS_NOT_ENABLED_AI_MATCHING")
  self.assertEqual(self.database.execute("SELECT COUNT(*) FROM usage").fetchone()[0],0)
 def test_missing_user_key_is_not_required_but_admin_key_is(self):
  server.MATCH_PUBLIC_ENABLED=True
  with patch.dict(os.environ,{"DEEPSEEK_API_KEY":""}):
   response=self.submit()
   self.assertEqual(response.status_code,503)
   self.assertEqual(response.json()["error"],"ADMIN_AI_NOT_CONFIGURED")
 def test_consent_and_origin_must_be_explicit(self):
  server.MATCH_PUBLIC_ENABLED=True
  self.assertEqual(self.submit(consent="false").status_code,400)
  self.assertEqual(self.submit(origin="https://evil.example").status_code,403)
 def test_no_provider_called_when_official_index_fails(self):
  server.MATCH_PUBLIC_ENABLED=True
  async def fail():
   from fastapi import HTTPException
   raise HTTPException(status_code=503,detail="OFFICIAL_JOB_INDEX_UNAVAILABLE")
  with patch.object(server,"download_official_data",fail), patch.object(server,"extract_profile_with_deepseek") as ai:
   response=self.submit()
   self.assertEqual(response.status_code,503)
   ai.assert_not_called()
 def test_actual_upload_with_mocked_admin_provider_and_real_official_match(self):
  server.MATCH_PUBLIC_ENABLED=True
  async def official():
   return [ROLE],{ROLE_ID:FACET},{ROLE_ID:AUDIT}
  async def fake(text,key):
   self.assertEqual(key,"test-only-key-value")
   self.assertTrue("Software Engineer" in text)
   return PROFILE
  with patch.object(server,"download_official_data",official),patch.object(server,"extract_profile_with_deepseek",fake):
   response=self.submit()
  self.assertEqual(response.status_code,200,response.text)
  body=response.json()
  self.assertEqual(body["status"],"COMPLETE")
  self.assertEqual(body["matched_official_jobs"],1)
  self.assertEqual(body["matches"][0]["id"],ROLE_ID)
  self.assertNotIn("test-only-key-value",response.text)
  self.assertNotIn("DEEPSEEK_API_KEY",response.text)
 def test_client_quota_persists_after_service_client_restarts(self):
  server.MATCH_PUBLIC_ENABLED=True
  async def official():return [ROLE],{ROLE_ID:FACET},{ROLE_ID:AUDIT}
  async def fake(text,key):return PROFILE
  with patch.object(server,"download_official_data",official),patch.object(server,"extract_profile_with_deepseek",fake):
   self.assertEqual(self.submit().status_code,200)
   self.assertEqual(self.submit().status_code,200)
   self.assertEqual(self.submit().status_code,429)
   server.quota_db=None
   server.quota_db=sqlite3.connect(Path(self.temp.name)/"quota.sqlite",isolation_level=None,check_same_thread=False)
   self.database.close()
   self.database=server.quota_db
   self.assertEqual(self.submit().status_code,429)
 def test_scan_pdf_and_bad_docx_are_rejected_without_provider_call(self):
  from fastapi import HTTPException
  with self.assertRaises(HTTPException):
   server.parse_resume(b"not a pdf","resume.pdf")
  with self.assertRaises(HTTPException):
   server.parse_resume(b"PK\x03\x04bad","resume.docx")

if __name__=="__main__":
 unittest.main()
