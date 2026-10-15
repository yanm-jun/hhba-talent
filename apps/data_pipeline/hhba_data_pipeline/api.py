"""Read-only recruitment data API; mount only behind HHBA's existing auth gateway."""
from fastapi import FastAPI, Query
from sqlalchemy import create_engine, text
import os
app=FastAPI(title='HHBA A-share recruitment data API',version='0.1')
def engine():
    url=os.environ.get('RECRUITMENT_DATABASE_URL') or os.environ.get('DATABASE_URL')
    if not url: raise RuntimeError('RECRUITMENT_DATABASE_URL is required')
    return create_engine(url.replace('postgresql://','postgresql+psycopg://',1),pool_pre_ping=True)
@app.get('/healthz')
def health(): return {'status':'ok','service':'recruitment-data-api'}
@app.get('/jobs')
def jobs(q: str|None=None, city: str|None=None, status: str='active', limit: int=Query(50,ge=1,le=200), offset: int=Query(0,ge=0)):
    clauses=['j.status=:status']; params={'status':status,'limit':limit,'offset':offset}
    if q: clauses.append('j.title ILIKE :q'); params['q']=f'%{q}%'
    if city: clauses.append('j.city=:city'); params['city']=city
    where=' AND '.join(clauses)
    sql=text(f'''SELECT j.id,j.title,j.standard_title,j.city,j.category,j.recruitment_type,j.status,j.application_url,j.official_notice_url,h.legal_name,c.stock_code,c.security_name
      FROM job_postings j JOIN hiring_entities h ON h.id=j.hiring_entity_id JOIN listed_companies c ON c.id=h.listed_company_id
      WHERE {where} ORDER BY j.id LIMIT :limit OFFSET :offset''')
    with engine().connect() as conn: return {'items':[dict(x._mapping) for x in conn.execute(sql,params)],'limit':limit,'offset':offset}
