#!/usr/bin/env python3
"""Selective 3-way import of HHBA Employer Factory V2 into the preserved unified site.

Destination must be a new integration branch based on the unified release branch.
Conflicting changes always stop the pipeline; NEVER overwrite the baseline wholesale.
No network call or production deployment is performed by this script.
"""
import pathlib, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parents[3]
BASE_REF="0016a2ce8be492bfe6ae823c817fa6b8d0211b92"  # pinned reviewed unified baseline, not a moving branch tip
SOURCE_REF="origin/fix/search-actual-published-urls-20261030"
def git(*args, check=True):
 p=subprocess.run(["git",*args],cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode and check: raise RuntimeError(f"git {args}: {p.stderr[:600]}")
 return p
def blob(ref,path):
 # Git blob SHA is sufficient for binary assets, without decoding image bytes.
 if path.startswith("apps/web/public/"):
  r=git("rev-parse","--verify",f"{ref}:{path}",check=False)
  return r.stdout.strip() if r.returncode==0 else None
 r=git("show",f"{ref}:{path}",check=False)
 return r.stdout if r.returncode==0 else None
def write(path,contents):
 target=ROOT/path
 target.parent.mkdir(parents=True,exist_ok=True)
 target.write_text(contents,encoding="utf8")
def is_text(path):
 return path.startswith("apps/web/src/") or path.startswith("apps/web/scripts/")
def allowed(path):
 # Only import reviewed V2 employer pages, source-backed company data and
 # the precise search/brand/job-data plumbing required to render them.
 if path.startswith("apps/web/src/data/employerProfiles/"): return True
 if path.startswith("apps/web/public/images/employer-profiles/"): return True
 if any(path.startswith("apps/web/public/images/"+folder+"/") for folder in ["anker-user","boyu-user","laifen-user","shkp-user"]): return True
 if path=="apps/web/public/images/autumn-real-logos/cn-autumn-008.svg": return True
 if path.startswith("apps/web/scripts/factory-v2-"): return True
 if path in [
 "apps/web/scripts/employer-factory-check.mjs",
 "apps/web/scripts/company-brand-unified.contract.test.mjs",
 "apps/web/scripts/company-single-char-search.contract.test.mjs",
 "apps/web/scripts/domestic-rebuild-v2.contract.test.mjs",
 "apps/web/scripts/all-company-major-chips.contract.test.mjs",
 "apps/web/scripts/major-company-job-flow.contract.test.mjs",
 "apps/web/src/data/domesticAnker2027OfficialRoles20261030.json",
 "apps/web/src/data/domesticBoyu2026OfficialSchoolRoles20261030.json",
 "apps/web/src/data/domesticLaifenSourcedRoles20261030.json",
 "apps/web/src/data/domesticShkp2026SourcedRoles20261030.json",
 "apps/web/src/components/AutumnCompanyBrand.tsx",
 "apps/web/src/components/DomesticBrandMark.tsx",
 "apps/web/src/components/DomesticCompanyResults.tsx",
 "apps/web/src/components/EmployerBrandLogo.tsx",
 "apps/web/src/components/HomeCompanyMarquee.tsx",
 "apps/web/src/components/UnifiedJobMarket.tsx",
 "apps/web/src/main.tsx","apps/web/src/router.tsx",
 "apps/web/src/services/domesticCompanyBrand.ts",
 "apps/web/src/services/domesticCompanySearch.ts",
 "apps/web/src/services/domesticRebuildJobs.ts",
 "apps/web/src/services/employerProfiles.ts",
 "apps/web/src/services/liveRecruitment.ts",
 "apps/web/src/pages/AnkerCompactProfilePage.tsx",
 "apps/web/src/pages/BoyuCompactProfilePage.tsx",
 "apps/web/src/pages/ConfiguredEmployerProfilePage.tsx",
 "apps/web/src/pages/LaifenCompactProfilePage.tsx",
 "apps/web/src/pages/ShkpCompactProfilePage.tsx",
 "apps/web/src/styles/kpmg-compact-profile.css",
 ]:return True
 return False
def main():
 branch=git("branch","--show-current").stdout.strip()
 if branch!="feat/integrate-employer-v2-into-unified-20261030":
  raise RuntimeError("Integration is allowed ONLY on its review branch")
 current=git("rev-parse","HEAD").stdout.strip()
 dest=git("rev-parse",BASE_REF).stdout.strip()
 if current!=dest and not git("merge-base","--is-ancestor",dest,current,check=False).returncode==0:
  raise RuntimeError("Integration branch is not based on preserved release SHA")
 ancestor=git("merge-base",BASE_REF,SOURCE_REF).stdout.strip()
 changed=git("diff","--name-only",f"{ancestor}..{SOURCE_REF}").stdout.splitlines()
 eligible=[p for p in changed if allowed(p) and blob(SOURCE_REF,p) is not None]
 if not eligible:raise RuntimeError("No V2 files selected")
 conflicts=[]
 merged=[];added=[];preserved=[]
 for path in eligible:
  src=blob(SOURCE_REF,path)
  existing=blob("HEAD",path)
  base=blob(ancestor,path)
   # These files were independently extended for the same employer in both
  # branches. The V2 versions are proven supersets (Anker plus Laifen/SHKP/Boyu
  # and 15 sourced employer dossiers); retain the release-only route below.
  source_wins={
   "apps/web/src/services/domesticRebuildJobs.ts",
   "apps/web/src/services/liveRecruitment.ts",
   "apps/web/src/components/EmployerBrandLogo.tsx",
   "apps/web/src/pages/AnkerCompactProfilePage.tsx",
   "apps/web/scripts/all-company-major-chips.contract.test.mjs",
   "apps/web/scripts/domestic-rebuild-v2.contract.test.mjs",
   "apps/web/scripts/major-company-job-flow.contract.test.mjs",
  }
  if path in source_wins:
   git("restore","--source",SOURCE_REF,"--",path)
   merged.append(path);continue
  # Preserve the full mainline app (including Talent Service), adding only the
  # reviewed V2 company routes and imports. Never restore V2 main.tsx as a whole.
  if path=="apps/web/src/main.tsx":
   if existing is None:raise RuntimeError("Missing original full-site entrypoint")
   target=existing
   after="import { AnkerCompactProfilePage } from './pages/AnkerCompactProfilePage';"
   more="""import { LaifenCompactProfilePage } from './pages/LaifenCompactProfilePage';
 import { ShkpCompactProfilePage } from './pages/ShkpCompactProfilePage';
 import { BoyuCompactProfilePage } from './pages/BoyuCompactProfilePage';
 import { ConfiguredEmployerProfilePage } from './pages/ConfiguredEmployerProfilePage';
 import { employerProfileById } from './services/employerProfiles';"""
   if after not in target:raise RuntimeError("Release Anker import moved; review manually")
   if "ConfiguredEmployerProfilePage" not in target:
    target=target.replace(after,after+"\n"+more,1)
   anchor="if(/^\\/companies\\/autumn\\/cn-autumn-[0-9]{3}$/.test(route))return <AutumnCompanyProfilePage user={user} id={route.split('/').pop()!}/>;"
   routes="""if(route==='/companies/autumn/cn-autumn-009')return <LaifenCompactProfilePage user={user}/>;
 if(route==='/companies/autumn/cn-autumn-010')return <ShkpCompactProfilePage user={user}/>;
 if(/^\\/companies\\/autumn\\/cn-autumn-[0-9]{3}$/.test(route)&&employerProfileById.has(route.split('/').pop()!))return <ConfiguredEmployerProfilePage user={user} id={route.split('/').pop()!}/>;
 if(route==='/companies/autumn/cn-autumn-011')return <BoyuCompactProfilePage user={user}/>;"""
   if anchor not in target:raise RuntimeError("Release autumn fallback route moved; review manually")
   target=target.replace(anchor,routes+anchor,1)
   assert "TalentServicePage" in target, "Must retain full mainline Talent Service"
   write(path,target);merged.append(path);continue
  if existing==src:preserved.append(path);continue
  if existing is None or existing==base:
   # Git checkout handles media binary files and freshly added JSON, CSS, TS.
   git("restore","--source",SOURCE_REF,"--",path)
   added.append(path);continue
  if src==base:
   preserved.append(path);continue
  if not is_text(path):
   conflicts.append(path+" (binary: both sides changed)");continue
  import tempfile
  with tempfile.TemporaryDirectory() as tmp:
   names=[pathlib.Path(tmp)/x for x in ["current","ancestor","incoming"]]
   for fn,data in zip(names,[existing,base or "",src]):fn.write_text(data,encoding="utf8")
   p=git("merge-file","-p","--diff3","-L","UNIFIED_RELEASE","-L","SHARED_BASE","-L","EMPLOYER_V2",*[str(x) for x in names],check=False)
   if p.returncode:
    conflicts.append(path+" (three-way merge conflict)")
    print("MERGE_CONFLICT",path,p.stdout[:2800],file=sys.stderr)
    continue
   write(path,p.stdout);merged.append(path)
 if conflicts:
  raise RuntimeError("Manual review needed before commit: "+", ".join(conflicts))
 print("HHBA_INTEGRATION_SELECTIVE_IMPORT_PASS",{
 "source":SOURCE_REF,"baseline":BASE_REF,"merge_base":ancestor,
 "imported":len(added),"merged_nonconflicting":len(merged),"unchanged":len(preserved),
 "profile_count":len(list((ROOT/"apps/web/src/data/employerProfiles").glob("cn-autumn-*.json")))
 })
 git("add","--","apps/web/src","apps/web/public/images","apps/web/scripts")
 print(git("status","--short").stdout[:18000])
if __name__=="__main__":main()
