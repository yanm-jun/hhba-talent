from __future__ import annotations
import argparse,csv,hashlib,json,re,time
from datetime import datetime,timezone
from pathlib import Path
import httpx
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/'data'/'a_share'; OUT.mkdir(parents=True,exist_ok=True)
SOURCES={'SSE':'https://www.sse.com.cn/assortment/stock/list/','SZSE':'https://www.szse.cn/disclosure/notice/company/index.html','BSE':'https://www.bse.cn/nq/listedcompany.html'}
UA='HHBA-A-Share-Research/0.1 (public-data; contact project owner)'
def fetch(url):
    with httpx.Client(timeout=25,follow_redirects=True,headers={'User-Agent':UA}) as c:
        r=c.get(url); r.raise_for_status(); return r
def rows(html,exchange):
    out=[]
    for tr in BeautifulSoup(html,'lxml').select('tr'):
        cells=[' '.join(x.get_text(' ',strip=True).split()) for x in tr.select('th,td')]
        m=next((re.search(r'\b(?:00|30|60|68|43|87|88)\d{4}\b',x) for x in cells if re.search(r'\b(?:00|30|60|68|43|87|88)\d{4}\b',x)),None)
        if m and len(cells)>1: out.append({'stock_code':m.group(0),'security_name':cells[1] if cells[0]==m.group(0) else cells[0],'exchange':exchange})
    return out
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--scope',default='exchanges'); ap.add_argument('--dry-run',action='store_true'); a=ap.parse_args()
    run={'started_at':datetime.now(timezone.utc).isoformat(),'scope':a.scope,'sources':{},'companies':[],'errors':[]}
    for ex,url in SOURCES.items():
        try:
            r=fetch(url); digest=hashlib.sha256(r.content).hexdigest(); stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'); fn=OUT/f'{ex.lower()}_official_snapshot_{stamp}.html'; fn.write_bytes(r.content); found=rows(r.text,ex)
            run['sources'][ex]={'url':url,'status':r.status_code,'bytes':len(r.content),'sha256':digest,'snapshot':str(fn),'rows_extracted':len(found)}; run['companies']+=found
        except Exception as e: run['sources'][ex]={'url':url,'status':'error','error':type(e).__name__+': '+str(e)[:240]}; run['errors'].append({'exchange':ex,'url':url,'error':str(e)[:500]})
        time.sleep(1)
    fields=['stock_code','security_name','exchange','source_url','retrieved_at','source_sha256']; now=datetime.now(timezone.utc).isoformat()
    with (OUT/'listed_companies.csv').open('w',newline='',encoding='utf-8-sig') as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader()
        for x in run['companies']:
            s=run['sources'].get(x['exchange'],{}); w.writerow({**x,'source_url':s.get('url',''),'retrieved_at':now,'source_sha256':s.get('sha256','')})
    run['finished_at']=datetime.now(timezone.utc).isoformat(); (OUT/'latest_run.json').write_text(json.dumps(run,ensure_ascii=False,indent=2),encoding='utf-8'); print(json.dumps({'sources':run['sources'],'companies_extracted':len(run['companies']),'errors':len(run['errors']),'output':str(OUT)},ensure_ascii=False))
if __name__=='__main__': main()
