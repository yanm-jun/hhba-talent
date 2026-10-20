#!/usr/bin/env python3
"""Append ONLY provenance-supported employer marks to HHBA's existing published registry.

The ATS recruitment board identity is explicit, separate from the visual asset origin.
The mark is copied verbatim from an official website or sourced upstream at pinned SHA.
ICO is converted losslessly to PNG (never redrawn); source hash is retained separately.
"""
import hashlib,json,pathlib,re,urllib.request,urllib.parse,xml.etree.ElementTree as ET,io
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"public/brands"
REGISTER=ROOT/"src/data/verifiedBrandAssets.json"
PROOF=OUT/"PROVENANCE.json"
UPSTREAM="c71c69e3a27e4436936b831c72643e6513b9f49b"
# (employer name, ATS, board slug, Simple Icons slug, exact first-party source domain)
SIMPLE=[
 ("Gusto","greenhouse","gusto","gusto","gusto.com"),
 ("Deepgram","ashby","deepgram","deepgram","deepgram.com"),
 ("ClickUp","ashby","clickup","clickup","clickup.com"),
 ("Greenhouse","greenhouse","greenhouse","greenhouse","greenhouse.io"),
 ("Binance","lever","binance","binance","binance.com"),
]
# (company, ATS, board, declared original icon URL, first-party company page,
#  origin policy: "company" means first-party asset, "websitefiles" means exact
#  link must appear within fetched first-party company HTML.)
OFFICIAL=[
 ("Anduril","greenhouse","andurilindustries","https://www.anduril.com/assets/favicon/apple-touch-icon.xxx1TpF2gg.png","https://www.anduril.com/","company"),
 ("Airwallex","ashby","airwallex","https://grw-landing.airwallex.com/favicon.ico","https://www.airwallex.com/en-us","company"),
 ("Harvey","ashby","harvey","https://www.harvey.ai/icons/brand-favicon.png","https://www.harvey.ai/","company"),
 ("Flexport","greenhouse","flexport","https://www.flexport.com/favicon.svg","https://www.flexport.com/","company"),
 ("Form Energy","ashby","formenergy","https://formenergy.com/wp-content/uploads/2021/04/cropped-Form-favicon-1-192x192.png","https://formenergy.com/","company"),
 ("Ramp","ashby","ramp","https://ramp.com/apple-touch-icon.png","https://ramp.com/","company"),
 ("Twilio","greenhouse","twilio","https://www.twilio.com/content/dam/twilio-com/core-assets/social/apple-touch-icon.png","https://www.twilio.com/en-us","company"),
 ("Cohere","ashby","cohere","https://cohere.com/apple-touch-icon.png","https://cohere.com/","company"),
 ("Mercor","ashby","mercor","https://www.mercor.com/favicon.png","https://www.mercor.com/","company"),
 ("Cognition","ashby","cognition","https://cognition.com/apple-icon.png?apple-icon.3ldv32hvdcixr.png","https://cognition.com/","company"),
 ("ShopBack","lever","shopback-2","https://www.shopback.com/favicon.ico","https://www.shopback.com/","company"),
 ("Vanta","ashby","vanta","https://cdn.prod.website-files.com/64009032676f24f376f002fc/6a8611e0bb23845c59b54179_ilma-favicon.png","https://www.vanta.com/","websitefiles"),
 ("Ashby","ashby","ashby","https://www.ashbyhq.com/icon.png","https://www.ashbyhq.com/","company"),
 ("AlphaSights Campus Recruiting","greenhouse","alphasightsresumedrop","https://www.alphasights.com/apple-touch-icon.png","https://www.alphasights.com/","company"),
 ("General Robotics","ashby","generalrobotics","https://cdn.prod.website-files.com/6aa0328c48614f5ed0e1f130/6aa04546347fdf6c0143f12a_favicon.png","https://www.generalrobotics.company/","websitefiles"),
]
def download(url,max_size=125000):
 req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 HHBA/1.0 original-brand-resource-review"})
 with urllib.request.urlopen(req,timeout=35) as response:
  if response.status!=200:raise ValueError(f"bad source HTTP {response.status}: {url}")
  data=response.read(max_size+1)
  if len(data)>max_size:raise ValueError("oversized icon: "+url)
  return data,response.geturl(),response.headers.get("content-type","")
def official_domain_allowed(site,asset):
 domain=urllib.parse.urlsplit(site).hostname or ""
 host=urllib.parse.urlsplit(asset).hostname or ""
 if not domain or not host:return False
 root=domain[4:] if domain.startswith("www.") else domain
 return host==root or host.endswith("."+root)
def secure_svg(data):
 root=ET.fromstring(data)
 if root.tag!="{http://www.w3.org/2000/svg}svg":raise ValueError("wrong SVG root")
 if len(data)>120000:raise ValueError("oversized SVG")
 for tag in root.iter():
  if tag.tag.split("}")[-1].lower() in ("script","foreignobject","image","use","iframe","animate","set"):
   raise ValueError("executable or embedding element in brand mark")
  if any(k.split("}")[-1].lower().startswith("on") for k in tag.attrib):
   raise ValueError("executable event on SVG")
 if re.search(rb"(?i)(?:javascript:|<\?xml-stylesheet|url\(|data:|<script)",data):
  raise ValueError("external or executable SVG content")
def persist_png(data):
 if not data.startswith(b"\x89PNG\r\n\x1a\n"):raise ValueError("source PNG magic invalid")
 image=Image.open(io.BytesIO(data));image.load()
 if image.format!="PNG" or max(image.size)>2048 or min(image.size)<32:raise ValueError("invalid PNG dimensions")
 return data,image.size
def persist_ico(data):
 if not data.startswith(b"\x00\x00\x01\x00"):raise ValueError("source ICO magic invalid")
 image=Image.open(io.BytesIO(data));image.load()
 if image.format!="ICO" or max(image.size)>2048 or min(image.size)<32:raise ValueError("invalid ICO dimensions")
 temp=io.BytesIO();image.convert("RGBA").save(temp,format="PNG",optimize=True)
 return temp.getvalue(),image.size
register=json.loads(REGISTER.read_text(encoding="utf-8"))
proof=json.loads(PROOF.read_text(encoding="utf-8"))
if len(register["records"])!=28 or len(proof["records"])!=28:raise ValueError("unexpected baseline: abort")
existing={(x["company"],x["platform"],x["source"]) for x in register["records"]}
def append(company,platform,source,file,kind,byte_data,source_url,page_url,actual_url,source_sha=None,origin_note=""):
 key=company,platform,source
 if key in existing:raise ValueError(f"duplicate brand identity {key}")
 sha=hashlib.sha256(byte_data).hexdigest()
 (OUT/file).write_bytes(byte_data)
 register["records"].append({"company":company,"platform":platform,"source":source,"file":file,
  "color":"#000000","wide":False,"kind":kind})
 record={"company":company,"platform":platform,"boardSource":source,"file":file,
   "attribution":"original official website icon" if kind=="brand-site-icon" else "upstream source-traced SVG (not brand-hosted)",
   "sourceUrl":source_url,"sourcePage":page_url,"fetchedUrl":actual_url,"sha256":sha}
 if source_sha:record["unmodifiedSourceSha256"]=source_sha
 if origin_note:record["reviewNote"]=origin_note
 proof["records"].append(record)
 existing.add(key)
 print("HHBA_BRAND_ADDED",json.dumps({"company":company,"source":source,"file":file,"sha256":sha,"original":source_url}))
metadata_url=f"https://raw.githubusercontent.com/simple-icons/simple-icons/{UPSTREAM}/data/simple-icons.json"
metadata=json.loads(download(metadata_url,1_500_000)[0])
def slugname(s):return re.sub("[^a-z0-9]","",s.lower())
lookup={slugname(x["title"]):x for x in metadata}
for company,platform,source,slug,domain in SIMPLE:
 meta=lookup.get(slug)
 if not meta:raise ValueError("missing upstream brand source "+slug)
 source_url=meta.get("source","")
 host=urllib.parse.urlsplit(source_url).hostname or ""
 if not (host==domain or host.endswith("."+domain)):
  raise ValueError(f"Simple Icons source is not controlled by {company}: {source_url}")
 svgurl=f"https://raw.githubusercontent.com/simple-icons/simple-icons/{UPSTREAM}/icons/{slug}.svg"
 raw,final_url,_=download(svgurl)
 secure_svg(raw)
 append(company,platform,source,"si-"+slug+".svg","source-traced-vector",raw,source_url,
        source_url,final_url,origin_note="Exact upstream commit "+UPSTREAM+"; vector source traced to official brand page")
for company,platform,source,official_url,page,policy in OFFICIAL:
 source_data,final_url,mime=download(official_url)
 url=urllib.parse.urlsplit(official_url)
 target=urllib.parse.urlsplit(final_url)
 if url.scheme!="https" or target.scheme!="https" or target.username or target.password:
  raise ValueError("unsafe asset redirect")
 if policy=="company" and not official_domain_allowed(page,final_url):
  raise ValueError(f"asset redirected outside company web site {company}: {final_url}")
 if policy=="websitefiles":
  if target.hostname!="cdn.prod.website-files.com":raise ValueError("wrong pinned Webflow CDN")
  html,_,_=download(page,800_000)
  if official_url.encode("utf-8") not in html:
   raise ValueError(f"CDN asset not declared by official web page: {company}")
 name=re.sub("[^a-z0-9]","",company.lower())
 if source_data.lstrip().startswith((b"<svg",b"<?xml")):
  secure_svg(source_data)
  icon=source_data;extension=".svg";dim=None
 elif source_data.startswith(b"\x89PNG"):
  icon,dim=persist_png(source_data);extension=".png"
 elif source_data.startswith(b"\x00\x00\x01\x00"):
  icon,dim=persist_ico(source_data);extension=".png"
 else:raise ValueError("unrecognized image source "+company)
 raw_sha=hashlib.sha256(source_data).hexdigest()
 append(company,platform,source,"brand-"+name+extension,"brand-site-icon",icon,official_url,
   page,final_url,source_sha=raw_sha,
   origin_note=("Official site's HTML directly declares this favicon" if policy=="websitefiles"
      else "Company-controlled domain favicon; ICO is converted pixel-for-pixel to PNG if needed"))
# SpaceX's separate global recruitment board explicitly identifies the employer as SpaceX.
space=(OUT/"spacex.svg").read_bytes()
secure_svg(space)
append("SpaceX Global","greenhouse","spacexglobal","brand-spacexglobal.svg","original-source",space,
  "https://job-boards.greenhouse.io/spacexglobal","https://job-boards.greenhouse.io/spacexglobal",
  "https://job-boards.greenhouse.io/spacexglobal",
  origin_note="The official recruitment board displays the SpaceX name; visually reuses the already verified original SpaceX vector.")
if len(register["records"])!=49 or len(proof["records"])!=49:raise ValueError("batch incomplete or duplicate")
REGISTER.write_text(json.dumps(register,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
PROOF.write_text(json.dumps(proof,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("HHBA_BRAND_EXTENSION_COMPLETE",json.dumps({"before":28,"new":21,"total":len(register["records"]),
 "pending":[{"company":"Headway","reason":"Official headway.co site blocks bot access; no endorsed source asset confirmed"}]}))
