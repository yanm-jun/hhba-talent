"""Phase 1 identity, organization, consent and audit API."""
import hashlib, json, os, re, secrets
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
class CandidateSearchProjection(Base):
 __tablename__='candidate_search_projections'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); profile_id: Mapped[UUID]=mapped_column(ForeignKey('profiles.id',ondelete='CASCADE'),unique=True,index=True); owner_user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True); candidate_ref: Mapped[str]=mapped_column(String(32),unique=True,index=True,default=lambda:uuid4().hex); display_name: Mapped[str|None]=mapped_column(String(100)); headline: Mapped[str|None]=mapped_column(String(300)); capability_summary: Mapped[str|None]=mapped_column(Text); skills: Mapped[list]=mapped_column(JSON,default=list); industries: Mapped[list]=mapped_column(JSON,default=list); location: Mapped[str|None]=mapped_column(String(120)); service_regions: Mapped[list]=mapped_column(JSON,default=list); work_modes: Mapped[list]=mapped_column(JSON,default=list); work_years: Mapped[int|None]=mapped_column(Integer); project_summaries: Mapped[list]=mapped_column(JSON,default=list); skills_text: Mapped[str]=mapped_column(Text,default=''); industries_text: Mapped[str]=mapped_column(Text,default=''); regions_text: Mapped[str]=mapped_column(Text,default=''); work_modes_text: Mapped[str]=mapped_column(Text,default=''); search_text: Mapped[str]=mapped_column(Text,default=''); profile_version: Mapped[int]=mapped_column(Integer,default=0); indexed_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class TalentSearchUsage(Base):
 __tablename__='talent_search_usages'; __table_args__=(UniqueConstraint('organization_id','user_id','usage_date',name='uq_talent_search_usage_day'),); id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); organization_id: Mapped[UUID]=mapped_column(ForeignKey('organizations.id',ondelete='CASCADE'),index=True); user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True); usage_date: Mapped[date]=mapped_column(Date); request_count: Mapped[int]=mapped_column(Integer,default=0); updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
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
class Register(BaseModel): email:EmailStr; password:str=Field(min_length=12); display_name:str
class Login(BaseModel): email:EmailStr; password:str
class OrgIn(BaseModel): legal_name:str=Field(min_length=2)
class ReviewIn(BaseModel): status:str=Field(pattern='^(approved|rejected|suspended)$')
class ConsentIn(BaseModel): granted:bool
class MemberIn(BaseModel): user_id:UUID; role:str=Field(pattern='^(owner|member)$')
class RequirementIn(BaseModel):
 title:str=Field(min_length=1,max_length=160); description:str=Field(min_length=1,max_length=8000); location:str|None=Field(default=None,max_length=120); work_mode:str|None=Field(default=None,max_length=64); status:str=Field(default='draft',pattern='^(draft|archived)$')
class RequirementPatch(BaseModel):
 title:str|None=Field(default=None,min_length=1,max_length=160); description:str|None=Field(default=None,min_length=1,max_length=8000); location:str|None=Field(default=None,max_length=120); work_mode:str|None=Field(default=None,max_length=64); status:str|None=Field(default=None,pattern='^(draft|archived)$')
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
 e=str(x.email).casefold(); u=User(email=e,name=x.display_name,password_hash=pwd.hash(x.password),role='admin' if e==os.getenv('HHBA_BOOTSTRAP_ADMIN_EMAIL','').casefold() else 'user');s.add(u)
 try:s.flush()
 except Exception:s.rollback();raise HTTPException(409,'account cannot be created')
 audit(s,r,'auth.register','success',f'user:{u.id}',u.id);s.commit();return {'id':str(u.id)}
@app.post('/api/v1/auth/session')
def login(x:Login,res:Response,r:Request,s:Session=Depends(db)):
 u=s.scalar(select(User).where(User.email==str(x.email).casefold()))
 if not u or not pwd.verify(x.password,u.password_hash):audit(s,r,'auth.login','denied','session');s.commit();raise HTTPException(401,'invalid credentials')
 t=secrets.token_urlsafe(32);q=AuthSession(user_id=u.id,token_hash=hashlib.sha256(t.encode()).hexdigest(),csrf=secrets.token_urlsafe(32),expires_at=now()+timedelta(hours=8));s.add(q);audit(s,r,'auth.login','success','session',u.id);s.commit();res.set_cookie('hhba_session',t,httponly=True,samesite='lax');return {'csrf_token':q.csrf,'role':u.role}
@app.get('/api/v1/auth/me')
def me(a=Depends(auth)):
 return {'id':str(a[0].id),'email':a[0].email,'display_name':a[0].name,'role':a[0].role,'csrf_token':a[1].csrf}
@app.delete('/api/v1/auth/session')
def logout(res:Response,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 a[1].revoked_at=now();audit(s,r,'auth.logout','success','session',a[0].id);s.commit();res.delete_cookie('hhba_session');return {'ok':True}
@app.post('/api/v1/organizations',status_code=201)
def org(x:OrgIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 o=Organization(legal_name=x.legal_name,created_by=a[0].id);s.add(o);s.flush();s.add(Membership(organization_id=o.id,user_id=a[0].id,role='owner'));audit(s,r,'organization.create','success',f'organization:{o.id}',a[0].id);s.commit();return {'id':str(o.id),'status':o.status}
@app.get('/api/v1/organizations')
def organizations(a=Depends(auth),s:Session=Depends(db)):
 rows=s.scalars(select(Membership).where(Membership.user_id==a[0].id,Membership.status=='active')).all();result=[]
 for m in rows:
  o=s.get(Organization,m.organization_id)
  if o:result.append({'id':str(o.id),'legal_name':o.legal_name,'status':o.status,'membership_role':m.role})
 return {'organizations':result}
@app.get('/api/v1/organizations/{oid}/members')
def members(oid:UUID,a=Depends(auth),s:Session=Depends(db)):
 if not s.scalar(select(Membership).where(Membership.organization_id==oid,Membership.user_id==a[0].id,Membership.status=='active')):raise HTTPException(404,'resource not found')
 return {'members':[{'user_id':str(m.user_id),'role':m.role,'status':m.status} for m in s.scalars(select(Membership).where(Membership.organization_id==oid))]}
@app.post('/api/v1/organizations/{oid}/members',status_code=201)
def addmember(oid:UUID,x:MemberIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 m=s.scalar(select(Membership).where(Membership.organization_id==oid,Membership.user_id==a[0].id,Membership.status=='active'))
 if not m or m.role!='owner':raise HTTPException(404,'resource not found')
 if not s.get(User,x.user_id):raise HTTPException(404,'resource not found')
 if s.scalar(select(Membership).where(Membership.organization_id==oid,Membership.user_id==x.user_id)):raise HTTPException(409,'membership already exists')
 s.add(Membership(organization_id=oid,user_id=x.user_id,role=x.role));audit(s,r,'organization.member.add','success',f'organization:{oid}',a[0].id);s.commit();return {'ok':True}
@app.delete('/api/v1/organizations/{oid}/members/{uid}')
def removemember(oid:UUID,uid:UUID,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 m=s.scalar(select(Membership).where(Membership.organization_id==oid,Membership.user_id==a[0].id,Membership.status=='active'))
 if not m or m.role!='owner':raise HTTPException(404,'resource not found')
 target=s.scalar(select(Membership).where(Membership.organization_id==oid,Membership.user_id==uid))
 if not target:raise HTTPException(404,'resource not found')
 target.status='removed';audit(s,r,'organization.member.remove','success',f'organization:{oid}',a[0].id);s.commit();return {'ok':True}
@app.patch('/api/v1/organizations/{oid}/members/{uid}')
def changemember(oid:UUID,uid:UUID,x:MemberIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 m=s.scalar(select(Membership).where(Membership.organization_id==oid,Membership.user_id==a[0].id,Membership.status=='active'))
 if not m or m.role!='owner':raise HTTPException(404,'resource not found')
 target=s.scalar(select(Membership).where(Membership.organization_id==oid,Membership.user_id==uid,Membership.status=='active'))
 if not target:raise HTTPException(404,'resource not found')
 target.role=x.role;audit(s,r,'organization.member.role_change','success',f'organization:{oid}',a[0].id);s.commit();return {'ok':True}
@app.post('/api/v1/admin/organizations/{oid}/review')
def review(oid:UUID,x:ReviewIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 if a[0].role!='admin':raise HTTPException(403,'administrator role required')
 o=s.get(Organization,oid)
 if not o:raise HTTPException(404,'resource not found')
 o.status=x.status;o.reviewed_by=a[0].id;o.reviewed_at=now();audit(s,r,'organization.review','success',f'organization:{oid}',a[0].id,{'status':x.status});s.commit();return {'status':o.status}
@app.get('/api/v1/organizations/{oid}/restricted-access')
def restricted(oid:UUID,r:Request,a=Depends(auth),s:Session=Depends(db)):
 m=s.scalar(select(Membership).where(Membership.organization_id==oid,Membership.user_id==a[0].id,Membership.status=='active'));o=s.get(Organization,oid)
 if not m or not o or o.status!='approved':audit(s,r,'organization.restricted_access','denied',f'organization:{oid}',a[0].id);s.commit();raise HTTPException(403,'organization not approved')
 audit(s,r,'organization.restricted_access','success',f'organization:{oid}',a[0].id);s.commit();return {'restricted_access':True}
def active_membership(oid:UUID,user_id:UUID,s:Session):
 return s.scalar(select(Membership).where(Membership.organization_id==oid,Membership.user_id==user_id,Membership.status=='active'))
SEARCHABLE_PROFILE_STATUSES=('confirmed','published')
SYNONYM_GROUPS=(('经销商运营','汽车门店运营'),('销售培训','销售人员培训'),('新能源车销售','新能源汽车销售'))
def normalized(value): return str(value or '').strip().casefold()
SENSITIVE_TEXT=re.compile(r'(?i)(?:\b[\w.+-]+@[\w-]+\.[\w.-]+\b|(?<!\d)1[3-9]\d{9}(?!\d)|\b\d{15,18}[0-9xX]\b|(?:微信|wechat|vx)\s*[:：]?\s*[\w-]{5,}|(?:电话|手机号|邮箱)\s*[:：]?\s*[^\s，。；;]{3,})')
PRIVATE_ADDRESS_MARKERS=re.compile(r'(?:\d{3,}|(?:路|街|巷|弄|号|室|栋|单元|门牌))')
def safe_projection_text(value,limit):
 value=SENSITIVE_TEXT.sub('[已隐藏私人联系方式]',str(value or '')).strip()
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
 return [safe_projection_text(normalized(x),80) for x in values if normalized(x) and not SENSITIVE_TEXT.search(str(x))]
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
 if not active_membership(oid,a[0].id,s):raise HTTPException(404,'resource not found')
 requirement=HiringRequirement(organization_id=oid,created_by=a[0].id,**x.model_dump());s.add(requirement);s.flush();audit(s,r,'hiring_requirement.create','success',f'hiring_requirement:{requirement.id}',a[0].id,{'organization_id':str(oid),'status':x.status});s.commit();return requirement_view(requirement)
@app.get('/api/v1/organizations/{oid}/hiring-requirements')
def list_requirements(oid:UUID,a=Depends(auth),s:Session=Depends(db)):
 if not active_membership(oid,a[0].id,s):raise HTTPException(404,'resource not found')
 return {'items':[requirement_view(x) for x in s.scalars(select(HiringRequirement).where(HiringRequirement.organization_id==oid).order_by(HiringRequirement.updated_at.desc()))]}
@app.get('/api/v1/organizations/{oid}/hiring-requirements/{rid}')
def get_requirement(oid:UUID,rid:UUID,a=Depends(auth),s:Session=Depends(db)):
 if not active_membership(oid,a[0].id,s):raise HTTPException(404,'resource not found')
 x=s.get(HiringRequirement,rid)
 if not x or x.organization_id!=oid:raise HTTPException(404,'resource not found')
 return requirement_view(x)
@app.patch('/api/v1/organizations/{oid}/hiring-requirements/{rid}')
def patch_requirement(oid:UUID,rid:UUID,x:RequirementPatch,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 member=active_membership(oid,a[0].id,s)
 if not member:raise HTTPException(404,'resource not found')
 requirement=s.get(HiringRequirement,rid)
 if not requirement or requirement.organization_id!=oid:raise HTTPException(404,'resource not found')
 if member.role!='owner' and requirement.created_by!=a[0].id:raise HTTPException(404,'resource not found')
 for key,value in x.model_dump(exclude_unset=True).items():setattr(requirement,key,value)
 requirement.updated_at=now();audit(s,r,'hiring_requirement.update','success',f'hiring_requirement:{rid}',a[0].id,{'organization_id':str(oid)});s.commit();return requirement_view(requirement)
@app.put('/api/v1/me/consents/{typ}')
def consent(typ:str,x:ConsentIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
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
def my_consents(a=Depends(auth),s:Session=Depends(db)):
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
async def upload_resume(r:Request,file:UploadFile=File(...),a=Depends(csrf),s:Session=Depends(db)):
 name=os.path.basename(file.filename or ''); ext=os.path.splitext(name)[1].lower(); data=await file.read()
 if ext not in {'.pdf','.docx'} or len(data)==0 or len(data)>10*1024*1024: raise HTTPException(422,'unsupported or oversized document')
 if (ext=='.pdf' and not data.startswith(b'%PDF-')) or (ext=='.docx' and not data.startswith(b'PK')): raise HTTPException(422,'file signature does not match extension')
 os.makedirs(UPLOAD_ROOT,exist_ok=True); key=uuid4().hex+ext; path=os.path.join(UPLOAD_ROOT,key); open(path,'wb').write(data)
 resume=Resume(owner_user_id=a[0].id,storage_key=key,original_filename=name,mime_type='application/pdf' if ext=='.pdf' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size_bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),status='uploaded');s.add(resume);s.flush();job=ParseJob(resume_id=resume.id,state='uploaded');s.add(job);audit(s,r,'resume.upload','success',f'resume:{resume.id}',a[0].id);s.commit();return {'resume_id':str(resume.id),'job_id':str(job.id),'state':'uploaded'}
@app.get('/api/v1/me/resumes')
def list_resumes(a=Depends(auth),s:Session=Depends(db)):
 rows=s.scalars(select(Resume).where(Resume.owner_user_id==a[0].id).order_by(Resume.created_at.desc())).all()
 items=[]
 for x in rows:
  j=s.scalar(select(ParseJob).where(ParseJob.resume_id==x.id))
  items.append({'resume_id':str(x.id),'filename':x.original_filename,'status':x.status,'job_id':str(j.id) if j else None,'job_state':j.state if j else None,'created_at':x.created_at})
 return {'items':items}
@app.get('/api/v1/me/resumes/{rid}')
def resume_status(rid:UUID,a=Depends(auth),s:Session=Depends(db)):
 x=s.get(Resume,rid)
 if not x or x.owner_user_id!=a[0].id:raise HTTPException(404,'resource not found')
 j=s.scalar(select(ParseJob).where(ParseJob.resume_id==rid));return {'resume_id':str(x.id),'filename':x.original_filename,'status':x.status,'job_id':str(j.id) if j else None,'job_state':j.state if j else None,'attempt_count':j.attempt_count if j else 0,'error':j.error_safe_message if j else None,'result':j.result_json if j and j.state=='parsed' else None}
@app.get('/api/v1/me/resumes/{rid}/download')
def download_resume(rid:UUID,a=Depends(auth),s:Session=Depends(db)):
 x=s.get(Resume,rid)
 if not x or x.owner_user_id!=a[0].id:raise HTTPException(404,'resource not found')
 path=os.path.join(UPLOAD_ROOT,x.storage_key)
 if not os.path.isfile(path):raise HTTPException(404,'resource not found')
 return FileResponse(path,media_type=x.mime_type,filename=x.original_filename,headers={'Cache-Control':'no-store'})
@app.post('/api/v1/me/resumes/{rid}/parse')
def parse_resume(rid:UUID,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 x=s.get(Resume,rid)
 if not x or x.owner_user_id!=a[0].id:raise HTTPException(404,'resource not found')
 j=s.scalar(select(ParseJob).where(ParseJob.resume_id==rid))
 if not j or j.state not in {'uploaded','failed'}:raise HTTPException(409,'parsing task is not ready')
 if j.attempt_count>=MAX_PARSE_ATTEMPTS:raise HTTPException(409,'maximum parsing attempts reached')
 j.state='queued';j.error_code=None;j.error_safe_message=None;j.cancel_requested=False;j.updated_at=now();x.status='queued';audit(s,r,'resume.parse.queued','success',f'resume:{rid}',a[0].id);s.commit();return {'job_id':str(j.id),'state':j.state,'attempt_count':j.attempt_count}
@app.post('/api/v1/me/resumes/{rid}/retry-parse')
def retry_parse(rid:UUID,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 x=s.get(Resume,rid)
 if not x or x.owner_user_id!=a[0].id:raise HTTPException(404,'resource not found')
 old=s.scalar(select(ParseJob).where(ParseJob.resume_id==rid))
 if old and old.state not in {'failed','uploaded'}:raise HTTPException(409,'parsing task is not retryable')
 if old and old.attempt_count>=MAX_PARSE_ATTEMPTS:raise HTTPException(409,'maximum parsing attempts reached')
 if old:old.state='queued';old.error_code=None;old.error_safe_message=None;old.result_json=None;old.cancel_requested=False;old.updated_at=now();x.status='queued'
 audit(s,r,'resume.parse.retry','success',f'resume:{rid}',a[0].id);s.commit();return {'resume_id':str(rid),'state':'uploaded'}
@app.post('/api/v1/me/parsing-jobs/{jid}/apply-draft')
def apply_parse_draft(jid:UUID,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 j=s.get(ParseJob,jid)
 resume=s.get(Resume,j.resume_id) if j else None
 if not j or not resume or resume.owner_user_id!=a[0].id or j.state!='parsed':raise HTTPException(404,'resource not found')
 result=j.result_json or {};content={'headline':'待用户确认','skills':[x.get('value') for x in result.get('skills',[]) if x.get('value')],'experiences':result.get('experiences',[]),'education':result.get('education',[]),'projects':[],'services':[],'source_evidence':result.get('raw_text_excerpt','')[:4000]}
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id)) or Profile(owner_user_id=a[0].id);p.content_json=content;p.display_name=None;p.status='draft';p.updated_at=now();s.add(p);s.flush();remove_projection(s,p.id);audit(s,r,'profile.apply_parse_draft','success',f'parse_job:{jid}',a[0].id);s.commit();return {'status':'draft','profile':content}
@app.delete('/api/v1/me/resumes/{rid}')
def delete_resume(rid:UUID,r:Request,a=Depends(csrf),s:Session=Depends(db)):
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
def my_profile(a=Depends(auth),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id));return {'profile':None if not p else {'id':str(p.id),'status':p.status,'display_name':p.display_name,'content':p.content_json,'public_slug':p.public_slug}}
@app.get('/api/v1/me/profile/enterprise-preview')
def enterprise_profile_preview(a=Depends(auth),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 if not p:return {'eligible':False,'fields':None}
 # This route is owner-only and deliberately does not create a projection before
 # the owner grants consent.  It returns exactly the same allow-listed transform.
 values=projection_values(s,p)
 return {'eligible':p.status in SEARCHABLE_PROFILE_STATUSES,'fields':values}
@app.put('/api/v1/me/profile')
def save_profile(x:ProfileIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id)) or Profile(owner_user_id=a[0].id);p.content_json=x.content;p.display_name=x.display_name;p.status='draft';s.add(p);s.flush();remove_projection(s,p.id);audit(s,r,'profile.save','success','profile',a[0].id);s.commit();return {'status':'draft'}
DETAILS={'experiences':Experience,'educations':Education,'projects':Project,'service-intents':ServiceIntent}
@app.get('/api/v1/me/profile/{kind}')
def list_details(kind:str,a=Depends(auth),s:Session=Depends(db)):
 model=DETAILS.get(kind);p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 if not model or not p: return {'items':[]}
 return {'items':[{k:v for k,v in row.__dict__.items() if not k.startswith('_')} for row in s.scalars(select(model).where(model.profile_id==p.id))]}
@app.put('/api/v1/me/profile/{kind}')
def replace_details(kind:str,x:DetailIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 model=DETAILS.get(kind);p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 if not model or not p:raise HTTPException(404,'profile not found')
 s.query(model).filter_by(profile_id=p.id).delete()
 allowed=set(model.__table__.columns.keys())-{'id','profile_id'}
 for item in x.items:s.add(model(profile_id=p.id,**{k:v for k,v in item.items() if k in allowed}))
 p.status='draft';remove_projection(s,p.id);audit(s,r,'profile.details.replace','success',f'profile:{p.id}',a[0].id,{'kind':kind});s.commit();return {'count':len(x.items),'status':'draft'}
@app.post('/api/v1/me/profile/confirm')
def confirm_profile(r:Request,a=Depends(csrf),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 if not p:raise HTTPException(404,'profile not found')
 n=s.query(ProfileVersion).filter_by(profile_id=p.id).count()+1;s.add(ProfileVersion(profile_id=p.id,version=n,content_json=p.content_json));p.status='confirmed';p.updated_at=now();s.flush();sync_search_projection(s,p);audit(s,r,'profile.confirm','success',f'profile:{p.id}',a[0].id);s.commit();return {'status':p.status,'version':n}
@app.post('/api/v1/me/profile/publish')
def publish_profile(r:Request,a=Depends(csrf),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 consent=s.scalar(select(Consent).where(Consent.user_id==a[0].id,Consent.consent_type=='public_share'))
 if not p or p.status!='confirmed' or not consent or not consent.granted:raise HTTPException(403,'confirmed profile and public-share consent required')
 p.status='published';p.public_slug=p.public_slug or uuid4().hex;p.published_at=now();audit(s,r,'profile.publish','success',f'profile:{p.id}',a[0].id);s.commit();return {'slug':p.public_slug,'status':p.status}
@app.post('/api/v1/me/profile/withdraw')
def withdraw_profile(r:Request,a=Depends(csrf),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 if not p:raise HTTPException(404,'profile not found')
 p.status='confirmed';p.public_slug=None;p.published_at=None;audit(s,r,'profile.withdraw','success',f'profile:{p.id}',a[0].id);s.commit();return {'status':p.status}
@app.get('/api/v1/public/profiles/{slug}')
def public_profile(slug:str,s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.public_slug==slug,Profile.status=='published'))
 if not p:raise HTTPException(404,'profile not found')
 c=p.content_json or {}; return {'display_name':p.display_name,'headline':c.get('headline'),'skills':c.get('skills',[]),'services':c.get('services',[]),'updated_at':p.updated_at}

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
 if row.work_years is not None and ((query.work_years_min is not None and row.work_years>=query.work_years_min) or (query.work_years_max is not None and row.work_years<=query.work_years_max)):reasons.append({'field':'work_years','value':row.work_years,'expanded':False})
 if query.keywords and any(term in normalized(row.search_text) for term in expand_synonym(query.keywords)):reasons.append({'field':'capability','value':normalized(query.keywords),'expanded':False})
 return reasons
def candidate_card(row,reasons):
 return {'candidate_ref':row.candidate_ref,'display_name':row.display_name,'headline':row.headline,'skills':row.skills or [],'industries':row.industries or [],'location':row.location,'service_regions':row.service_regions or [],'work_modes':row.work_modes or [],'work_years':row.work_years,'project_summaries':row.project_summaries or [],'match_reasons':reasons}
@app.post('/api/v1/organizations/{oid}/talent-search')
def talent_search(oid:UUID,x:TalentSearchIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 member=active_membership(oid,a[0].id,s);organization=s.get(Organization,oid)
 if not member:
  audit(s,r,'talent_search','denied','organization',a[0].id);s.commit();raise HTTPException(404,'resource not found')
 if not organization or organization.status!='approved':
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
 # Order before pagination. Do not re-sort this bounded SQL page in Python: doing
 # so changes the global order and can duplicate candidates across pages.
 rows=s.scalars(stmt.order_by(CandidateSearchProjection.indexed_at.asc(),CandidateSearchProjection.profile_id.asc()).offset((x.page-1)*x.page_size).limit(x.page_size+1)).all();ranked=[]
 for row in rows:
  reasons=search_reasons(row,x)
  if reasons:ranked.append((len(reasons),row,reasons))
 window=ranked[:x.page_size];payload={'items':[candidate_card(row,reasons) for _,row,reasons in window],'page':x.page,'page_size':x.page_size,'has_more':len(ranked)>x.page_size}
 query_hash=hashlib.sha256(json.dumps(x.model_dump(),sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:16];audit(s,r,'talent_search','success',f'organization:{oid}',a[0].id,{'query_hash':query_hash,'result_bucket':'0' if not ranked else '1-10' if len(ranked)<=10 else '11+','page':x.page});s.commit();return payload
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
