"""Phase 1 identity, organization, consent and audit API."""
import hashlib, os, secrets
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from fastapi import FastAPI, Depends, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash
from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
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
 __tablename__='consents'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id')); consent_type: Mapped[str]=mapped_column(String(64)); granted: Mapped[bool]=mapped_column(Boolean,default=False); changed_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class Audit(Base):
 __tablename__='audit_events'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); occurred_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now); actor_id: Mapped[UUID|None]=mapped_column(ForeignKey('users.id')); action: Mapped[str]=mapped_column(String(120)); outcome: Mapped[str]=mapped_column(String(32)); resource: Mapped[str]=mapped_column(String(100)); request_id: Mapped[str]=mapped_column(String(64)); metadata_redacted: Mapped[dict]=mapped_column(JSON,default=dict)
class Resume(Base):
 __tablename__='resumes'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); owner_user_id: Mapped[UUID]=mapped_column(ForeignKey('users.id')); storage_key: Mapped[str]=mapped_column(String(255),unique=True); original_filename: Mapped[str]=mapped_column(String(255)); mime_type: Mapped[str]=mapped_column(String(100)); size_bytes: Mapped[int]=mapped_column(); sha256: Mapped[str]=mapped_column(String(64)); status: Mapped[str]=mapped_column(String(32)); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class ParseJob(Base):
 __tablename__='parsing_jobs'; id: Mapped[UUID]=mapped_column(primary_key=True,default=uuid4); resume_id: Mapped[UUID]=mapped_column(ForeignKey('resumes.id')); state: Mapped[str]=mapped_column(String(32)); error_code: Mapped[str|None]=mapped_column(String(64)); error_safe_message: Mapped[str|None]=mapped_column(String(300)); result_json: Mapped[dict|None]=mapped_column(JSON); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now); updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
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
DATABASE_URL=os.getenv('DATABASE_URL','postgresql+psycopg://hhba_app:CHANGE_ME_LOCAL_ONLY@127.0.0.1:5432/hhba_dev')
if DATABASE_URL.startswith('postgresql://'):DATABASE_URL='postgresql+psycopg://'+DATABASE_URL.removeprefix('postgresql://')
engine=create_engine(DATABASE_URL,pool_pre_ping=True); SessionLocal=sessionmaker(bind=engine,expire_on_commit=False); pwd=PasswordHash.recommended(); app=FastAPI(title='HHBA API',version='0.1.0')
app.add_middleware(CORSMiddleware,allow_origins=['http://127.0.0.1:3000','http://127.0.0.1:5173'],allow_credentials=True,allow_methods=['GET','POST','PUT','PATCH','DELETE'],allow_headers=['Content-Type','X-CSRF-Token'])
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
 return {'id':str(a[0].id),'email':a[0].email,'display_name':a[0].name,'role':a[0].role}
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
 c=s.scalar(select(Consent).where(Consent.user_id==a[0].id,Consent.consent_type==typ)) or Consent(user_id=a[0].id,consent_type=typ);c.granted=x.granted;c.changed_at=now();s.add(c)
 if typ=='public_share' and not x.granted:
  p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
  if p:p.status='confirmed';p.public_slug=None;p.published_at=None
 audit(s,r,'consent.change','success',f'consent:{typ}',a[0].id,{'granted':x.granted});s.commit();return {'consent_type':typ,'granted':x.granted}
@app.get('/api/v1/admin/audit-events')
def events(a=Depends(auth),s:Session=Depends(db)):
 if a[0].role!='admin':raise HTTPException(403,'administrator role required')
 return {'events':[{'action':e.action,'outcome':e.outcome,'resource':e.resource} for e in s.scalars(select(Audit))]}
UPLOAD_ROOT=os.path.abspath(os.getenv('HHBA_UPLOAD_ROOT','./private_uploads'))
@app.post('/api/v1/me/resumes',status_code=201)
async def upload_resume(r:Request,file:UploadFile=File(...),a=Depends(csrf),s:Session=Depends(db)):
 name=os.path.basename(file.filename or ''); ext=os.path.splitext(name)[1].lower(); data=await file.read()
 if ext not in {'.pdf','.docx'} or len(data)==0 or len(data)>10*1024*1024: raise HTTPException(422,'unsupported or oversized document')
 if (ext=='.pdf' and not data.startswith(b'%PDF-')) or (ext=='.docx' and not data.startswith(b'PK')): raise HTTPException(422,'file signature does not match extension')
 os.makedirs(UPLOAD_ROOT,exist_ok=True); key=uuid4().hex+ext; path=os.path.join(UPLOAD_ROOT,key); open(path,'wb').write(data)
 resume=Resume(owner_user_id=a[0].id,storage_key=key,original_filename=name,mime_type='application/pdf' if ext=='.pdf' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size_bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),status='uploaded');s.add(resume);s.flush();job=ParseJob(resume_id=resume.id,state='uploaded');s.add(job);audit(s,r,'resume.upload','success',f'resume:{resume.id}',a[0].id);s.commit();return {'resume_id':str(resume.id),'job_id':str(job.id),'state':'uploaded'}
@app.get('/api/v1/me/resumes/{rid}')
def resume_status(rid:UUID,a=Depends(auth),s:Session=Depends(db)):
 x=s.get(Resume,rid)
 if not x or x.owner_user_id!=a[0].id:raise HTTPException(404,'resource not found')
 j=s.scalar(select(ParseJob).where(ParseJob.resume_id==rid));return {'resume_id':str(x.id),'filename':x.original_filename,'status':x.status,'job_state':j.state if j else None}
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
 j=s.scalar(select(ParseJob).where(ParseJob.resume_id==rid));j.state='processing';s.flush()
 try:
  from docling.document_converter import DocumentConverter
  timeout_seconds=int(os.getenv('HHBA_PARSE_TIMEOUT_SECONDS','120'))
  worker=ThreadPoolExecutor(max_workers=1)
  future=worker.submit(lambda:DocumentConverter().convert(os.path.join(UPLOAD_ROOT,x.storage_key)))
  try: result=future.result(timeout=timeout_seconds)
  finally: worker.shutdown(wait=False,cancel_futures=True)
  text=result.document.export_to_markdown()[:200000]
  # Rules only: no external model, no invented values. Every extracted value preserves source evidence.
  lines=[line.strip() for line in text.splitlines() if line.strip()]
  skills=[line[2:].strip() for line in lines if line.lower().startswith(('- python','- java','- react','- sql'))][:30]
  j.state='parsed';j.result_json={'raw_text_excerpt':text[:12000],'display_name':{'value':None,'status':'needs_confirmation'},'skills':[{'value':v,'evidence':v,'status':'needs_confirmation'} for v in skills],'experiences':[],'education':[],'source':'docling_local'};x.status='parsed';audit(s,r,'resume.parse','success',f'resume:{rid}',a[0].id)
 except FuturesTimeout:
  j.state='failed';j.error_code='PARSE_TIMEOUT';j.error_safe_message='本地解析超时，可稍后受控重试。';x.status='failed';audit(s,r,'resume.parse','failed',f'resume:{rid}',a[0].id,{'error_type':'timeout'})
 except Exception as exc:
  j.state='failed';j.error_code='LOCAL_PARSE_FAILED';j.error_safe_message='本地解析未完成，可在资源检查后重试。';x.status='failed';audit(s,r,'resume.parse','failed',f'resume:{rid}',a[0].id,{'error_type':type(exc).__name__})
 j.updated_at=now();s.commit();return {'job_id':str(j.id),'state':j.state,'result':j.result_json if j.state=='parsed' else None,'error':j.error_safe_message}
@app.post('/api/v1/me/resumes/{rid}/retry-parse')
def retry_parse(rid:UUID,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 x=s.get(Resume,rid)
 if not x or x.owner_user_id!=a[0].id:raise HTTPException(404,'resource not found')
 old=s.scalar(select(ParseJob).where(ParseJob.resume_id==rid))
 if old and old.state not in {'failed','uploaded'}:raise HTTPException(409,'parsing task is not retryable')
 if old:old.state='uploaded';old.error_code=None;old.error_safe_message=None;old.result_json=None;old.updated_at=now()
 audit(s,r,'resume.parse.retry','success',f'resume:{rid}',a[0].id);s.commit();return {'resume_id':str(rid),'state':'uploaded'}
@app.post('/api/v1/me/parsing-jobs/{jid}/apply-draft')
def apply_parse_draft(jid:UUID,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 j=s.get(ParseJob,jid)
 resume=s.get(Resume,j.resume_id) if j else None
 if not j or not resume or resume.owner_user_id!=a[0].id or j.state!='parsed':raise HTTPException(404,'resource not found')
 result=j.result_json or {};content={'headline':'待用户确认','skills':[x.get('value') for x in result.get('skills',[]) if x.get('value')],'experiences':result.get('experiences',[]),'education':result.get('education',[]),'projects':[],'services':[],'source_evidence':result.get('raw_text_excerpt','')[:4000]}
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id)) or Profile(owner_user_id=a[0].id);p.content_json=content;p.display_name=None;p.status='draft';p.updated_at=now();s.add(p);audit(s,r,'profile.apply_parse_draft','success',f'parse_job:{jid}',a[0].id);s.commit();return {'status':'draft','profile':content}
@app.delete('/api/v1/me/resumes/{rid}')
def delete_resume(rid:UUID,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 x=s.get(Resume,rid)
 if not x or x.owner_user_id!=a[0].id:raise HTTPException(404,'resource not found')
 p=os.path.join(UPLOAD_ROOT,x.storage_key)
 if os.path.isfile(p):os.remove(p)
 s.delete(x);audit(s,r,'resume.delete','success',f'resume:{rid}',a[0].id);s.commit();return {'deleted':True}
class ProfileIn(BaseModel): content:dict; display_name:str|None=None
class DetailIn(BaseModel): items:list[dict]
@app.get('/api/v1/me/profile')
def my_profile(a=Depends(auth),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id));return {'profile':None if not p else {'id':str(p.id),'status':p.status,'content':p.content_json,'public_slug':p.public_slug}}
@app.put('/api/v1/me/profile')
def save_profile(x:ProfileIn,r:Request,a=Depends(csrf),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id)) or Profile(owner_user_id=a[0].id);p.content_json=x.content;p.display_name=x.display_name;p.status='draft';s.add(p);audit(s,r,'profile.save','success','profile',a[0].id);s.commit();return {'status':'draft'}
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
 p.status='draft';audit(s,r,'profile.details.replace','success',f'profile:{p.id}',a[0].id,{'kind':kind});s.commit();return {'count':len(x.items),'status':'draft'}
@app.post('/api/v1/me/profile/confirm')
def confirm_profile(r:Request,a=Depends(csrf),s:Session=Depends(db)):
 p=s.scalar(select(Profile).where(Profile.owner_user_id==a[0].id))
 if not p:raise HTTPException(404,'profile not found')
 n=s.query(ProfileVersion).filter_by(profile_id=p.id).count()+1;s.add(ProfileVersion(profile_id=p.id,version=n,content_json=p.content_json));p.status='confirmed';p.updated_at=now();audit(s,r,'profile.confirm','success',f'profile:{p.id}',a[0].id);s.commit();return {'status':p.status,'version':n}
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
