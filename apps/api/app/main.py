"""Phase 1 identity, organization, consent and audit API."""
import hashlib, json, os, re, secrets
from urllib.parse import urlsplit
from datetime import date, datetime, timedelta, timezone
from uuid import UUID, uuid4
from fastapi import FastAPI, Depends, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, and_, create_engine, func, or_, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.dialects.postgresql import insert as pg_insert
def now(): return datetime.now(timezone.utc)
def comparable_time(value): return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value
class Base(DeclarativeBase): pass
class User(Base):
 __tablename__='users'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); email: Mapped[str]=mapped_column(String(320),unique=True,index=True); name: Mapped[str]=mapped_column(String(100)); password_hash: Mapped[str]=mapped_column(String(512)); status: Mapped[str]=mapped_column(String(32),default='active'); role: Mapped[str]=mapped_column(String(32),default='user')
class AuthSession(Base):
 __tablename__='auth_sessions'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id',ondelete='CASCADE')); token_hash: Mapped[str]=mapped_column(String(64),unique=True); csrf: Mapped[str]=mapped_column(String(128)); expires_at: Mapped[datetime]=mapped_column(DateTime(timezone=True)); revoked_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
class Organization(Base):
 __tablename__='organizations'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); legal_name: Mapped[str]=mapped_column(String(200)); status: Mapped[str]=mapped_column(String(32),default='pending_review'); created_by: Mapped[UUID]=mapped_column(ForeignKey('users.id')); reviewed_by: Mapped[UUID|None]=mapped_column(ForeignKey('users.id')); reviewed_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
class Membership(Base):
 __tablename__='organization_memberships'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); organization_id: Mapped[UUID]=mapped_column(ForeignKey('organizations.id')); user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id')); role: Mapped[str]=mapped_column(String(32),default='member'); status: Mapped[str]=mapped_column(String(32),default='active')
class Consent(Base):
 __tablename__='consents'; __table_args__=(UniqueConstraint('user_id','consent_type',name='uq_consents_user_type'),); id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id')); consent_type: Mapped[str]=mapped_column(String(64)); granted: Mapped[bool]=mapped_column(Boolean,default=False); changed_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class Audit(Base):
 __tablename__='audit_events'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); occurred_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now); actor_id: Mapped[UUID|None]=mapped_column(ForeignKey('users.id')); action: Mapped[str]=mapped_column(String(120)); outcome: Mapped[str]=mapped_column(String(32)); resource: Mapped[str]=mapped_column(String(100)); request_id: Mapped[str]=mapped_column(String(64)); metadata_redacted: Mapped[dict]=mapped_column(JSON,default=dict)
class Resume(Base):
 __tablename__='resumes'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); owner_user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id')); storage_key: Mapped[str]=mapped_column(String(255),unique=True); original_filename: Mapped[str]=mapped_column(String(255)); mime_type: Mapped[str]=mapped_column(String(100)); size_bytes: Mapped[int]=mapped_column(); sha256: Mapped[str]=mapped_column(String(64)); status: Mapped[str]=mapped_column(String(32)); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class ParseJob(Base):
 __tablename__='parsing_jobs'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); resume_id: Mapped[UUID]=mapped_column(ForeignKey('resumes.id')); state: Mapped[str]=mapped_column(String(32)); attempt_count: Mapped[int]=mapped_column(default=0); worker_id: Mapped[str|None]=mapped_column(String(100)); started_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); finished_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); lease_expires_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); cancel_requested: Mapped[bool]=mapped_column(Boolean,default=False); error_code: Mapped[str|None]=mapped_column(String(64)); error_safe_message: Mapped[str|None]=mapped_column(String(300)); result_json: Mapped[dict|None]=mapped_column(JSON); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now); updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class Profile(Base):
 __tablename__='profiles'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); owner_user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id'),unique=True); status: Mapped[str]=mapped_column(String(32),default='draft'); display_name: Mapped[str|None]=mapped_column(String(100)); content_json: Mapped[dict]=mapped_column(JSON,default=dict); public_slug: Mapped[str|None]=mapped_column(String(100),unique=True); published_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class ProfileVersion(Base):
 __tablename__='profile_versions'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); profile_id: Mapped[UUID]=mapped_column(ForeignKey('profiles.id')); version: Mapped[int]=mapped_column(); content_json: Mapped[dict]=mapped_column(JSON); confirmed_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class ProfileDetail(Base):
 __abstract__=True
 id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4);profile_id: Mapped[UUID]=mapped_column(ForeignKey('profiles.id'));visibility: Mapped[str]=mapped_column(String(32),default='private')
class Experience(ProfileDetail):
 __tablename__='profile_experiences';employer: Mapped[str|None]=mapped_column(String(200));title: Mapped[str|None]=mapped_column(String(200));summary: Mapped[str|None]=mapped_column()
class Education(ProfileDetail):
 __tablename__='profile_educations';institution: Mapped[str|None]=mapped_column(String(200));degree: Mapped[str|None]=mapped_column(String(200))
class Project(ProfileDetail):
 __tablename__='profile_projects';name: Mapped[str|None]=mapped_column(String(200));summary: Mapped[str|None]=mapped_column()
class ServiceIntent(ProfileDetail):
 __tablename__='profile_service_intents';service_name: Mapped[str]=mapped_column(String(200));region: Mapped[str|None]=mapped_column(String(100));work_mode: Mapped[str|None]=mapped_column(String(64))
class HiringRequirement(Base):
 __tablename__='hiring_requirements'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); organization_id: Mapped[UUID]=mapped_column(ForeignKey('organizations.id',ondelete='CASCADE'),index=True); created_by: Mapped[UUID]=mapped_column(ForeignKey('users.id')); title: Mapped[str]=mapped_column(String(160)); description: Mapped[str]=mapped_column(Text); location: Mapped[str|None]=mapped_column(String(120)); work_mode: Mapped[str|None]=mapped_column(String(64)); status: Mapped[str]=mapped_column(String(32),default='draft'); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now); updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class EmployerPosting(Base):
 __tablename__='employer_postings'
 id:Mapped[UUID]=mapped_column(primary_key=True,default=uuid4)
 organization_id:Mapped[UUID]=mapped_column(ForeignKey('organizations.id',ondelete='CASCADE'),index=True)
 created_by:Mapped[UUID]=mapped_column(ForeignKey('users.id'))
 title:Mapped[str]=mapped_column(String(160))
 description:Mapped[str]=mapped_column(Text)
 requirements:Mapped[str]=mapped_column(Text)
 location:Mapped[str]=mapped_column(String(120))
 work_mode:Mapped[str]=mapped_column(String(32))
 recruitment_type:Mapped[str]=mapped_column(String(24))
 apply_url:Mapped[str]=mapped_column(String(1000))
 status:Mapped[str]=mapped_column(String(32),default='draft')
 submitted_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
 reviewed_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
 reviewed_by:Mapped[UUID|None]=mapped_column(ForeignKey('users.id'))
 review_reason:Mapped[str|None]=mapped_column(String(120))
 published_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
 expires_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
 created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
 updated_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)

class EmployerJobApplication(Base):
 __tablename__='employer_job_applications'
 __table_args__=(UniqueConstraint('posting_id','candidate_user_id',name='uq_employer_application_posting_candidate'),)
 id:Mapped[UUID]=mapped_column(primary_key=True,default=uuid4)
 posting_id:Mapped[UUID]=mapped_column(ForeignKey('employer_postings.id',ondelete='CASCADE'),index=True)
 organization_id:Mapped[UUID]=mapped_column(ForeignKey('organizations.id',ondelete='CASCADE'),index=True)
 candidate_user_id:Mapped[UUID]=mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True)
 snapshot_json:Mapped[dict]=mapped_column(JSON,default=dict)
 cover_note:Mapped[str]=mapped_column(Text,default='')
 status:Mapped[str]=mapped_column(String(32),default='submitted')
 consented_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
 created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
 updated_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
 withdrawn_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
 updated_by:Mapped[UUID|None]=mapped_column(ForeignKey('users.id'))

class CandidateSearchProjection(Base):
 __tablename__='candidate_search_projections'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); profile_id: Mapped[UUID]=mapped_column(ForeignKey('profiles.id',ondelete='CASCADE'),unique=True,index=True); owner_user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True); candidate_ref: Mapped[str]=mapped_column(String(32),unique=True,index=True,default=lambda:uuid4().hex); display_name: Mapped[str|None]=mapped_column(String(100)); headline: Mapped[str|None]=mapped_column(String(300)); capability_summary: Mapped[str|None]=mapped_column(Text); skills: Mapped[list]=mapped_column(JSON,default=list); industries: Mapped[list]=mapped_column(JSON,default=list); location: Mapped[str|None]=mapped_column(String(120)); service_regions: Mapped[list]=mapped_column(JSON,default=list); work_modes: Mapped[list]=mapped_column(JSON,default=list); work_years: Mapped[int|None]=mapped_column(Integer); project_summaries: Mapped[list]=mapped_column(JSON,default=list); skills_text: Mapped[str]=mapped_column(Text,default=''); industries_text: Mapped[str]=mapped_column(Text,default=''); regions_text: Mapped[str]=mapped_column(Text,default=''); work_modes_text: Mapped[str]=mapped_column(Text,default=''); search_text: Mapped[str]=mapped_column(Text,default=''); profile_version: Mapped[int]=mapped_column(Integer,default=0); indexed_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class TalentSearchUsage(Base):
 __tablename__='talent_search_usages'; __table_args__=(UniqueConstraint('organization_id','user_id','usage_date',name='uq_talent_search_usage_day'),); id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); organization_id: Mapped[UUID]=mapped_column(ForeignKey('organizations.id',ondelete='CASCADE'),index=True); user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True); usage_date: Mapped[date]=mapped_column(Date); request_count: Mapped[int]=mapped_column(Integer,default=0); updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class BusinessIdentity(Base):
 __tablename__='business_identities'; __table_args__=(UniqueConstraint('user_id','identity_type',name='uq_business_identity_user_type'),); id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True); identity_type: Mapped[str]=mapped_column(String(32)); status: Mapped[str]=mapped_column(String(32),default='active'); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class OrganizationVerification(Base):
 __tablename__='organization_verifications'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); organization_id: Mapped[UUID]=mapped_column(ForeignKey('organizations.id',ondelete='CASCADE'),unique=True,index=True); applicant_user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id')); recruitment_subject_type: Mapped[str]=mapped_column(String(32),default='employer'); legal_name: Mapped[str|None]=mapped_column(String(200)); credit_code: Mapped[str|None]=mapped_column(String(32),index=True); registered_location: Mapped[str|None]=mapped_column(String(160)); status: Mapped[str]=mapped_column(String(32),default='draft'); version: Mapped[int]=mapped_column(Integer,default=1); submitted_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); reviewed_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); reviewed_by: Mapped[UUID|None]=mapped_column(ForeignKey('users.id')); review_reason_code: Mapped[str|None]=mapped_column(String(80)); verified_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); next_review_due_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); suspended_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); suspension_reason_code: Mapped[str|None]=mapped_column(String(80)); updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class RecruiterVerification(Base):
 __tablename__='recruiter_verifications'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id',ondelete='CASCADE'),unique=True,index=True); status: Mapped[str]=mapped_column(String(32),default='draft'); real_name: Mapped[str|None]=mapped_column(String(100)); job_title: Mapped[str|None]=mapped_column(String(120)); relationship_type: Mapped[str|None]=mapped_column(String(48)); reviewed_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); reviewed_by: Mapped[UUID|None]=mapped_column(ForeignKey('users.id')); review_reason_code: Mapped[str|None]=mapped_column(String(80)); verified_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); next_review_due_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class RecruiterOrganizationAuthorization(Base):
 __tablename__='recruiter_organization_authorizations'; __table_args__=(UniqueConstraint('organization_id','user_id',name='uq_recruiter_org_authorization'),); id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); organization_id: Mapped[UUID]=mapped_column(ForeignKey('organizations.id',ondelete='CASCADE'),index=True); user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True); role: Mapped[str]=mapped_column(String(32),default='recruiter'); status: Mapped[str]=mapped_column(String(32),default='draft'); granted_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); expires_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); revoked_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class RecruiterInvitation(Base):
 __tablename__='recruiter_invitations'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); organization_id: Mapped[UUID]=mapped_column(ForeignKey('organizations.id',ondelete='CASCADE'),index=True); invitee_user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True); created_by_user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id')); proposed_role: Mapped[str]=mapped_column(String(32)); status: Mapped[str]=mapped_column(String(32),default='pending'); expires_at: Mapped[datetime]=mapped_column(DateTime(timezone=True)); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now); accepted_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); revoked_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
class VerificationDocument(Base):
 __tablename__='verification_documents'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); organization_id: Mapped[UUID]=mapped_column(ForeignKey('organizations.id',ondelete='CASCADE'),index=True); uploader_user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id')); evidence_version: Mapped[int]=mapped_column(Integer,default=1); document_type: Mapped[str]=mapped_column(String(48)); storage_key: Mapped[str]=mapped_column(String(255),unique=True); original_filename: Mapped[str]=mapped_column(String(255)); mime_type: Mapped[str]=mapped_column(String(100)); size_bytes: Mapped[int]=mapped_column(); sha256: Mapped[str]=mapped_column(String(64)); security_status: Mapped[str]=mapped_column(String(32),default='pending'); security_checked_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); security_checked_by: Mapped[UUID|None]=mapped_column(ForeignKey('users.id')); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class VerificationEvidenceSnapshot(Base):
 __tablename__='verification_evidence_snapshots'; __table_args__=(UniqueConstraint('organization_id','evidence_version',name='uq_verification_evidence_version'),); id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); organization_id: Mapped[UUID]=mapped_column(ForeignKey('organizations.id',ondelete='CASCADE'),index=True); evidence_version: Mapped[int]=mapped_column(Integer); manifest: Mapped[dict]=mapped_column(JSON); manifest_sha256: Mapped[str]=mapped_column(String(64)); submitted_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class VerificationReview(Base):
 __tablename__='verification_reviews'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); organization_id: Mapped[UUID]=mapped_column(ForeignKey('organizations.id',ondelete='CASCADE'),index=True); reviewer_user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id')); evidence_version: Mapped[int]=mapped_column(Integer); evidence_snapshot_id: Mapped[UUID]=mapped_column(ForeignKey('verification_evidence_snapshots.id')); evidence_manifest_sha256: Mapped[str]=mapped_column(String(64)); entity_verification: Mapped[str]=mapped_column(String(32),default='not_verified'); representative_verification: Mapped[str]=mapped_column(String(32),default='not_verified'); authorization_verification: Mapped[str]=mapped_column(String(32),default='not_verified'); outcome: Mapped[str]=mapped_column(String(32)); reason_code: Mapped[str]=mapped_column(String(80)); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class PlatformServiceGate(Base):
 __tablename__='platform_service_gates'; gate_key: Mapped[str]=mapped_column(String(64),primary_key=True); enabled: Mapped[bool]=mapped_column(Boolean,default=False); reviewed_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); reviewed_by: Mapped[UUID|None]=mapped_column(ForeignKey('users.id')); reason_code: Mapped[str|None]=mapped_column(String(80))
DATABASE_URL=os.getenv('DATABASE_URL','postgresql+psycopg://hhba_app:CHANGE_ME_LOCAL_ONLY@127.0.0.1:5432/hhba_dev')
if DATABASE_URL.startswith('postgresql://'):DATABASE_URL='postgresql+psycopg://'+DATABASE_URL.removeprefix('postgresql://')
engine=create_engine(DATABASE_URL,pool_pre_ping=True); SessionLocal=sessionmaker(bind=engine,expire_on_commit=False); pwd=PasswordHash.recommended(); app=FastAPI(title='HHBA API',version='0.1.0')
app.add_middleware(CORSMiddleware,allow_origins=['http://127.0.0.1:3000','http://127.0.0.1:3001','http://127.0.0.1:3002','http://127.0.0.1:3003','http://127.0.0.1:5173'],allow_credentials=True,allow_methods=['GET','POST','PUT','PATCH','DELETE'],allow_headers=['Content-Type','X-CSRF-Token'])
def db():
 s=SessionLocal()
 try: yield s
 finally: s.close()
def audit(s,r,a,o,res,actor=None,m=None): s.add(Audit(actor_id=actor,action=a,outcome=o,resource=res,request_id=r.state.rid,metadata_redacted=m or {}))
@app.middleware('http')
async def mid(r,call): r.state.rid=str(uuid4()); x=await call(r); x.headers['X-Request-ID']=r.state.rid; return x
def auth(r:Request,s:Session=Depends(db)):
 t=r.cookies.get('hhba_session',''); q=s.scalar(select(AuthSession).where(AuthSession.token_hash==hashlib.sha256(t.encode()).hexdigest()))
 if not q or q.revoked_at or comparable_time(q.expires_at)<=now(): raise HTTPException(401,'authentication required')
 u=s.get(User,q.user_id)
 if not u or u.status!='active': raise HTTPException(403,'account inactive')
 return u,q
def csrf(r:Request,a=Depends(auth)):
 if not secrets.compare_digest(r.headers.get('X-CSRF-Token',''),a[1].csrf): raise HTTPException(403,'csrf validation failed')
 return a
class Register(BaseModel): email:EmailStr; password:str=Field(min_length=12); display_name:str; account_type:str=Field(default='candidate',pattern='^(candidate|recruiter)$')
class Login(BaseModel): email:EmailStr; password:str; account_type:str|None=Field(default=None,pattern='^(candidate|recruiter)$')
class OrgIn(BaseModel): legal_name:str=Field(min_length=2)
class ReviewIn(BaseModel): status:str=Field(pattern='^(approved|rejected|suspended)$')
class VerificationIn(BaseModel): legal_name:str=Field(min_length=2,max_length=200); credit_code:str=Field(min_length=8,max_length=32); registered_location:str=Field(min_length=2,max_length=160); recruitment_subject_type:str=Field(default='employer',pattern='^(employer|agency)$'); real_name:str=Field(min_length=2,max_length=100); job_title:str=Field(min_length=2,max_length=120)
class CompanyVerificationIn(BaseModel): legal_name:str=Field(min_length=2,max_length=200); credit_code:str=Field(min_length=8,max_length=32); registered_location:str=Field(min_length=2,max_length=160); recruitment_subject_type:str=Field(default='employer',pattern='^(employer|agency)$')
class RepresentativeVerificationIn(BaseModel): real_name:str=Field(min_length=2,max_length=100); job_title:str=Field(min_length=2,max_length=120); relationship_type:str=Field(pattern='^(legal_representative|business_owner|hr_lead|hr_recruiter|authorized_agent)$')
class VerificationReviewIn(BaseModel): status:str=Field(pattern='^(need_more_info|approved|rejected|suspended)$'); reason_code:str=Field(min_length=3,max_length=80); expected_revision:int=Field(ge=1); evidence_snapshot_id:UUID; valid_days:int=Field(default=180,ge=1,le=365); entity_verification:str=Field(default='not_verified',pattern='^(not_verified|manual_verified|failed)$'); representative_verification:str=Field(default='not_verified',pattern='^(not_verified|manual_verified|failed)$'); authorization_verification:str=Field(default='not_verified',pattern='^(not_verified|manual_verified|failed)$')
class DocumentSecurityIn(BaseModel): status:str=Field(pattern='^(clean|rejected)$'); reason_code:str=Field(min_length=3,max_length=80)
class InvitationIn(BaseModel): invitee_user_id:UUID; proposed_role:str=Field(pattern='^(member|admin)$'); expires_in_days:int=Field(default=7,ge=1,le=30)
class GateIn(BaseModel): enabled:bool; reason_code:str=Field(min_length=3,max_length=80)
class AuthorizationIn(BaseModel): user_id:UUID; role:str=Field(pattern='^(organization_owner|recruitment_admin|recruiter|review_only)$')
class ConsentIn(BaseModel): granted:bool
class MemberIn(BaseModel): user_id:UUID; role:str=Field(pattern='^(owner|member)$')
class RequirementIn(BaseModel):
 title:str=Field(min_length=1,max_length=160); description:str=Field(min_length=1,max_length=8000); location:str|None=Field(default=None,max_length=120); work_mode:str|None=Field(default=None,max_length=64); status:str=Field(default='draft',pattern='^(draft|archived)$')
class RequirementPatch(BaseModel):
 title:str|None=Field(default=None,min_length=1,max_length=160); description:str|None=Field(default=None,min_length=1,max_length=8000); location:str|None=Field(default=None,max_length=120); work_mode:str|None=Field(default=None,max_length=64); status:str|None=Field(default=None,pattern='^(draft|archived)$')
class EmployerPostingIn(BaseModel):
 title:str=Field(min_length=3,max_length=160)
 description:str=Field(min_length=40,max_length=8000)
 requirements:str=Field(min_length=20,max_length=8000)
 location:str=Field(min_length=2,max_length=120)
 work_mode:str=Field(pattern='^(onsite|hybrid|remote)$')
 recruitment_type:str=Field(pattern='^(SOCIAL|CAMPUS|INTERNSHIP)$')
 apply_url:str=Field(min_length=12,max_length=1000)
class EmployerPostingReviewIn(BaseModel):
 decision:str=Field(pattern='^(approved|rejected)$')
 reason_code:str=Field(min_length=3,max_length=120)
class EmployerApplicationSubmitIn(BaseModel):
 confirmed_share:bool
 cover_note:str=Field(default='',max_length=500)
class EmployerApplicationStatusIn(BaseModel):
 status:str=Field(pattern='^(reviewing|shortlisted|interview|rejected|hired)$')
 expected_status:str=Field(pattern='^(submitted|reviewing|shortlisted|interview|rejected|hired)$')

class TalentSearchIn(BaseModel):
 keywords:str|None=Field(default=None,max_length=200)
 skills:list[str]=Field(default_factory=list,max_length=8)
 industry:str|None=Field(default=None,max_length=80)
 region:str|None=Field(default=None,max_length=80)
 work_mode:str|None=Field(default=None,max_length=64)
 work_years_min:int|None=Field(default=None,ge=0,le=80)
 work_years_max:int|None=Field(default=None,ge=0,le=80)
 # A page stays deliberately small (at most ten projected cards), while the
 # page range matches the per-organization daily search allowance. This makes
 # a 305+ result set reachable without returning a bulk enumeration response.
 page:int=Field(default=1,ge=1,le=100)
 page_size:int=Field(default=10,ge=1,le=10)
@app.get('/healthz')
def healthz(): return {'status':'ok','phase':'1'}
@app.post('/api/v1/auth/register',status_code=201)
def reg(x:Register,r:Request,s:Session=Depends(db)):
 # Public registration must never mint an internal-reviewer account from an
 # email address.  Internal administrators are provisioned through a separate
 # controlled operational procedure, not a browser registration side effect.
 e=str(x.email).casefold(); u=User(email=e,name=x.display_name,password_hash=pwd.hash(x.password),role='user');s.add(u)
 try:s.flush()
 except Exception:s.rollback();raise HTTPException(409,'account cannot be created')
 s.add(BusinessIdentity(user_id=u.id,identity_type=x.account_type));
 if x.account_type=='recruiter':s.add(RecruiterVerification(user_id=u.id,status='draft'))
 audit(s,r,'auth.register','success',f'user:{u.id}',u.id,{'account_type':x.account_type});s.commit();return {'id':str(u.id),'account_type':x.account_type}
@app.post('/api/v1/auth/session')
def login(x:Login,res:Response,r:Request,s:Session=Depends(db)):
 u=s.scalar(select(User).where(User.email==str(x.email).casefold()))
 if not u or not pwd.verify(x.password,u.password_hash):audit(s,r,'auth.login','denied','session');s.commit();raise HTTPException(401,'invalid credentials')
 if x.account_type and not has_identity(s,u.id,x.account_type):audit(s,r,'auth.login.identity_denied','denied','session',u.id,{'account_type':x.account_type});s.commit();raise HTTPException(403,'account identity does not match this entry')
 t=secrets.token_urlsafe(32);q=AuthSession(user_id=u.id,token_hash=hashlib.sha256(t.encode()).hexdigest(),csrf=secrets.token_urlsafe(32),expires_at=now()+timedelta(hours=8));s.add(q);audit(s,r,'auth.login','success','session',u.id);s.commit();res.set_cookie('hhba_session',t,httponly=True,samesite='lax');return {'csrf_token':q.csrf,'role':u.role}
@app.get('/api/v1/auth/me')
def me(a=Depends(auth),s:Session=Depends(db)):
 identities=[row.identity_type for row in s.scalars(select(BusinessIdentity).where(BusinessIdentity.user_id==a[0].id,BusinessIdentity.status=='active'))]
 return {'id':str(a[0].id),'email':a[0].email,'display_name':a[0].name,'role':a[0].role,'account_types':identities,'csrf_token':a[1].csrf}
@app.delete('/api/v1/auth/session')
def logout(res:Response,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 a[1].revoked_at=now();audit(s,r,'auth.logout','success','session',a[0].id);s.commit();res.delete_cookie('hhba_session');return {'ok':True}
@app.post('/api/v1/auth/register/candidate',status_code=201)
def register_candidate(x:Register,r:Request,s:Session=Depends(db)):
 return reg(Register(email=x.email,password=x.password,display_name=x.display_name,account_type='candidate'),r,s)
@app.post('/api/v1/auth/register/recruiter',status_code=201)
def register_recruiter(x:Register,r:Request,s:Session=Depends(db)):
 return reg(Register(email=x.email,password=x.password,display_name=x.display_name,account_type='recruiter'),r,s)
def has_identity(s,user_id,identity_type):
 return bool(s.scalar(select(BusinessIdentity).where(BusinessIdentity.user_id==user_id,BusinessIdentity.identity_type==identity_type,BusinessIdentity.status=='active')))
def candidate_auth(a=Depends(auth),s:Session=Depends(db)):
 if not has_identity(s,a[0].id,'candidate'):raise HTTPException(403,'candidate identity required')
 return a
def candidate_csrf(a=Depends(csrf),s:Session=Depends(db)):
 if not has_identity(s,a[0].id,'candidate'):raise HTTPException(403,'candidate identity required')
 return a
def verification_is_current(row):
 return bool(row and row.status=='approved' and (not row.next_review_due_at or comparable_time(row.next_review_due_at)>now()))
RECRUITER_ROLES={'organization_owner','recruitment_admin','recruiter'}
def recruiter_context(s,oid,user_id):
 """Resolve recruiter context once; callers must not hand-roll this check."""
 return (active_membership(oid,user_id,s),s.get(Organization,oid),s.scalar(select(OrganizationVerification).where(OrganizationVerification.organization_id==oid)),s.scalar(select(RecruiterVerification).where(RecruiterVerification.user_id==user_id)),s.scalar(select(RecruiterOrganizationAuthorization).where(RecruiterOrganizationAuthorization.organization_id==oid,RecruiterOrganizationAuthorization.user_id==user_id)))
def require_recruitment_permission(s,oid,user_id,permission):
 """Central deny-by-default policy for organization-scoped recruiter actions.

 `manage_drafts` is intentionally available while verification is being
 prepared.  Search/restricted access remains unavailable until the platform
 gate, organization verification, individual verification and authorization
 are all current.
 """
 member,org,org_ver,recruiter,authorization=recruiter_context(s,oid,user_id)
 base=bool(member and member.status=='active' and has_identity(s,user_id,'recruiter') and authorization and authorization.status in {'draft','active'} and authorization.role in RECRUITER_ROLES and (not authorization.expires_at or comparable_time(authorization.expires_at)>now()))
 if permission=='manage_drafts': return base
 if permission in {'manage_members','review_verification'}: return bool(base and org and org.status=='approved' and authorization and authorization.status=='active' and verification_is_current(org_ver) and verification_is_current(recruiter) and authorization.role in {'organization_owner','recruitment_admin'})
 if permission in {'talent_search','restricted_access'}:
  gate=s.get(PlatformServiceGate,'network_recruitment')
  return bool(base and gate and gate.enabled and org and org.status=='approved' and verification_is_current(org_ver) and verification_is_current(recruiter) and authorization and authorization.status=='active')
 return False
def recruitment_allowed(s,oid,user_id):
 return require_recruitment_permission(s,oid,user_id,'talent_search')
@app.post('/api/v1/organizations',status_code=201)
def org(x:OrgIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not has_identity(s,a[0].id,'recruiter'):raise HTTPException(403,'recruiter identity required')
 o=Organization(legal_name=x.legal_name,created_by=a[0].id);s.add(o);s.flush();s.add(Membership(organization_id=o.id,user_id=a[0].id,role='owner'));s.add(OrganizationVerification(organization_id=o.id,applicant_user_id=a[0].id,legal_name=x.legal_name,status='draft'));s.add(RecruiterOrganizationAuthorization(organization_id=o.id,user_id=a[0].id,role='organization_owner',status='draft'));audit(s,r,'organization.create','success',f'organization:{o.id}',a[0].id);s.commit();return {'id':str(o.id),'status':o.status}
VERIFICATION_ROOT=os.path.abspath(os.getenv('HHBA_VERIFICATION_ROOT','./private_verification_documents'))
def verification_owner(s,oid,user_id):
 member=active_membership(oid,user_id,s);return bool(member and member.role=='owner' and has_identity(s,user_id,'recruiter'))
def verification_view(row,docs,person=None):
 return {'organization_id':str(row.organization_id),'status':row.status,'revision':row.version,'legal_name':row.legal_name,'credit_code_masked':None if not row.credit_code else row.credit_code[:4]+'***'+row.credit_code[-4:],'registered_location':row.registered_location,'recruitment_subject_type':row.recruitment_subject_type,'review_reason_code':row.review_reason_code,'next_review_due_at':row.next_review_due_at,'representative':None if not person else {'real_name':person.real_name,'job_title':person.job_title,'relationship_type':person.relationship_type},'documents':[{'id':str(d.id),'document_type':d.document_type,'filename':d.original_filename,'size_bytes':d.size_bytes,'security_status':d.security_status,'evidence_version':d.evidence_version,'created_at':d.created_at} for d in docs]}
def verification_editable(row,person):
 if not row or not person or row.status not in {'draft','need_more_info','rejected'}:raise HTTPException(409,'verification cannot be edited in its current state')
 if row.status in {'need_more_info','rejected'}:
  row.version+=1
  row.status='draft'
  person.status='draft'
def duplicate_credit_code(s,oid,credit_code):
 return s.scalar(select(OrganizationVerification).where(OrganizationVerification.credit_code==credit_code,OrganizationVerification.organization_id!=oid,OrganizationVerification.status.in_(['draft','submitted','need_more_info','approved'])))
def evidence_integrity(s,snapshot):
 """Validate the submitted manifest against DB metadata and private bytes."""
 manifest=json.dumps(snapshot.manifest,sort_keys=True,separators=(',',':'))
 if hashlib.sha256(manifest.encode()).hexdigest()!=snapshot.manifest_sha256:return False,'manifest_hash_mismatch',[]
 records=[]
 for item in snapshot.manifest:
  try:did=UUID(item['id'])
  except (KeyError,ValueError,TypeError):return False,'manifest_identifier_invalid',[]
  doc=s.get(VerificationDocument,did);path=os.path.join(VERIFICATION_ROOT,doc.storage_key) if doc else ''
  if not doc or doc.organization_id!=snapshot.organization_id or doc.evidence_version!=snapshot.evidence_version:return False,'document_record_mismatch',[]
  if doc.sha256!=item.get('sha256') or doc.size_bytes!=item.get('size') or doc.document_type!=item.get('type'):return False,'document_metadata_mismatch',[]
  if not os.path.isfile(path):return False,'document_file_missing',[]
  with open(path,'rb') as handle:actual=hashlib.sha256(handle.read()).hexdigest()
  if actual!=doc.sha256:return False,'document_bytes_mismatch',[]
  records.append(doc)
 return True,'ok',records
@app.get('/api/v1/recruiter/organizations/{oid}/verification')
def recruiter_verification(oid:UUID,a=Depends(auth),s:Session=Depends(db)):
 if not verification_owner(s,oid,a[0].id):raise HTTPException(404,'resource not found')
 row=s.scalar(select(OrganizationVerification).where(OrganizationVerification.organization_id==oid));
 if not row:raise HTTPException(404,'resource not found')
 # Older evidence remains available to the audit trail, but the applicant
 # receives only the active revision.  This prevents stale rejected evidence
 # from appearing as if it could be submitted again.
 person=s.scalar(select(RecruiterVerification).where(RecruiterVerification.user_id==a[0].id))
 return verification_view(row,s.scalars(select(VerificationDocument).where(VerificationDocument.organization_id==oid,VerificationDocument.evidence_version==row.version)).all(),person)
@app.get('/api/v1/recruiter/onboarding')
def recruiter_onboarding(a=Depends(auth),s:Session=Depends(db)):
 if not has_identity(s,a[0].id,'recruiter'):raise HTTPException(403,'recruiter identity required')
 result=[]
 for membership in s.scalars(select(Membership).where(Membership.user_id==a[0].id,Membership.status=='active')).all():
  org_row=s.get(Organization,membership.organization_id);verification=s.scalar(select(OrganizationVerification).where(OrganizationVerification.organization_id==membership.organization_id))
  if org_row and verification:result.append({'organization_id':str(org_row.id),'legal_name':org_row.legal_name,'membership_role':membership.role,'organization_status':org_row.status,'verification_status':verification.status,'revision':verification.version})
 return {'applications':result}
@app.put('/api/v1/recruiter/organizations/{oid}/verification/company')
def save_company_verification(oid:UUID,x:CompanyVerificationIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not verification_owner(s,oid,a[0].id):raise HTTPException(404,'resource not found')
 if x.recruitment_subject_type=='agency':raise HTTPException(403,'agency verification is not open in this version')
 row=s.scalar(select(OrganizationVerification).where(OrganizationVerification.organization_id==oid).with_for_update());person=s.scalar(select(RecruiterVerification).where(RecruiterVerification.user_id==a[0].id).with_for_update());verification_editable(row,person)
 credit_code=x.credit_code.upper()
 if duplicate_credit_code(s,oid,credit_code):raise HTTPException(409,'an active verification already exists for this credit code')
 row.legal_name=x.legal_name;row.credit_code=credit_code;row.registered_location=x.registered_location;row.recruitment_subject_type=x.recruitment_subject_type;row.updated_at=now();audit(s,r,'verification.company.save','success',f'organization:{oid}',a[0].id,{'version':row.version});s.commit();return verification_view(row,[],person)
@app.put('/api/v1/recruiter/organizations/{oid}/verification/representative')
def save_representative_verification(oid:UUID,x:RepresentativeVerificationIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not verification_owner(s,oid,a[0].id):raise HTTPException(404,'resource not found')
 row=s.scalar(select(OrganizationVerification).where(OrganizationVerification.organization_id==oid).with_for_update());person=s.scalar(select(RecruiterVerification).where(RecruiterVerification.user_id==a[0].id).with_for_update());verification_editable(row,person)
 person.real_name=x.real_name;person.job_title=x.job_title;person.relationship_type=x.relationship_type;person.updated_at=now();row.updated_at=now();audit(s,r,'verification.representative.save','success',f'organization:{oid}',a[0].id,{'version':row.version,'relationship_type':x.relationship_type});s.commit();return verification_view(row,[],person)
@app.put('/api/v1/recruiter/organizations/{oid}/verification')
def save_recruiter_verification(oid:UUID,x:VerificationIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not verification_owner(s,oid,a[0].id):raise HTTPException(404,'resource not found')
 if x.recruitment_subject_type=='agency':raise HTTPException(403,'agency verification is not open in this version')
 row=s.scalar(select(OrganizationVerification).where(OrganizationVerification.organization_id==oid).with_for_update());person=s.scalar(select(RecruiterVerification).where(RecruiterVerification.user_id==a[0].id).with_for_update())
 verification_editable(row,person)
 credit_code=x.credit_code.upper()
 # A legal entity cannot have two concurrent verification applications.  Do
 # not infer ownership from the code; instead reject the duplicate and make
 # it visible to an internal reviewer through the audit trail.
 duplicate=duplicate_credit_code(s,oid,credit_code)
 if duplicate: raise HTTPException(409,'an active verification already exists for this credit code')
 row.legal_name=x.legal_name;row.credit_code=credit_code;row.registered_location=x.registered_location;row.recruitment_subject_type=x.recruitment_subject_type;row.status='draft';row.updated_at=now();person.real_name=x.real_name;person.job_title=x.job_title;person.status='draft';person.updated_at=now();audit(s,r,'verification.save','success',f'organization:{oid}',a[0].id,{'version':row.version});s.commit();return verification_view(row,[])
@app.post('/api/v1/recruiter/organizations/{oid}/verification/documents',status_code=201)
async def upload_verification_document(oid:UUID,document_type:str,r:Request,file:UploadFile=File(...),a=Depends(csrf),s:Session=Depends(db)):
 if document_type not in {'business_license','authorization_letter'}:raise HTTPException(422,'unsupported verification document type')
 if not verification_owner(s,oid,a[0].id):raise HTTPException(404,'resource not found')
 row=s.scalar(select(OrganizationVerification).where(OrganizationVerification.organization_id==oid).with_for_update())
 if not row or row.status not in {'draft','need_more_info','rejected'}:raise HTTPException(409,'verification evidence is locked; start a new review version first')
 name=os.path.basename(file.filename or '');ext=os.path.splitext(name)[1].lower();chunks=[];size=0
 while True:
  chunk=await file.read(1024*1024)
  if not chunk:break
  size+=len(chunk)
  if size>10*1024*1024:raise HTTPException(413,'verification document exceeds the 10 MB limit')
  chunks.append(chunk)
 data=b''.join(chunks);is_pdf=data.startswith(b'%PDF-');is_jpg=data.startswith(b'\xff\xd8\xff');is_png=data.startswith(b'\x89PNG\r\n\x1a\n')
 if ext not in {'.pdf','.jpg','.jpeg','.png'} or len(data)==0 or not ((ext=='.pdf' and is_pdf) or (ext in {'.jpg','.jpeg'} and is_jpg) or (ext=='.png' and is_png)):raise HTTPException(415,'unsupported or mismatched verification document')
 os.makedirs(VERIFICATION_ROOT,exist_ok=True);key=uuid4().hex+ext;open(os.path.join(VERIFICATION_ROOT,key),'wb').write(data);mime='application/pdf' if is_pdf else 'image/png' if is_png else 'image/jpeg';doc=VerificationDocument(organization_id=oid,uploader_user_id=a[0].id,evidence_version=row.version,document_type=document_type,storage_key=key,original_filename=name,mime_type=mime,size_bytes=len(data),sha256=hashlib.sha256(data).hexdigest());s.add(doc);audit(s,r,'verification.document.upload','success',f'verification_document:{doc.id}',a[0].id,{'document_type':document_type,'version':row.version});s.commit();return {'id':str(doc.id),'document_type':document_type}
@app.post('/api/v1/recruiter/organizations/{oid}/verification/submit')
def submit_verification(oid:UUID,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not verification_owner(s,oid,a[0].id):raise HTTPException(404,'resource not found')
 row=s.scalar(select(OrganizationVerification).where(OrganizationVerification.organization_id==oid).with_for_update());person=s.scalar(select(RecruiterVerification).where(RecruiterVerification.user_id==a[0].id).with_for_update())
 # A request for more information/rejection must go through save first.  Save
 # creates a new revision, so an immutable evidence version gets one snapshot.
 if not row or not person or row.status!='draft':raise HTTPException(409,'verification must be saved as a new draft before submission')
 docs=s.scalars(select(VerificationDocument).where(VerificationDocument.organization_id==oid,VerificationDocument.evidence_version==row.version)).all();kinds={d.document_type for d in docs}
 if not row.credit_code or not person.real_name or not {'business_license','authorization_letter'}.issubset(kinds):raise HTTPException(422,'business license and recruiter authorization are required')
 if s.scalar(select(VerificationEvidenceSnapshot).where(VerificationEvidenceSnapshot.organization_id==oid,VerificationEvidenceSnapshot.evidence_version==row.version)):raise HTTPException(409,'evidence version has already been submitted')
 manifest=[{'id':str(d.id),'type':d.document_type,'sha256':d.sha256,'size':d.size_bytes} for d in sorted(docs,key=lambda x:(x.document_type,str(x.id)))];serialized=json.dumps(manifest,sort_keys=True,separators=(',',':'));s.add(VerificationEvidenceSnapshot(organization_id=oid,evidence_version=row.version,manifest=manifest,manifest_sha256=hashlib.sha256(serialized.encode()).hexdigest()))
 row.status='submitted';row.submitted_at=now();row.updated_at=now();person.status='submitted';person.updated_at=now();audit(s,r,'verification.submit','success',f'organization:{oid}',a[0].id,{'version':row.version});s.commit();return {'status':'submitted','evidence_version':row.version}
@app.get('/api/v1/organizations')
def organizations(a=Depends(auth),s:Session=Depends(db)):
 rows=s.scalars(select(Membership).where(Membership.user_id==a[0].id,Membership.status=='active')).all();result=[]
 for m in rows:
  o=s.get(Organization,m.organization_id)
  if o:result.append({'id':str(o.id),'legal_name':o.legal_name,'status':o.status,'membership_role':m.role})
 return {'organizations':result}
@app.get('/api/v1/organizations/{oid}/members')
def members(oid:UUID,a=Depends(auth),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'manage_drafts'):raise HTTPException(404,'resource not found')
 return {'members':[{'user_id':str(m.user_id),'role':m.role,'status':m.status} for m in s.scalars(select(Membership).where(Membership.organization_id==oid))]}
@app.get('/api/v1/organizations/{oid}/recruiter-invitations')
def organization_invitations(oid:UUID,a=Depends(auth),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'manage_members'):raise HTTPException(404,'resource not found')
 return {'items':[{'id':str(item.id),'invitee_user_id':str(item.invitee_user_id),'proposed_role':item.proposed_role,'status':'expired' if item.status=='pending' and comparable_time(item.expires_at)<=now() else item.status,'expires_at':item.expires_at,'created_at':item.created_at} for item in s.scalars(select(RecruiterInvitation).where(RecruiterInvitation.organization_id==oid).order_by(RecruiterInvitation.created_at.desc()))]}
@app.post('/api/v1/organizations/{oid}/recruiter-invitations',status_code=201)
def create_recruiter_invitation(oid:UUID,x:InvitationIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'manage_members'):raise HTTPException(404,'resource not found')
 if x.invitee_user_id==a[0].id:raise HTTPException(422,'cannot invite yourself')
 if not s.get(User,x.invitee_user_id) or not has_identity(s,x.invitee_user_id,'recruiter'):raise HTTPException(422,'invitee must have an active recruiter identity')
 if s.scalar(select(Membership).where(Membership.organization_id==oid,Membership.user_id==x.invitee_user_id,Membership.status=='active')):raise HTTPException(409,'invitee is already an active member')
 existing=s.scalar(select(RecruiterInvitation).where(RecruiterInvitation.organization_id==oid,RecruiterInvitation.invitee_user_id==x.invitee_user_id,RecruiterInvitation.status=='pending',RecruiterInvitation.expires_at>now()))
 if existing:raise HTTPException(409,'an active invitation already exists')
 invitation=RecruiterInvitation(organization_id=oid,invitee_user_id=x.invitee_user_id,created_by_user_id=a[0].id,proposed_role=x.proposed_role,expires_at=now()+timedelta(days=x.expires_in_days));s.add(invitation);audit(s,r,'organization.invitation.create','success',f'invitation:{invitation.id}',a[0].id,{'organization_id':str(oid),'proposed_role':x.proposed_role});s.commit();return {'id':str(invitation.id),'status':invitation.status,'expires_at':invitation.expires_at}
@app.get('/api/v1/recruiter-invitations')
def my_recruiter_invitations(a=Depends(auth),s:Session=Depends(db)):
 if not has_identity(s,a[0].id,'recruiter'):raise HTTPException(403,'recruiter identity required')
 result=[]
 for item in s.scalars(select(RecruiterInvitation).where(RecruiterInvitation.invitee_user_id==a[0].id).order_by(RecruiterInvitation.created_at.desc())):
  org_row=s.get(Organization,item.organization_id)
  result.append({'id':str(item.id),'organization_id':str(item.organization_id),'organization_name':org_row.legal_name if org_row else None,'proposed_role':item.proposed_role,'status':'expired' if item.status=='pending' and comparable_time(item.expires_at)<=now() else item.status,'expires_at':item.expires_at})
 return {'items':result}
@app.post('/api/v1/recruiter-invitations/{iid}/accept')
def accept_recruiter_invitation(iid:UUID,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not has_identity(s,a[0].id,'recruiter'):raise HTTPException(403,'recruiter identity required')
 invitation=s.scalar(select(RecruiterInvitation).where(RecruiterInvitation.id==iid).with_for_update())
 if not invitation or invitation.invitee_user_id!=a[0].id:raise HTTPException(404,'resource not found')
 if invitation.status!='pending':raise HTTPException(409,'invitation is no longer available')
 if comparable_time(invitation.expires_at)<=now():invitation.status='expired';s.commit();raise HTTPException(409,'invitation has expired')
 if s.scalar(select(Membership).where(Membership.organization_id==invitation.organization_id,Membership.user_id==a[0].id,Membership.status=='active')):raise HTTPException(409,'already an active member')
 membership_role='member' if invitation.proposed_role=='member' else 'admin';s.add(Membership(organization_id=invitation.organization_id,user_id=a[0].id,role=membership_role));s.add(RecruiterOrganizationAuthorization(organization_id=invitation.organization_id,user_id=a[0].id,role='recruiter' if membership_role=='member' else 'recruitment_admin',status='draft'));invitation.status='accepted';invitation.accepted_at=now();audit(s,r,'organization.invitation.accept','success',f'invitation:{iid}',a[0].id,{'organization_id':str(invitation.organization_id)});s.commit();return {'status':'accepted','organization_id':str(invitation.organization_id),'authorization_status':'draft'}
@app.delete('/api/v1/organizations/{oid}/recruiter-invitations/{iid}')
def revoke_recruiter_invitation(oid:UUID,iid:UUID,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'manage_members'):raise HTTPException(404,'resource not found')
 invitation=s.scalar(select(RecruiterInvitation).where(RecruiterInvitation.id==iid,RecruiterInvitation.organization_id==oid).with_for_update())
 if not invitation:raise HTTPException(404,'resource not found')
 if invitation.status!='pending':raise HTTPException(409,'only a pending invitation can be revoked')
 invitation.status='revoked';invitation.revoked_at=now();audit(s,r,'organization.invitation.revoke','success',f'invitation:{iid}',a[0].id);s.commit();return {'status':'revoked'}
@app.post('/api/v1/organizations/{oid}/members',status_code=201)
def addmember(oid:UUID,x:MemberIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'manage_members'):raise HTTPException(404,'resource not found')
 if not s.get(User,x.user_id) or not has_identity(s,x.user_id,'recruiter'):raise HTTPException(422,'active recruiter identity required')
 if s.scalar(select(Membership).where(Membership.organization_id==oid,Membership.user_id==x.user_id)):raise HTTPException(409,'membership already exists')
 s.add(Membership(organization_id=oid,user_id=x.user_id,role=x.role));s.add(RecruiterOrganizationAuthorization(organization_id=oid,user_id=x.user_id,role='recruiter' if x.role=='member' else 'recruitment_admin',status='draft'));audit(s,r,'organization.member.add','success',f'organization:{oid}',a[0].id);s.commit();return {'ok':True}
@app.delete('/api/v1/organizations/{oid}/members/{uid}')
def removemember(oid:UUID,uid:UUID,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'manage_members'):raise HTTPException(404,'resource not found')
 target=s.scalar(select(Membership).where(Membership.organization_id==oid,Membership.user_id==uid))
 if not target:raise HTTPException(404,'resource not found')
 target.status='removed';authorization=s.scalar(select(RecruiterOrganizationAuthorization).where(RecruiterOrganizationAuthorization.organization_id==oid,RecruiterOrganizationAuthorization.user_id==uid));
 if authorization: authorization.status='revoked';authorization.revoked_at=now();authorization.updated_at=now()
 audit(s,r,'organization.member.remove','success',f'organization:{oid}',a[0].id);s.commit();return {'ok':True}
@app.patch('/api/v1/organizations/{oid}/members/{uid}')
def changemember(oid:UUID,uid:UUID,x:MemberIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'manage_members'):raise HTTPException(404,'resource not found')
 target=s.scalar(select(Membership).where(Membership.organization_id==oid,Membership.user_id==uid,Membership.status=='active'))
 if not target:raise HTTPException(404,'resource not found')
 target.role=x.role;authorization=s.scalar(select(RecruiterOrganizationAuthorization).where(RecruiterOrganizationAuthorization.organization_id==oid,RecruiterOrganizationAuthorization.user_id==uid))
 if authorization: authorization.role='recruiter' if x.role=='member' else 'recruitment_admin';authorization.updated_at=now()
 audit(s,r,'organization.member.role_change','success',f'organization:{oid}',a[0].id);s.commit();return {'ok':True}
@app.post('/api/v1/admin/organizations/{oid}/review')
def review(oid:UUID,x:ReviewIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if a[0].role!='admin':raise HTTPException(403,'administrator role required')
 o=s.get(Organization,oid)
 if not o:raise HTTPException(404,'resource not found')
 # Legacy endpoint cannot bypass the verification workflow.  It remains only
 # for an emergency suspension of an already-existing organization.
 if x.status!='suspended': raise HTTPException(409,'use verification review workflow')
 o.status='suspended';o.reviewed_by=a[0].id;o.reviewed_at=now();audit(s,r,'organization.review.suspend','success',f'organization:{oid}',a[0].id,{'status':x.status});s.commit();return {'status':o.status}
@app.get('/api/v1/admin/verification/organizations')
def verification_review_queue(status:str='submitted',a=Depends(auth),s:Session=Depends(db)):
 if a[0].role!='admin':raise HTTPException(403,'administrator role required')
 rows=s.scalars(select(OrganizationVerification).where(OrganizationVerification.status==status).order_by(OrganizationVerification.submitted_at.asc())).all()
 items=[]
 for row in rows:
  org_row=s.get(Organization,row.organization_id);person=s.scalar(select(RecruiterVerification).where(RecruiterVerification.user_id==row.applicant_user_id));snapshot=s.scalar(select(VerificationEvidenceSnapshot).where(VerificationEvidenceSnapshot.organization_id==row.organization_id,VerificationEvidenceSnapshot.evidence_version==row.version))
  items.append({'organization_id':str(row.organization_id),'legal_name':row.legal_name,'status':row.status,'revision':row.version,'submitted_at':row.submitted_at,'representative_name':person.real_name if person else None,'evidence_snapshot_id':str(snapshot.id) if snapshot else None})
 return {'items':items}
@app.get('/api/v1/admin/verification/organizations/{oid}')
def verification_review_detail(oid:UUID,a=Depends(auth),s:Session=Depends(db)):
 if a[0].role!='admin':raise HTTPException(403,'administrator role required')
 row=s.scalar(select(OrganizationVerification).where(OrganizationVerification.organization_id==oid))
 if not row:raise HTTPException(404,'resource not found')
 person=s.scalar(select(RecruiterVerification).where(RecruiterVerification.user_id==row.applicant_user_id));docs=s.scalars(select(VerificationDocument).where(VerificationDocument.organization_id==oid,VerificationDocument.evidence_version==row.version)).all();snapshot=s.scalar(select(VerificationEvidenceSnapshot).where(VerificationEvidenceSnapshot.organization_id==oid,VerificationEvidenceSnapshot.evidence_version==row.version));reviews=s.scalars(select(VerificationReview).where(VerificationReview.organization_id==oid).order_by(VerificationReview.created_at.desc())).all()
 return {'verification':verification_view(row,docs,person),'evidence_snapshot':None if not snapshot else {'id':str(snapshot.id),'evidence_version':snapshot.evidence_version,'manifest_sha256':snapshot.manifest_sha256,'submitted_at':snapshot.submitted_at},'reviews':[{'outcome':review.outcome,'reason_code':review.reason_code,'evidence_version':review.evidence_version,'created_at':review.created_at} for review in reviews]}
@app.put('/api/v1/admin/verification/documents/{did}/security-assessment')
def record_document_security(did:UUID,x:DocumentSecurityIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if a[0].role!='admin':raise HTTPException(403,'administrator role required')
 doc=s.scalar(select(VerificationDocument).where(VerificationDocument.id==did).with_for_update())
 if not doc:raise HTTPException(404,'resource not found')
 row=s.scalar(select(OrganizationVerification).where(OrganizationVerification.organization_id==doc.organization_id))
 if not row or row.status!='submitted' or doc.evidence_version!=row.version:raise HTTPException(409,'only current submitted evidence can be assessed')
 doc.security_status=x.status;doc.security_checked_at=now();doc.security_checked_by=a[0].id;audit(s,r,'verification.document.security_assessment','success',f'verification_document:{did}',a[0].id,{'status':x.status,'reason_code':x.reason_code});s.commit();return {'id':str(did),'security_status':doc.security_status}
@app.post('/api/v1/admin/verification/organizations/{oid}/review')
def review_verification(oid:UUID,x:VerificationReviewIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if a[0].role!='admin':raise HTTPException(403,'administrator role required')
 row=s.scalar(select(OrganizationVerification).where(OrganizationVerification.organization_id==oid).with_for_update());org_row=s.scalar(select(Organization).where(Organization.id==oid).with_for_update())
 if not row or not org_row:raise HTTPException(404,'resource not found')
 if row.applicant_user_id==a[0].id:raise HTTPException(403,'reviewer cannot approve own application')
 if row.status!='submitted':raise HTTPException(409,'only the current submitted evidence version can be reviewed')
 recruiter=s.scalar(select(RecruiterVerification).where(RecruiterVerification.user_id==row.applicant_user_id).with_for_update());authorization=s.scalar(select(RecruiterOrganizationAuthorization).where(RecruiterOrganizationAuthorization.organization_id==oid,RecruiterOrganizationAuthorization.user_id==row.applicant_user_id).with_for_update());snapshot=s.scalar(select(VerificationEvidenceSnapshot).where(VerificationEvidenceSnapshot.organization_id==oid,VerificationEvidenceSnapshot.evidence_version==row.version))
 if not recruiter or not authorization or not snapshot:raise HTTPException(409,'fixed evidence snapshot and verification linkage are required')
 if row.version!=x.expected_revision or snapshot.id!=x.evidence_snapshot_id:raise HTTPException(409,'verification evidence changed; refresh before reviewing')
 intact,integrity_reason,documents=evidence_integrity(s,snapshot)
 if not intact:raise HTTPException(409,f'evidence integrity check failed: {integrity_reason}')
 if x.status=='approved' and (any(doc.security_status!='clean' for doc in documents) or {x.entity_verification,x.representative_verification,x.authorization_verification}!={'manual_verified'}):raise HTTPException(422,'approval requires clean files and independent verification conclusions')
 outcome=x.status;at=now();row.status=outcome;row.reviewed_at=at;row.reviewed_by=a[0].id;row.review_reason_code=x.reason_code;row.updated_at=at
 recruiter.status=outcome;recruiter.reviewed_at=at;recruiter.reviewed_by=a[0].id;recruiter.review_reason_code=x.reason_code;recruiter.updated_at=at
 if outcome=='approved':
  due=at+timedelta(days=x.valid_days);row.verified_at=at;row.next_review_due_at=due;recruiter.verified_at=at;recruiter.next_review_due_at=due;authorization.status='active';authorization.granted_at=at;org_row.status='approved';org_row.reviewed_at=at;org_row.reviewed_by=a[0].id
 elif outcome=='suspended': org_row.status='suspended';row.suspended_at=at;authorization.status='revoked';authorization.revoked_at=at
 else: authorization.status='draft';org_row.status='pending_review'
 s.add(VerificationReview(organization_id=oid,reviewer_user_id=a[0].id,evidence_version=row.version,evidence_snapshot_id=snapshot.id,evidence_manifest_sha256=snapshot.manifest_sha256,entity_verification=x.entity_verification,representative_verification=x.representative_verification,authorization_verification=x.authorization_verification,outcome=outcome,reason_code=x.reason_code));audit(s,r,'verification.review','success',f'organization:{oid}',a[0].id,{'outcome':outcome,'reason_code':x.reason_code,'version':row.version});s.commit();return {'status':outcome,'organization_status':org_row.status}
@app.put('/api/v1/admin/platform-service-gates/network-recruitment')
def set_network_recruitment_gate(x:GateIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if a[0].role!='admin':raise HTTPException(403,'administrator role required')
 gate=s.get(PlatformServiceGate,'network_recruitment') or PlatformServiceGate(gate_key='network_recruitment')
 gate.enabled=x.enabled;gate.reason_code=x.reason_code;gate.reviewed_at=now();gate.reviewed_by=a[0].id;s.add(gate);audit(s,r,'platform_service_gate.update','success','network_recruitment',a[0].id,{'enabled':x.enabled,'reason_code':x.reason_code});s.commit();return {'gate_key':gate.gate_key,'enabled':gate.enabled}
@app.get('/api/v1/admin/verification/documents/{did}')
def read_verification_document(did:UUID,a=Depends(auth),s:Session=Depends(db)):
 if a[0].role!='admin':raise HTTPException(403,'administrator role required')
 doc=s.get(VerificationDocument,did)
 if not doc:raise HTTPException(404,'resource not found')
 path=os.path.join(VERIFICATION_ROOT,doc.storage_key)
 if not os.path.isfile(path):raise HTTPException(404,'verification document is unavailable')
 return FileResponse(path,media_type=doc.mime_type,filename=doc.original_filename,headers={'Cache-Control':'no-store'})
@app.get('/api/v1/organizations/{oid}/restricted-access')
def restricted(oid:UUID,r:Request,a=Depends(auth),s:Session=Depends(db)):
 if not recruitment_allowed(s,oid,a[0].id):audit(s,r,'organization.restricted_access','denied',f'organization:{oid}',a[0].id);s.commit();raise HTTPException(403,'recruitment verification or platform gate is not active')
 audit(s,r,'organization.restricted_access','success',f'organization:{oid}',a[0].id);s.commit();return {'restricted_access':True}
def active_membership(oid:UUID,user_id:UUID,s:Session):
 return s.scalar(select(Membership).where(Membership.organization_id==oid,Membership.user_id==user_id,Membership.status=='active'))
SEARCHABLE_PROFILE_STATUSES=('confirmed','published')
SYNONYM_GROUPS=(('经销商运营','汽车门店运营'),('销售培训','销售人员培训'),('新能源车销售','新能源汽车销售'))
def normalized(value): return str(value or '').strip().casefold()
SENSITIVE_TEXT=re.compile(r'(?ix)(?:\b[\w.+-]+\s*@\s*[\w-]+\s*(?:\.\s*[\w-]+)+\b|(?<!\d)1\s*[3-9](?:\s*\d){9}(?!\d)|\b\d{15,18}[0-9xX]\b|(?:微信|wechat|vx)\s*(?:号|id)?\s*[:：]?\s*[\w-]{5,}|(?:电话|手机号|邮箱|email)\s*[:：]?\s*[^\s，。；;]{3,})')
# A city/province is useful for matching.  A street number, unit, or a city
# followed by a street-level address is not part of HHBA's enterprise/public
# disclosure allow-list.  This is a reject rule, not a promise of exhaustive
# PII detection; owners must still review the server-generated preview.
PRIVATE_ADDRESS_MARKERS=re.compile(r'(?:[\u4e00-\u9fffA-Za-z0-9]{1,24}(?:路|街|巷|弄)\s*(?:\d+|[一二三四五六七八九十]+号?)|(?:\d+|[一二三四五六七八九十]+)\s*(?:号|室|栋|单元|门牌)|(?:省|市|区|县).{0,32}(?:路|街|巷|弄|号|室|栋|单元|门牌))')
def safe_projection_text(value,limit):
 """Return an allow-listed disclosure value or reject the complete field.

 Contact/address fragments are not redacted in-place: retaining surrounding
 free text is too easy to get wrong.  This deliberately conservative guard is
 shared by enterprise projections and public-card fields.
 """
 value=str(value or '').strip()
 if not value or SENSITIVE_TEXT.search(value) or PRIVATE_ADDRESS_MARKERS.search(value):return ''
 return value[:limit]
def safe_region(value):
 value=safe_projection_text(value,80)
 # A city/province is useful for matching; a detailed address is not an allowed
 # enterprise-search field. Reject it rather than trying to redact fragments.
 return None if not value or PRIVATE_ADDRESS_MARKERS.search(value) else value
def string_list(value):
 if isinstance(value,list): values=value
 elif value: values=[value]
 else: values=[]
 return [item for item in (safe_projection_text(normalized(x),80) for x in values if normalized(x)) if item]
def delimited(values): return ''.join(f'|{x}|' for x in dict.fromkeys(string_list(values)))
def expand_synonym(value):
 value=normalized(value)
 for group in SYNONYM_GROUPS:
  if value in group:return tuple(group)
 return (value,)
def granted_enterprise_search(s,user_id):
 return bool(s.scalar(select(Consent).where(Consent.user_id==user_id,Consent.consent_type=='enterprise_search',Consent.granted.is_(True))))
def remove_projection(s,profile_id):
 s.query(CandidateSearchProjection).filter_by(profile_id=profile_id).delete()
def projection_values(s,p):
 """Build the enterprise-search allow-list from confirmed profile fields only.

 This intentionally excludes parsed evidence, source files, contact attributes and
 arbitrary top-level JSON keys.  The same function powers persistence and the
 owner-only preview so the UI cannot drift from search disclosure rules.
 """
 content=p.content_json or {}
 skills=string_list(content.get('skills'))
 industries=string_list(content.get('industries') or content.get('industry'))
 regions=[x for x in string_list(content.get('service_regions') or content.get('regions')) if safe_region(x)]
 location=safe_region(content.get('location') or content.get('region'))
 if location: regions=list(dict.fromkeys(regions+[location]))
 work_modes=string_list(content.get('work_modes') or content.get('work_mode'))
 work_years=content.get('work_years')
 try: work_years=int(work_years) if work_years is not None else None
 except (TypeError,ValueError): work_years=None
 if work_years is not None and not 0<=work_years<=80: work_years=None
 projects=[]
 for project in s.scalars(select(Project).where(Project.profile_id==p.id,Project.visibility.in_(('enterprise','public')))):
  summary=safe_projection_text(project.summary,500)
  if summary: projects.append(summary)
 for intent in s.scalars(select(ServiceIntent).where(ServiceIntent.profile_id==p.id,ServiceIntent.visibility.in_(('enterprise','public')))):
  region=safe_region(intent.region)
  mode=safe_projection_text(intent.work_mode,80)
  if region: regions=list(dict.fromkeys(regions+[region]))
  if mode: work_modes=list(dict.fromkeys(work_modes+[mode]))
 summary=safe_projection_text(content.get('capability_summary') or content.get('headline'),2000)
 return {'display_name':safe_projection_text(p.display_name,100) or None,'headline':safe_projection_text(content.get('headline') or content.get('title'),300) or None,'capability_summary':summary or None,'skills':skills,'industries':industries,'location':location,'service_regions':regions,'work_modes':work_modes,'work_years':work_years,'project_summaries':projects}
def sync_search_projection(s,p):
 """Copy only confirmed, enterprise-authorized fields; never resumes/evidence/contact data."""
 if p.status not in SEARCHABLE_PROFILE_STATUSES or not granted_enterprise_search(s,p.owner_user_id):
  remove_projection(s,p.id); return None
 values=projection_values(s,p)
 version=s.scalar(select(func.count(ProfileVersion.id)).where(ProfileVersion.profile_id==p.id)) or 0
 search_text=' '.join([values['capability_summary'] or '',*values['skills'],*values['industries'],*values['service_regions'],*values['work_modes'],*values['project_summaries']])[:12000]
 row=s.scalar(select(CandidateSearchProjection).where(CandidateSearchProjection.profile_id==p.id)) or CandidateSearchProjection(profile_id=p.id,owner_user_id=p.owner_user_id)
 row.display_name=values['display_name'];row.headline=values['headline'];row.capability_summary=values['capability_summary'];row.skills=values['skills'];row.industries=values['industries'];row.location=values['location'];row.service_regions=values['service_regions'];row.work_modes=values['work_modes'];row.work_years=values['work_years'];row.project_summaries=values['project_summaries'];row.skills_text=delimited(values['skills']);row.industries_text=delimited(values['industries']);row.regions_text=delimited(values['service_regions']);row.work_modes_text=delimited(values['work_modes']);row.search_text=search_text;row.profile_version=version;row.indexed_at=now();s.add(row);return row
def consume_search_quota(s,oid,user_id):
 # Lock the organization first: every member search takes the same lock,
 # serializing member and organization daily counters without an in-memory race.
 s.scalar(select(Organization).where(Organization.id==oid).with_for_update())
 today=now().date();usage=s.scalar(select(TalentSearchUsage).where(TalentSearchUsage.organization_id==oid,TalentSearchUsage.user_id==user_id,TalentSearchUsage.usage_date==today).with_for_update())
 org_count=s.scalar(select(func.coalesce(func.sum(TalentSearchUsage.request_count),0)).where(TalentSearchUsage.organization_id==oid,TalentSearchUsage.usage_date==today)) or 0
 if (usage and usage.request_count>=30) or org_count>=100:return False
 if not usage:usage=TalentSearchUsage(organization_id=oid,user_id=user_id,usage_date=today,request_count=0);s.add(usage)
 usage.request_count+=1;usage.updated_at=now();return True
def requirement_view(x:HiringRequirement):
 return {'id':str(x.id),'organization_id':str(x.organization_id),'created_by':str(x.created_by),'title':x.title,'description':x.description,'location':x.location,'work_mode':x.work_mode,'status':x.status,'created_at':x.created_at,'updated_at':x.updated_at}
@app.post('/api/v1/organizations/{oid}/hiring-requirements',status_code=201)
def create_requirement(oid:UUID,x:RequirementIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'manage_drafts'):raise HTTPException(404,'resource not found')
 requirement=HiringRequirement(organization_id=oid,created_by=a[0].id,**x.model_dump());s.add(requirement);s.flush();audit(s,r,'hiring_requirement.create','success',f'hiring_requirement:{requirement.id}',a[0].id,{'organization_id':str(oid),'status':x.status});s.commit();return requirement_view(requirement)
@app.get('/api/v1/organizations/{oid}/hiring-requirements')
def list_requirements(oid:UUID,a=Depends(auth),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'manage_drafts'):raise HTTPException(404,'resource not found')
 return {'items':[requirement_view(x) for x in s.scalars(select(HiringRequirement).where(HiringRequirement.organization_id==oid).order_by(HiringRequirement.updated_at.desc()))]}
@app.get('/api/v1/organizations/{oid}/hiring-requirements/{rid}')
def get_requirement(oid:UUID,rid:UUID,a=Depends(auth),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'manage_drafts'):raise HTTPException(404,'resource not found')
 x=s.get(HiringRequirement,rid)
 if not x or x.organization_id!=oid:raise HTTPException(404,'resource not found')
 return requirement_view(x)
@app.patch('/api/v1/organizations/{oid}/hiring-requirements/{rid}')
def patch_requirement(oid:UUID,rid:UUID,x:RequirementPatch,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 member=active_membership(oid,a[0].id,s)
 if not require_recruitment_permission(s,oid,a[0].id,'manage_drafts'):raise HTTPException(404,'resource not found')
 requirement=s.get(HiringRequirement,rid)
 if not requirement or requirement.organization_id!=oid:raise HTTPException(404,'resource not found')
 if member.role!='owner' and requirement.created_by!=a[0].id:raise HTTPException(404,'resource not found')
 for key,value in x.model_dump(exclude_unset=True).items():setattr(requirement,key,value)
 requirement.updated_at=now();audit(s,r,'hiring_requirement.update','success',f'hiring_requirement:{rid}',a[0].id,{'organization_id':str(oid)});s.commit();return requirement_view(requirement)
@app.put('/api/v1/me/consents/{typ}')
def consent(typ:str,x:ConsentIn,r:Request,a=Depends(candidate_csrf),s:Session=Depends(db)):
 if typ not in {'enterprise_search','public_share','search_engine_index'}:raise HTTPException(404,'resource not found')
 if s.bind.dialect.name=='postgresql':
  c=s.execute(pg_insert(Consent).values(user_id=a[0].id,consent_type=typ,granted=x.granted,changed_at=now()).on_conflict_do_update(index_elements=['user_id','consent_type'],set_={'granted':x.granted,'changed_at':now()}).returning(Consent)).scalar_one()
 else:
  c=s.scalar(select(Consent).where(Consent.user_id==a[0].id,Consent.consent_type==typ)) or Consent(user_id=a[0].id,consent_type=typ);c.granted=x.granted;c.changed_at=now();s.add(c)
 if typ=='public_share' and not x.granted:
  p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
  if p:p.status='confirmed';p.public_slug=None;p.published_at=None
 if typ=='enterprise_search':
  p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
  if p: sync_search_projection(s,p)
 audit(s,r,'consent.change','success',f'consent:{typ}',a[0].id,{'granted':x.granted});s.commit();return {'consent_type':typ,'granted':x.granted}
@app.get('/api/v1/me/consents')
def my_consents(a=Depends(candidate_auth),s:Session=Depends(db)):
 rows=s.scalars(select(Consent).where(Consent.user_id==a[0].id)).all()
 values={row.consent_type:row.granted for row in rows}
 return {'enterprise_search':values.get('enterprise_search',False),'public_share':values.get('public_share',False),'search_engine_index':values.get('search_engine_index',False)}
@app.get('/api/v1/admin/audit-events')
def events(a=Depends(auth),s:Session=Depends(db)):
 if a[0].role!='admin':raise HTTPException(403,'administrator role required')
 return {'events':[{'action':e.action,'outcome':e.outcome,'resource':e.resource} for e in s.scalars(select(Audit))]}
UPLOAD_ROOT=os.path.abspath(os.getenv('HHBA_UPLOAD_ROOT','./private_uploads'))
MAX_PARSE_ATTEMPTS=int(os.getenv('HHBA_PARSE_MAX_ATTEMPTS','3'))
@app.post('/api/v1/me/resumes',status_code=201)
async def upload_resume(r:Request,file:UploadFile=File(...),a=Depends(candidate_csrf),s:Session=Depends(db)):
 name=os.path.basename(file.filename or ''); ext=os.path.splitext(name)[1].lower(); data=await file.read()
 if ext not in {'.pdf','.docx'} or len(data)==0 or len(data)>10*1024*1024: raise HTTPException(422,'unsupported or oversized document')
 if (ext=='.pdf' and not data.startswith(b'%PDF-')) or (ext=='.docx' and not data.startswith(b'PK')): raise HTTPException(422,'file signature does not match extension')
 os.makedirs(UPLOAD_ROOT,exist_ok=True); key=uuid4().hex+ext; path=os.path.join(UPLOAD_ROOT,key); open(path,'wb').write(data)
 resume=Resume(owner_user_id=a[0].id,storage_key=key,original_filename=name,mime_type='application/pdf' if ext=='.pdf' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size_bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),status='uploaded');s.add(resume);s.flush();job=ParseJob(resume_id=resume.id,state='uploaded');s.add(job);audit(s,r,'resume.upload','success',f'resume:{resume.id}',a[0].id);s.commit();return {'resume_id':str(resume.id),'job_id':str(job.id),'state':'uploaded'}
@app.get('/api/v1/me/resumes')
def list_resumes(a=Depends(candidate_auth),s:Session=Depends(db)):
 rows=s.scalars(select(Resume).where(Resume.owner_user_id==a[0].id).order_by(Resume.created_at.desc())).all()
 items=[]
 for x in rows:
  j=s.scalar(select(ParseJob).where(ParseJob.resume_id==x.id))
  items.append({'resume_id':str(x.id),'filename':x.original_filename,'status':x.status,'job_id':str(j.id) if j else None,'job_state':j.state if j else None,'created_at':x.created_at})
 return {'items':items}
@app.get('/api/v1/me/resumes/{rid}')
def resume_status(rid:UUID,a=Depends(candidate_auth),s:Session=Depends(db)):
 x=s.get(Resume,rid)
 if not x or x.owner_user_id!=a[0].id:raise HTTPException(404,'resource not found')
 j=s.scalar(select(ParseJob).where(ParseJob.resume_id==rid));return {'resume_id':str(x.id),'filename':x.original_filename,'status':x.status,'job_id':str(j.id) if j else None,'job_state':j.state if j else None,'attempt_count':j.attempt_count if j else 0,'error':j.error_safe_message if j else None,'result':j.result_json if j and j.state=='parsed' else None}
@app.get('/api/v1/me/resumes/{rid}/download')
def download_resume(rid:UUID,a=Depends(candidate_auth),s:Session=Depends(db)):
 x=s.get(Resume,rid)
 if not x or x.owner_user_id!=a[0].id:raise HTTPException(404,'resource not found')
 path=os.path.join(UPLOAD_ROOT,x.storage_key)
 if not os.path.isfile(path):raise HTTPException(404,'resource not found')
 return FileResponse(path,media_type=x.mime_type,filename=x.original_filename,headers={'Cache-Control':'no-store'})
@app.post('/api/v1/me/resumes/{rid}/parse')
def parse_resume(rid:UUID,r:Request,a=Depends(candidate_csrf),s:Session=Depends(db)):
 x=s.get(Resume,rid)
 if not x or x.owner_user_id!=a[0].id:raise HTTPException(404,'resource not found')
 j=s.scalar(select(ParseJob).where(ParseJob.resume_id==rid))
 if not j or j.state not in {'uploaded','failed'}:raise HTTPException(409,'parsing task is not ready')
 if j.attempt_count>=MAX_PARSE_ATTEMPTS:raise HTTPException(409,'maximum parsing attempts reached')
 j.state='queued';j.error_code=None;j.error_safe_message=None;j.cancel_requested=False;j.updated_at=now();x.status='queued';audit(s,r,'resume.parse.queued','success',f'resume:{rid}',a[0].id);s.commit();return {'job_id':str(j.id),'state':j.state,'attempt_count':j.attempt_count}
@app.post('/api/v1/me/resumes/{rid}/retry-parse')
def retry_parse(rid:UUID,r:Request,a=Depends(candidate_csrf),s:Session=Depends(db)):
 x=s.get(Resume,rid)
 if not x or x.owner_user_id!=a[0].id:raise HTTPException(404,'resource not found')
 old=s.scalar(select(ParseJob).where(ParseJob.resume_id==rid))
 if old and old.state not in {'failed','uploaded'}:raise HTTPException(409,'parsing task is not retryable')
 if old and old.attempt_count>=MAX_PARSE_ATTEMPTS:raise HTTPException(409,'maximum parsing attempts reached')
 if old:old.state='queued';old.error_code=None;old.error_safe_message=None;old.result_json=None;old.cancel_requested=False;old.updated_at=now();x.status='queued'
 audit(s,r,'resume.parse.retry','success',f'resume:{rid}',a[0].id);s.commit();return {'resume_id':str(rid),'state':'uploaded'}
@app.post('/api/v1/me/parsing-jobs/{jid}/apply-draft')
def apply_parse_draft(jid:UUID,r:Request,a=Depends(candidate_csrf),s:Session=Depends(db)):
 j=s.get(ParseJob,jid)
 resume=s.get(Resume,j.resume_id) if j else None
 if not j or not resume or resume.owner_user_id!=a[0].id or j.state!='parsed':raise HTTPException(404,'resource not found')
 result=j.result_json or {};content={'headline':'待用户确认','skills':[x.get('value') for x in result.get('skills',[]) if x.get('value')],'experiences':result.get('experiences',[]),'education':result.get('education',[]),'projects':[],'services':[],'source_evidence':result.get('raw_text_excerpt','')[:4000]}
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id)) or Profile(owner_user_id=a[0].id);p.content_json=content;p.display_name=None;p.status='draft';p.updated_at=now();s.add(p);s.flush();remove_projection(s,p.id);audit(s,r,'profile.apply_parse_draft','success',f'parse_job:{jid}',a[0].id);s.commit();return {'status':'draft','profile':content}
@app.delete('/api/v1/me/resumes/{rid}')
def delete_resume(rid:UUID,r:Request,a=Depends(candidate_csrf),s:Session=Depends(db)):
 x=s.get(Resume,rid)
 if not x or x.owner_user_id!=a[0].id:raise HTTPException(404,'resource not found')
 p=os.path.join(UPLOAD_ROOT,x.storage_key)
 job=s.scalar(select(ParseJob).where(ParseJob.resume_id==rid))
 if job and job.state in {'queued','processing'}:job.cancel_requested=True;job.state='cancelled';job.finished_at=now()
 if os.path.isfile(p):os.remove(p)
 s.delete(x);audit(s,r,'resume.delete','success',f'resume:{rid}',a[0].id);s.commit();return {'deleted':True}
class ProfileIn(BaseModel): content:dict; display_name:str|None=None
class DetailIn(BaseModel): items:list[dict]
@app.get('/api/v1/me/profile')
def my_profile(a=Depends(candidate_auth),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id));return {'profile':None if not p else {'id':str(p.id),'status':p.status,'display_name':p.display_name,'content':p.content_json,'public_slug':p.public_slug}}
@app.get('/api/v1/me/profile/enterprise-preview')
def enterprise_profile_preview(a=Depends(candidate_auth),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 if not p:return {'eligible':False,'fields':None}
 # This route is owner-only and deliberately does not create a projection before
 # the owner grants consent.  It returns exactly the same allow-listed transform.
 values=projection_values(s,p)
 return {'eligible':p.status in SEARCHABLE_PROFILE_STATUSES,'fields':values}
@app.put('/api/v1/me/profile')
def save_profile(x:ProfileIn,r:Request,a=Depends(candidate_csrf),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id)) or Profile(owner_user_id=a[0].id);p.content_json=x.content;p.display_name=x.display_name;p.status='draft';s.add(p);s.flush();remove_projection(s,p.id);audit(s,r,'profile.save','success','profile',a[0].id);s.commit();return {'status':'draft'}
DETAILS={'experiences':Experience,'educations':Education,'projects':Project,'service-intents':ServiceIntent}
@app.get('/api/v1/me/profile/{kind}')
def list_details(kind:str,a=Depends(candidate_auth),s:Session=Depends(db)):
 model=DETAILS.get(kind);p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 if not model or not p: return {'items':[]}
 return {'items':[{k:v for k,v in row.__dict__.items() if not k.startswith('_')} for row in s.scalars(select(model).where(model.profile_id==p.id))]}
@app.put('/api/v1/me/profile/{kind}')
def replace_details(kind:str,x:DetailIn,r:Request,a=Depends(candidate_csrf),s:Session=Depends(db)):
 model=DETAILS.get(kind);p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 if not model or not p:raise HTTPException(404,'profile not found')
 s.query(model).filter_by(profile_id=p.id).delete()
 allowed=set(model.__table__.columns.keys())-{'id','profile_id'}
 for item in x.items:s.add(model(profile_id=p.id,**{k:v for k,v in item.items() if k in allowed}))
 p.status='draft';remove_projection(s,p.id);audit(s,r,'profile.details.replace','success',f'profile:{p.id}',a[0].id,{'kind':kind});s.commit();return {'count':len(x.items),'status':'draft'}
@app.post('/api/v1/me/profile/confirm')
def confirm_profile(r:Request,a=Depends(candidate_csrf),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 if not p:raise HTTPException(404,'profile not found')
 n=s.query(ProfileVersion).filter_by(profile_id=p.id).count()+1;s.add(ProfileVersion(profile_id=p.id,version=n,content_json=p.content_json));p.status='confirmed';p.updated_at=now();s.flush();sync_search_projection(s,p);audit(s,r,'profile.confirm','success',f'profile:{p.id}',a[0].id);s.commit();return {'status':p.status,'version':n}
@app.post('/api/v1/me/profile/publish')
def publish_profile(r:Request,a=Depends(candidate_csrf),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 consent=s.scalar(select(Consent).where(Consent.user_id==a[0].id,Consent.consent_type=='public_share'))
 if not p or p.status!='confirmed' or not consent or not consent.granted:raise HTTPException(403,'confirmed profile and public-share consent required')
 p.status='published';p.public_slug=p.public_slug or uuid4().hex;p.published_at=now();audit(s,r,'profile.publish','success',f'profile:{p.id}',a[0].id);s.commit();return {'slug':p.public_slug,'status':p.status}
@app.post('/api/v1/me/profile/withdraw')
def withdraw_profile(r:Request,a=Depends(candidate_csrf),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 if not p:raise HTTPException(404,'profile not found')
 p.status='confirmed';p.public_slug=None;p.published_at=None;audit(s,r,'profile.withdraw','success',f'profile:{p.id}',a[0].id);s.commit();return {'status':p.status}
@app.get('/api/v1/public/profiles/{slug}')
def public_profile(slug:str,s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.public_slug==slug,Profile.status=='published'))
 if not p:raise HTTPException(404,'profile not found')
 # Public cards use the same conservative field-level disclosure guard as
 # enterprise projections.  Public-share consent is not permission to expose
 # contact details or a precise home/work address accidentally pasted into a
 # free-text field.
 c=p.content_json or {}; return {'display_name':safe_projection_text(p.display_name,100) or None,'headline':safe_projection_text(c.get('headline'),300) or None,'skills':string_list(c.get('skills')),'services':string_list(c.get('services')),'updated_at':p.updated_at}

def safe_like(value): return '%' + normalized(value).replace('\\','\\\\').replace('%','\\%').replace('_','\\_') + '%'
def delimited_match(column,value): return or_(*[column.contains(f'|{term}|',autoescape=True) for term in expand_synonym(value)])
def text_match(column,value): return or_(*[column.ilike(safe_like(term),escape='\\') for term in expand_synonym(value)])
def search_reasons(row,query):
 reasons=[];skills=set(row.skills or []);industries=set(row.industries or []);regions=set(row.service_regions or []);modes=set(row.work_modes or [])
 for skill in query.skills:
  matched=[term for term in expand_synonym(skill) if term in skills]
  if matched: reasons.append({'field':'skill','value':matched[0],'expanded':matched[0]!=normalized(skill)})
 if query.industry and any(term in industries for term in expand_synonym(query.industry)):reasons.append({'field':'industry','value':normalized(query.industry),'expanded':False})
 if query.region and any(term in regions for term in expand_synonym(query.region)):reasons.append({'field':'region','value':normalized(query.region),'expanded':False})
 if query.work_mode and any(term in modes for term in expand_synonym(query.work_mode)):reasons.append({'field':'work_mode','value':normalized(query.work_mode),'expanded':False})
 if row.work_years is not None and (query.work_years_min is None or row.work_years>=query.work_years_min) and (query.work_years_max is None or row.work_years<=query.work_years_max):reasons.append({'field':'work_years','value':row.work_years,'expanded':False})
 if query.keywords and any(term in normalized(row.search_text) for term in expand_synonym(query.keywords)):reasons.append({'field':'capability','value':normalized(query.keywords),'expanded':False})
 return reasons
def candidate_card(row,reasons):
 return {'candidate_ref':row.candidate_ref,'display_name':row.display_name,'headline':row.headline,'skills':row.skills or [],'industries':row.industries or [],'location':row.location,'service_regions':row.service_regions or [],'work_modes':row.work_modes or [],'work_years':row.work_years,'project_summaries':row.project_summaries or [],'match_reasons':reasons}
@app.post('/api/v1/organizations/{oid}/talent-search')
def talent_search(oid:UUID,x:TalentSearchIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 member=active_membership(oid,a[0].id,s);organization=s.get(Organization,oid)
 if not member:
  audit(s,r,'talent_search','denied','organization',a[0].id);s.commit();raise HTTPException(404,'resource not found')
 if not organization or not recruitment_allowed(s,oid,a[0].id):
  audit(s,r,'talent_search','denied',f'organization:{oid}',a[0].id);s.commit();raise HTTPException(403,'organization not approved')
 if x.work_years_min is not None and x.work_years_max is not None and x.work_years_min>x.work_years_max:raise HTTPException(422,'invalid work years range')
 if not any([normalized(x.keywords),x.skills,normalized(x.industry),normalized(x.region),normalized(x.work_mode),x.work_years_min is not None,x.work_years_max is not None]):raise HTTPException(422,'at least one search condition is required')
 if not consume_search_quota(s,oid,a[0].id):
  audit(s,r,'talent_search','rate_limited',f'organization:{oid}',a[0].id);s.commit();raise HTTPException(429,'talent search limit reached')
 stmt=select(CandidateSearchProjection).join(Profile,CandidateSearchProjection.profile_id==Profile.id).join(Consent,and_(Consent.user_id==CandidateSearchProjection.owner_user_id,Consent.consent_type=='enterprise_search',Consent.granted.is_(True))).where(Profile.status.in_(SEARCHABLE_PROFILE_STATUSES))
 for skill in x.skills:stmt=stmt.where(delimited_match(CandidateSearchProjection.skills_text,skill))
 if x.industry:stmt=stmt.where(delimited_match(CandidateSearchProjection.industries_text,x.industry))
 if x.region:stmt=stmt.where(delimited_match(CandidateSearchProjection.regions_text,x.region))
 if x.work_mode:stmt=stmt.where(delimited_match(CandidateSearchProjection.work_modes_text,x.work_mode))
 if x.work_years_min is not None:stmt=stmt.where(CandidateSearchProjection.work_years>=x.work_years_min)
 if x.work_years_max is not None:stmt=stmt.where(CandidateSearchProjection.work_years<=x.work_years_max)
 if x.keywords:stmt=stmt.where(text_match(CandidateSearchProjection.search_text,x.keywords))
 # SQL owns filtering, stable ordering, and pagination.  Do not discard or
 # re-rank rows after applying OFFSET/LIMIT: that would make has_more and page
 # boundaries inconsistent.  search_reasons is explanation-only and mirrors
 # the predicates above.
 rows=s.scalars(stmt.order_by(CandidateSearchProjection.indexed_at.asc(),CandidateSearchProjection.profile_id.asc()).offset((x.page-1)*x.page_size).limit(x.page_size+1)).all()
 window=rows[:x.page_size];payload={'items':[candidate_card(row,search_reasons(row,x)) for row in window],'page':x.page,'page_size':x.page_size,'has_more':len(rows)>x.page_size}
 query_hash=hashlib.sha256(json.dumps(x.model_dump(),sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:16];audit(s,r,'talent_search','success',f'organization:{oid}',a[0].id,{'query_hash':query_hash,'result_bucket':'0' if not window else '1-10' if len(window)<=10 else '11+','page':x.page});s.commit();return payload
@app.post('/api/v1/admin/talent-search/rebuild')
def rebuild_talent_search(r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if a[0].role!='admin':raise HTTPException(403,'administrator role required')
 s.query(CandidateSearchProjection).delete();s.flush();count=0
 for p in s.scalars(select(Profile).where(Profile.status.in_(SEARCHABLE_PROFILE_STATUSES))):
  if sync_search_projection(s,p):count+=1
 audit(s,r,'talent_search.rebuild','success','candidate_search_projection',a[0].id,{'projection_count':count});s.commit();return {'rebuilt':count}
@app.get('/api/v1/admin/talent-search/consistency')
def talent_search_consistency(a=Depends(auth),s:Session=Depends(db)):
 if a[0].role!='admin':raise HTTPException(403,'administrator role required')
 eligible=s.scalar(select(func.count(Profile.id)).join(Consent,and_(Consent.user_id==Profile.owner_user_id,Consent.consent_type=='enterprise_search',Consent.granted.is_(True))).where(Profile.status.in_(SEARCHABLE_PROFILE_STATUSES))) or 0
 projected=s.scalar(select(func.count(CandidateSearchProjection.id))) or 0
 return {'eligible_profiles':eligible,'projected_profiles':projected,'in_sync':eligible==projected}

def employer_posting_recruiter_current(s,post):
 person=s.scalar(select(RecruiterVerification).where(RecruiterVerification.user_id==post.created_by))
 authz=s.scalar(select(RecruiterOrganizationAuthorization).where(
  RecruiterOrganizationAuthorization.organization_id==post.organization_id,
  RecruiterOrganizationAuthorization.user_id==post.created_by))
 return bool(verification_is_current(person) and active_membership(post.organization_id,post.created_by,s)
  and authz and authz.status=='active' and not authz.revoked_at
  and (not authz.expires_at or comparable_time(authz.expires_at)>now()))

# Phase 4 - enterprise-direct vacancies are always kept distinct from official ATS records.
# Publication requires verified recruiter + company, network-recruitment gate and independent review.
def checked_apply_link(value:str):
 try:
  u=urlsplit(value)
  host=(u.hostname or '').lower().rstrip('.')
  if (u.scheme!='https' or not host or u.username or u.password or u.port or
      u.fragment or len(value)>1000 or not re.fullmatch(r'[a-z0-9.-]+',host) or
      '.' not in host or host.endswith(('.local','.internal','.invalid','.test','.example')) or
      any(host==blocked or host.endswith('.'+blocked) for blocked in ('localhost','127.0.0.1','0.0.0.0','10.0.0.1','169.254.169.254','bit.ly','tinyurl.com','t.co')) or
      re.fullmatch(r'\d+(?:\.\d+){3}',host)):
   raise ValueError()
  return value
 except (ValueError,TypeError):
  raise HTTPException(422,'HTTPS employer application link required; shortened or internal links forbidden')

def employer_posting_view(x:EmployerPosting, company:str, public=False):
 fields={'id':'employer-'+str(x.id),'organization_id':str(x.organization_id),
         'company':company,'title':x.title,'location':x.location,
         'work_mode':x.work_mode,'recruitment_type':x.recruitment_type,
         'status':x.status,'updated_at':x.updated_at,'published_at':x.published_at,
         'expires_at':x.expires_at,'source_type':'HHBA_VERIFIED_EMPLOYER',
         'notice':'企业认证并通过岗位审核的自发布岗位；并非官方 ATS 同步数据'}
 if public:
  return {k:v for k,v in fields.items() if k!='organization_id'}|{'description':x.description,
    'requirements':x.requirements,'apply_url':x.apply_url}
 return fields|{'description':x.description,'requirements':x.requirements,
                'apply_url':x.apply_url,'review_reason':x.review_reason}

def employer_posting_of(s,oid,pid):
 x=s.get(EmployerPosting,pid)
 if not x or x.organization_id!=oid:raise HTTPException(404,'resource not found')
 return x

@app.post('/api/v1/organizations/{oid}/postings',status_code=201)
def employer_posting_create(oid:UUID,x:EmployerPostingIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'manage_drafts'):
  raise HTTPException(404,'resource not found')
 checked_apply_link(x.apply_url)
 post=EmployerPosting(organization_id=oid,created_by=a[0].id,**x.model_dump())
 s.add(post);s.flush()
 audit(s,r,'employer_posting.create','success',f'employer_posting:{post.id}',a[0].id,{'status':'draft'})
 s.commit()
 return employer_posting_view(post,s.get(Organization,oid).legal_name)

@app.get('/api/v1/organizations/{oid}/postings')
def employer_posting_list(oid:UUID,a=Depends(auth),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'manage_drafts'):
  raise HTTPException(404,'resource not found')
 org=s.get(Organization,oid)
 rows=s.scalars(select(EmployerPosting).where(EmployerPosting.organization_id==oid).order_by(EmployerPosting.created_at.desc(),EmployerPosting.id.desc()).limit(100)).all()
 return {'items':[employer_posting_view(x,org.legal_name) for x in rows]}

@app.put('/api/v1/organizations/{oid}/postings/{pid}')
def employer_posting_update(oid:UUID,pid:UUID,x:EmployerPostingIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'manage_drafts'):
  raise HTTPException(404,'resource not found')
 post=employer_posting_of(s,oid,pid)
 if post.status not in {'draft','rejected'}:raise HTTPException(409,'only private drafts and rejected vacancies may be edited')
 member=active_membership(oid,a[0].id,s)
 if member.role!='owner' and post.created_by!=a[0].id:raise HTTPException(404,'resource not found')
 checked_apply_link(x.apply_url)
 for key,value in x.model_dump().items():setattr(post,key,value)
 post.status='draft';post.review_reason=None;post.updated_at=now()
 audit(s,r,'employer_posting.update','success',f'employer_posting:{pid}',a[0].id)
 s.commit();return employer_posting_view(post,s.get(Organization,oid).legal_name)

@app.post('/api/v1/organizations/{oid}/postings/{pid}/submit')
def employer_posting_submit(oid:UUID,pid:UUID,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'talent_search'):
  raise HTTPException(403,'company and recruiter verification plus network recruitment gate required')
 post=employer_posting_of(s,oid,pid)
 if post.status!='draft':raise HTTPException(409,'only a private draft may be submitted')
 checked_apply_link(post.apply_url)
 post.status='pending_review';post.submitted_at=now();post.updated_at=now()
 audit(s,r,'employer_posting.submit','success',f'employer_posting:{pid}',a[0].id)
 s.commit();return {'id':'employer-'+str(pid),'status':post.status}

@app.post('/api/v1/organizations/{oid}/postings/{pid}/close')
def employer_posting_close(oid:UUID,pid:UUID,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if not require_recruitment_permission(s,oid,a[0].id,'manage_drafts'):
  raise HTTPException(404,'resource not found')
 post=employer_posting_of(s,oid,pid)
 member=active_membership(oid,a[0].id,s)
 if member.role!='owner' and post.created_by!=a[0].id:raise HTTPException(404,'resource not found')
 if post.status=='closed':return {'id':'employer-'+str(pid),'status':'closed'}
 post.status='closed';post.updated_at=now()
 audit(s,r,'employer_posting.close','success',f'employer_posting:{pid}',a[0].id)
 s.commit();return {'id':'employer-'+str(pid),'status':'closed'}

@app.get('/api/v1/admin/employer-postings')
def admin_postings(a=Depends(auth),s:Session=Depends(db)):
 if a[0].role!='admin':raise HTTPException(403,'admin only')
 rows=s.scalars(select(EmployerPosting).where(EmployerPosting.status=='pending_review').order_by(EmployerPosting.submitted_at.asc()).limit(100)).all()
 return {'items':[employer_posting_view(row,s.get(Organization,row.organization_id).legal_name) for row in rows]}

@app.post('/api/v1/admin/employer-postings/{pid}/review')
def admin_posting_review(pid:UUID,x:EmployerPostingReviewIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if a[0].role!='admin':raise HTTPException(403,'admin only')
 post=s.scalar(select(EmployerPosting).where(EmployerPosting.id==pid).with_for_update())
 if not post:raise HTTPException(404,'resource not found')
 if post.status!='pending_review':raise HTTPException(409,'the submission state has changed')
 if post.created_by==a[0].id:raise HTTPException(403,'reviewer cannot approve own vacancy')
 if x.decision=='approved':
  org=s.get(Organization,post.organization_id)
  person=s.scalar(select(RecruiterVerification).where(RecruiterVerification.user_id==post.created_by))
  org_ver=s.scalar(select(OrganizationVerification).where(OrganizationVerification.organization_id==post.organization_id))
  authorization=s.scalar(select(RecruiterOrganizationAuthorization).where(
      RecruiterOrganizationAuthorization.organization_id==post.organization_id,
      RecruiterOrganizationAuthorization.user_id==post.created_by))
  gate=s.get(PlatformServiceGate,'network_recruitment')
  if not (gate and gate.enabled and org and org.status=='approved' and
          verification_is_current(org_ver) and verification_is_current(person) and
          authorization and authorization.status=='active'
          and not authorization.revoked_at and
          active_membership(post.organization_id,post.created_by,s) and
          (not authorization.expires_at or comparable_time(authorization.expires_at)>now())):
   raise HTTPException(403,'employer verification or platform service gate is not active')
  checked_apply_link(post.apply_url)
  post.status='published';post.published_at=now();post.expires_at=now()+timedelta(days=45)
 else:
  post.status='rejected';post.review_reason=x.reason_code
 post.reviewed_by=a[0].id;post.reviewed_at=now();post.updated_at=now()
 audit(s,r,'employer_posting.review','success',f'employer_posting:{pid}',a[0].id,{'decision':x.decision,'reason_code':x.reason_code})
 s.commit();return {'id':'employer-'+str(pid),'status':post.status}

def public_employer_stmt(s):
 gate=s.get(PlatformServiceGate,'network_recruitment')
 if not gate or not gate.enabled:return None
 point=now()
 # Apply ALL publication eligibility in SQL before COUNT/OFFSET/LIMIT;
 # expired, suspended or revoked recruiters must not produce false totals
 # or empty pages. The public endpoint cannot enumerate private drafts.
 recruiter_ok=(select(RecruiterVerification.id).where(
  RecruiterVerification.user_id==EmployerPosting.created_by,
  RecruiterVerification.status=='approved',
  or_(RecruiterVerification.next_review_due_at.is_(None),
      RecruiterVerification.next_review_due_at>point)).exists())
 authorization_ok=(select(RecruiterOrganizationAuthorization.id).where(
  RecruiterOrganizationAuthorization.organization_id==EmployerPosting.organization_id,
  RecruiterOrganizationAuthorization.user_id==EmployerPosting.created_by,
  RecruiterOrganizationAuthorization.status=='active',
  RecruiterOrganizationAuthorization.revoked_at.is_(None),
  or_(RecruiterOrganizationAuthorization.expires_at.is_(None),
      RecruiterOrganizationAuthorization.expires_at>point)).exists())
 membership_ok=(select(Membership.id).where(
  Membership.organization_id==EmployerPosting.organization_id,
  Membership.user_id==EmployerPosting.created_by,
  Membership.status=='active').exists())
 return (select(EmployerPosting,Organization)
  .join(Organization,EmployerPosting.organization_id==Organization.id)
  .join(OrganizationVerification,EmployerPosting.organization_id==OrganizationVerification.organization_id)
  .where(EmployerPosting.status=='published',EmployerPosting.expires_at>point,
    Organization.status=='approved',
    OrganizationVerification.status=='approved',
    or_(OrganizationVerification.next_review_due_at.is_(None),
        OrganizationVerification.next_review_due_at>point),
    recruiter_ok,authorization_ok,membership_ok))

@app.get('/api/v1/public/employer-postings')
def public_employer_postings(q:str='',limit:int=20,offset:int=0,s:Session=Depends(db)):
 if limit<1 or limit>30 or offset<0 or offset>3000 or len(q)>100:raise HTTPException(422,'invalid pagination or search')
 stmt=public_employer_stmt(s)
 if stmt is None:return {'items':[],'total':0}
 if q.strip():
  escaped=q.strip().replace('\\','\\\\').replace('%','\\%').replace('_','\\_')
  pattern='%'+escaped+'%'
  stmt=stmt.where(or_(EmployerPosting.title.ilike(pattern,escape='\\'),
    EmployerPosting.location.ilike(pattern,escape='\\'),
    Organization.legal_name.ilike(pattern,escape='\\')))
 count=s.scalar(select(func.count()).select_from(stmt.subquery())) or 0
 rows=s.execute(stmt.order_by(EmployerPosting.published_at.desc(),EmployerPosting.id.desc()).offset(offset).limit(limit)).all()
 return {'items':[employer_posting_view(post,org.legal_name,public=True) for post,org in rows if employer_posting_recruiter_current(s,post)],
         'total':count,'limit':limit,'offset':offset}

@app.get('/api/v1/public/employer-postings/{pid}')
def public_employer_posting(pid:UUID,s:Session=Depends(db)):
 stmt=public_employer_stmt(s)
 if stmt is None:raise HTTPException(404,'resource not found')
 row=s.execute(stmt.where(EmployerPosting.id==pid)).first()
 if not row or not employer_posting_recruiter_current(s,row[0]):raise HTTPException(404,'resource not found')
 return employer_posting_view(row[0],row[1].legal_name,public=True)

# Applications are distinct from consent to appear in enterprise talent search.
APP_TRANSITIONS={
 'submitted':{'reviewing','shortlisted','rejected'},
 'reviewing':{'shortlisted','interview','rejected'},
 'shortlisted':{'interview','rejected'},
 'interview':{'hired','rejected'},
 'rejected':set(),'hired':set()
}
def active_application_vacancy(s,pid):
 stmt=public_employer_stmt(s)
 if stmt is None:raise HTTPException(404,'vacancy unavailable')
 row=s.execute(stmt.where(EmployerPosting.id==pid)).first()
 if not row or not employer_posting_recruiter_current(s,row[0]):
  raise HTTPException(404,'vacancy unavailable')
 return row[0],row[1]

def application_share_fields(s,p):
 values=projection_values(s,p)
 return {'display_name':values['display_name'],'headline':values['headline'],
  'skills':values['skills'][:8],'location':values['location'],
  'work_years':values['work_years']}

@app.get('/api/v1/me/employer-applications/preview/{pid}')
def application_preview(pid:UUID,a=Depends(candidate_auth),s:Session=Depends(db)):
 posting,org=active_application_vacancy(s,pid)
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 existing=s.scalar(select(EmployerJobApplication).where(
  EmployerJobApplication.posting_id==pid,
  EmployerJobApplication.candidate_user_id==a[0].id))
 allowed=bool(p and p.status in SEARCHABLE_PROFILE_STATUSES)
 return {'eligible':allowed and not existing,
  'reason':'CONFIRMED_PROFILE_REQUIRED' if not allowed else 'ALREADY_APPLIED' if existing else None,
  'posting':{'id':'employer-'+str(pid),'title':posting.title,'company':org.legal_name},
  'shared_fields':application_share_fields(s,p) if allowed else None,
  'already_applied':bool(existing)}

@app.post('/api/v1/me/employer-applications/{pid}',status_code=201)
def application_submit(pid:UUID,x:EmployerApplicationSubmitIn,r:Request,
                       a=Depends(candidate_csrf),s:Session=Depends(db)):
 if x.confirmed_share is not True:
  raise HTTPException(422,'explicit per-job sharing consent required')
 s.scalar(select(EmployerPosting).where(EmployerPosting.id==pid).with_for_update())
 posting,org=active_application_vacancy(s,pid)
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 if not p or p.status not in SEARCHABLE_PROFILE_STATUSES:
  raise HTTPException(409,'confirmed capability profile required')
 existing=s.scalar(select(EmployerJobApplication).where(
  EmployerJobApplication.posting_id==pid,
  EmployerJobApplication.candidate_user_id==a[0].id))
 if existing:raise HTTPException(409,'already applied; duplicate submissions forbidden')
 note=x.cover_note.strip()
 if note and (len(note)<12 or safe_projection_text(note,500)!=note):
  raise HTTPException(422,'application note contains sensitive contact or address')
 snapshot=application_share_fields(s,p)
 if not any((snapshot['headline'],snapshot['skills'],snapshot['location'],snapshot['work_years'] is not None)):
  raise HTTPException(422,'confirmed profile lacks shareable capability information')
 item=EmployerJobApplication(posting_id=pid,organization_id=posting.organization_id,
  candidate_user_id=a[0].id,snapshot_json=snapshot,cover_note=note,status='submitted',
  consented_at=now())
 s.add(item);s.flush()
 audit(s,r,'employer_application.submit','success',f'employer_application:{item.id}',
  a[0].id,{'posting_id':str(pid),'fields':[k for k,v in snapshot.items() if v]})
 s.commit()
 return {'id':str(item.id),'status':'submitted','company':org.legal_name,
  'notice':'This per-vacancy consent does not authorize broad talent search or raw resume disclosure'}

@app.get('/api/v1/me/employer-applications')
def application_owner_list(a=Depends(candidate_auth),s:Session=Depends(db)):
 rows=s.execute(select(EmployerJobApplication,EmployerPosting,Organization)
  .join(EmployerPosting,EmployerJobApplication.posting_id==EmployerPosting.id)
  .join(Organization,EmployerJobApplication.organization_id==Organization.id)
  .where(EmployerJobApplication.candidate_user_id==a[0].id)
  .order_by(EmployerJobApplication.created_at.desc()).limit(100)).all()
 return {'items':[{'id':str(j.id),'posting_id':'employer-'+str(j.posting_id),
  'company':org.legal_name,'title':p.title,'location':p.location,
  'status':j.status,'created_at':j.created_at,'updated_at':j.updated_at}
  for j,p,org in rows]}

@app.post('/api/v1/me/employer-applications/{aid}/withdraw')
def application_withdraw(aid:UUID,r:Request,a=Depends(candidate_csrf),s:Session=Depends(db)):
 j=s.scalar(select(EmployerJobApplication).where(
  EmployerJobApplication.id==aid,
  EmployerJobApplication.candidate_user_id==a[0].id).with_for_update())
 if not j:raise HTTPException(404,'application unavailable')
 if j.status!='withdrawn':
  j.status='withdrawn';j.withdrawn_at=now();j.updated_at=now()
  j.snapshot_json={};j.cover_note=''
  audit(s,r,'employer_application.withdraw','success',f'employer_application:{aid}',a[0].id)
  s.commit()
 return {'id':str(aid),'status':'withdrawn','notice':'shared profile snapshot erased'}

def employer_application_access(s,oid,pid,user_id):
 if not recruitment_allowed(s,oid,user_id):raise HTTPException(403,'verified employer required')
 post=s.get(EmployerPosting,pid)
 if not post or post.organization_id!=oid:raise HTTPException(404,'vacancy unavailable')
 active_application_vacancy(s,pid)
 return post

def employer_application_card(x):
 return {'id':str(x.id),'posting_id':'employer-'+str(x.posting_id),
  'shared_fields':x.snapshot_json,'cover_note':x.cover_note,
  'status':x.status,'created_at':x.created_at,'updated_at':x.updated_at}

@app.get('/api/v1/organizations/{oid}/postings/{pid}/applications')
def employer_application_list(oid:UUID,pid:UUID,a=Depends(auth),s:Session=Depends(db)):
 employer_application_access(s,oid,pid,a[0].id)
 rows=s.scalars(select(EmployerJobApplication).where(
  EmployerJobApplication.posting_id==pid,EmployerJobApplication.organization_id==oid,
  EmployerJobApplication.status!='withdrawn')
  .order_by(EmployerJobApplication.created_at.desc()).limit(100)).all()
 return {'items':[employer_application_card(x) for x in rows]}

@app.post('/api/v1/organizations/{oid}/postings/{pid}/applications/{aid}/status')
def employer_application_status(oid:UUID,pid:UUID,aid:UUID,x:EmployerApplicationStatusIn,
  r:Request,a=Depends(csrf),s:Session=Depends(db)):
 employer_application_access(s,oid,pid,a[0].id)
 row=s.scalar(select(EmployerJobApplication).where(EmployerJobApplication.id==aid,
  EmployerJobApplication.posting_id==pid,
  EmployerJobApplication.organization_id==oid).with_for_update())
 if not row or row.status=='withdrawn':raise HTTPException(404,'application unavailable')
 if row.status!=x.expected_status:raise HTTPException(409,'status changed; refresh')
 if x.status not in APP_TRANSITIONS.get(row.status,set()):
  raise HTTPException(409,'unsupported status transition')
 row.status=x.status;row.updated_at=now();row.updated_by=a[0].id
 audit(s,r,'employer_application.status','success',f'employer_application:{aid}',
  a[0].id,{'status':x.status})
 s.commit()
 return {'id':str(aid),'status':row.status,'updated_at':row.updated_at}
