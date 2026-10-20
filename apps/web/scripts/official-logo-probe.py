#!/usr/bin/env python3
import concurrent.futures,urllib.request,urllib.parse,html.parser,json,ssl,hashlib,re
COMPANIES=[
("Anduril","anduril.com"),("Airwallex","airwallex.com"),("Harvey","harvey.ai"),
("Flexport","flexport.com"),("Form Energy","formenergy.com"),("Ramp","ramp.com"),
("Twilio","twilio.com"),("Cohere","cohere.com"),("Mercor","mercor.com"),
("Cognition","cognition.ai"),("Headway","headway.co"),("ShopBack","shopback.com"),
("Vanta","vanta.com"),("Ashby","ashbyhq.com"),
("AlphaSights Campus Recruiting","alphasights.com"),("General Robotics","generalrobotics.company"),
("SpaceX Global","spacex.com")]
class Icons(html.parser.HTMLParser):
 def __init__(self):super().__init__();self.icons=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=="link" and ("icon" in a.get("rel","").lower() or a.get("rel","") in ("shortcut icon","apple-touch-icon")) and a.get("href"):
   self.icons.append((a.get("rel",""),a.get("href",""),a.get("sizes",""),a.get("type","")))
def get(url,maxlen=120000):
 req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (HHBA brand-source evidence inspection)","Accept":"image/avif,image/webp,image/svg+xml,image/png,image/*,*/*;q=0.8"})
 with urllib.request.urlopen(req,timeout=15) as r:
  data=r.read(maxlen+1)
  return (r.status,r.geturl(),r.headers.get("content-type",""),len(data),data[:1000])
def probe(item):
 name,domain=item;root="https://"+domain+"/"
 results=[]
 for site in [root,"https://www."+domain+"/"]:
  try:
   req=urllib.request.Request(site,headers={"User-Agent":"Mozilla/5.0"})
   with urllib.request.urlopen(req,timeout=14) as r:
    body=r.read(350000).decode("utf-8","ignore");url=r.geturl()
   icons=Icons();icons.feed(body)
   results.append({"site":site,"actual":url,"htmlTitle":re.search(r"<title[^>]*>(.*?)</title>",body,re.S|re.I).group(1)[:130] if re.search(r"<title[^>]*>(.*?)</title>",body,re.S|re.I) else "",
     "links":[{"rel":rel,"url":urllib.parse.urljoin(url,href),"sizes":size,"type":typ} for rel,href,size,typ in icons.icons[:14]]})
   break
  except Exception as e: results.append({"site":site,"error":str(e)[:140]})
 urls=[]
 if results and results[-1].get("links"):
  for o in results[-1]["links"]:
   href=o["url"]
   host=urllib.parse.urlsplit(href).hostname or ""
   if host==domain or host.endswith("."+domain) or host.startswith("www."):
    if href not in urls:urls.append(href)
 urls.extend("https://"+domain+x for x in ("/favicon.ico","/favicon.svg","/apple-touch-icon.png","/favicon-32x32.png"))
 for u in urls[:12]:
  try:
   status,target,mime,n,sample=get(u)
   if status==200 and n>80 and ("image/" in mime or "svg" in mime or sample.startswith((b"\x89PNG",b"\x00\x00\x01\x00",b"<svg"))):
    results.append({"iconSource":u,"actual":target,"type":mime,"bytes":n,
     "header":repr(sample[:24]),"shaPrefix":hashlib.sha256(sample).hexdigest()[:12]})
  except Exception:pass
 return name,domain,results
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 for name,domain,result in pool.map(probe,COMPANIES):
  print("HHBA_OFFICIAL_LOGO_PROBE",json.dumps({"company":name,"domain":domain,"observations":result},ensure_ascii=False),flush=True)
