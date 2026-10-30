#!/usr/bin/env python3
"""Collect original upstream Simple Icons SVG brand marks, never redrawing them.

Safety:
 - exact company/ATS-board identity allowlist;
 - upstream repository is pinned to a verified commit;
 - each vector has upstream official-source attribution;
 - approved source hosts are per company, not guessed from logo title;
 - safe SVG/XML content, SHA-256 retained; candidate mismatch aborts;
 - no remote image or third-party-proxy requests in the published SPA.
"""
import hashlib, json, pathlib, re, urllib.request, urllib.parse, xml.etree.ElementTree as ET
UPSTREAM="c71c69e3a27e4436936b831c72643e6513b9f49b"
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"public/brands"
REGISTRY=ROOT/"src/data/verifiedBrandAssets.json"
# company, board platform, board source, upstream slug, official source root
CANDIDATES=[
 ("Stripe","greenhouse","stripe","stripe","stripe.com"),
 ("Coinbase","greenhouse","coinbase","coinbase","coinbase.com"),
 ("Airbnb","greenhouse","airbnb","airbnb","airbnb.com"),
 ("Databricks","greenhouse","databricks","databricks","databricks.com"),
 ("DoorDash","greenhouse","doordashusa","doordash","doordash.com"),
 ("Spotify","lever","spotify","spotify","spotify.com"),
 ("Canonical","greenhouse","canonical","canonical","ubuntu.com"),
 ("Palantir","lever","palantir","palantir","github.com"),
 ("Figma","greenhouse","figma","figma","figma.com"),
 ("Discord","greenhouse","discord","discord","discord.com"),
 ("Reddit","greenhouse","reddit","reddit","redditinc.com"),
 ("Airtable","greenhouse","airtable","airtable","airtable.com"),
 ("Robinhood","greenhouse","robinhood","robinhood","robinhood.com"),
 ("GitLab","greenhouse","gitlab","gitlab","gitlab.com"),
 ("Cloudflare","greenhouse","cloudflare","cloudflare","cloudflare.com"),
 ("Vercel","greenhouse","vercel","vercel","vercel.com"),
 ("Wise","greenhouse","wise","wise","wise.design"),
 ("Coursera","greenhouse","coursera","coursera","coursera.org"),
 ("Notion","ashby","notion","notion","notion.so"),
 ("Linear","ashby","linear","linear","linear.app"),
 ("Perplexity","ashby","perplexity","perplexity","perplexity.ai"),
 ("ElevenLabs","ashby","elevenlabs","elevenlabs","elevenlabs.io"),
 ("Cursor","ashby","cursor","cursor","cursor.com"),
 ("Replit","ashby","replit","replit","repl.it"),
 ("PostHog","ashby","posthog","posthog","posthog.com"),
]
def fetch(url,max_bytes=150000):
    req=urllib.request.Request(url,headers={"User-Agent":"HHBA-Verified-Brand-Registry/1.0","Accept":"application/json,image/svg+xml,*/*"})
    with urllib.request.urlopen(req,timeout=35) as rsp:
        value=rsp.read(max_bytes+1)
        if len(value)>max_bytes:raise ValueError("oversized source: "+url)
        return value
def normal(title):
    import unicodedata
    return re.sub("[^a-z0-9]","",unicodedata.normalize("NFKD",title).lower())
def source_is_official(source,root,company):
    u=urllib.parse.urlsplit(source)
    if u.scheme!="https" or not u.hostname or u.username or u.password:
        return False
    h=u.hostname.lower()
    if root=="github.com":
        return h=="github.com" and u.path.lower().startswith("/palantir/")
    # explicit sources: Canonical brand assets reside on official Ubuntu design site.
    if root=="ubuntu.com":
        return h=="design.ubuntu.com"
    # the Airbnb source and other domains use company-owned websites.
    return h==root or h.endswith("."+root)
url=f"https://raw.githubusercontent.com/simple-icons/simple-icons/{UPSTREAM}/data/simple-icons.json"
catalog=json.loads(fetch(url,max_bytes=1_500_000))
lookup={normal(x.get("title","")):x for x in catalog}
# Existing, separately verified original files stay unchanged.
original=[
 ("OpenAI","ashby","openai","openai.svg","https://cdn.openai.com/brand/OpenAI-Logos-2025.zip","7be72f1fea831d3ba81a545cee79b7e0ae69449d5d7837c9571ccbfb4aa1e00b","000000",False),
 ("Anthropic","greenhouse","anthropic","claude.svg","https://claude.com/favicon.svg","b150888bc7257af83e3b85d3c2be4294f88986026f8168f6c12fc1fde6697350","D97757",False),
 ("SpaceX","greenhouse","spacex","spacex.svg","https://commons.wikimedia.org/wiki/Special:FilePath/SpaceX_logo_black.svg","b3591eba63012760c8fef72d6387dbff3feafde97c2e6c2c6724e6e3f905d985","000000",True)
]
records=[];provenance=[]
for name,platform,source,file,site,sha,hexvalue,wide in original:
    actual=hashlib.sha256((OUT/file).read_bytes()).hexdigest()
    if actual!=sha:raise ValueError(f"existing original logo changed: {file}")
    records.append({"company":name,"platform":platform,"source":source,"file":file,
        "color":"#"+hexvalue,"wide":wide,"kind":"original-source"})
    provenance.append({"file":file,"company":name,"platform":platform,"boardSource":source,
        "attribution":"original verified asset","sourceUrl":site,"sha256":sha})
for name,platform,source,slug,officialroot in CANDIDATES:
    meta=lookup.get(slug)
    if not meta or normal(meta["title"])!=slug:
        raise ValueError("upstream icon missing or renamed: "+slug)
    if not source_is_official(meta.get("source",""),officialroot,name):
        raise ValueError(f"brand source not official for {name}: "+str(meta.get("source")))
    download=f"https://raw.githubusercontent.com/simple-icons/simple-icons/{UPSTREAM}/icons/{slug}.svg"
    svg=fetch(download,150_000)
    if len(svg)<100 or len(svg)>120_000 or b"<svg" not in svg[:500]:
        raise ValueError("invalid SVG: "+slug)
    root=ET.fromstring(svg)
    if root.tag!="{http://www.w3.org/2000/svg}svg":
        raise ValueError("wrong SVG root for "+slug)
    if any(tag.tag.split("}")[-1].lower() in ("script","foreignobject","image","use","iframe","animate","set") for tag in root.iter()):
        raise ValueError("SVG has dynamic or external nodes: "+slug)
    if re.search(rb"(?i)(?:onload|onerror|javascript:|<\?xml-stylesheet|url\(|data:)",svg):
        raise ValueError("unsafe SVG markup: "+slug)
    sha=hashlib.sha256(svg).hexdigest()
    file="si-"+slug+".svg"
    (OUT/file).write_bytes(svg) # preserve source bytes exactly
    color=meta.get("hex","")
    if not re.fullmatch(r"[0-9A-Fa-f]{6}",color):raise ValueError("missing verified brand color "+slug)
    records.append({"company":name,"platform":platform,"source":source,"file":file,
      "color":"#"+color.upper(),"wide":False,"kind":"source-traced-vector"})
    provenance.append({"file":file,"company":name,"platform":platform,
      "boardSource":source,"attribution":"Simple Icons source-traced vector, not brand-hosted original",
      "sourceUrl":meta["source"],"guidelines":meta.get("guidelines"),
      "upstreamRepo":"https://github.com/simple-icons/simple-icons",
      "upstreamCommit":UPSTREAM,"upstreamSvg":download,"sha256":sha})
if len(records)!=len(original)+len(CANDIDATES):raise ValueError("incomplete source-verified batch")
identities=[(r["company"],r["platform"],r["source"]) for r in records]
if len(set(identities))!=len(records):raise ValueError("duplicate employer identity")
REGISTRY.parent.mkdir(parents=True,exist_ok=True)
REGISTRY.write_text(json.dumps({"schemaVersion":1,"records":records},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
(OUT/"PROVENANCE.json").write_text(json.dumps({"schemaVersion":1,"sourcePolicy":"Each logo is an original file or an upstream SVG traced to a brand-controlled source; Simple Icons' CC0 source-code license does not grant trademark rights.","records":provenance},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("HHBA_VERIFIED_BRANDS_PREPARED",json.dumps({"new":len(CANDIDATES),"total":len(records),"pins":UPSTREAM}))
for row in provenance:
    if row["file"].startswith("si-"):print("HHBA_BRAND_PROOF",json.dumps({"file":row["file"],"source":row["sourceUrl"],"sha256":row["sha256"]}))
