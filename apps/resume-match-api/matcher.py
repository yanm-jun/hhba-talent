"""Private resume-to-official-jobs scoring. The LLM never invents jobs or requirements."""
from __future__ import annotations
import re
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs
from typing import Any

PLATFORMS = {"greenhouse", "lever", "ashby"}
HOSTS = {
    "greenhouse": {"boards.greenhouse.io", "boards.eu.greenhouse.io", "job-boards.greenhouse.io"},
    "ashby": {"jobs.ashbyhq.com"},
    "lever": {"jobs.lever.co", "jobs.eu.lever.co"},
}
BRANDED = {
    "stripe": ("stripe.com", "/jobs/search"),
    "coinbase": ("www.coinbase.com", "/careers/positions/"),
    "airbnb": ("careers.airbnb.com", "/positions/"),
    "databricks": ("databricks.com", "/company/careers/open-positions/job"),
}
ROLE_ALIASES = {
    "software": ("software engineer", "software developer", "backend engineer", "frontend engineer", "front-end engineer", "back-end engineer", "full stack", "fullstack", "swe", "软件", "开发工程师"),
    "sales": ("sales", "account executive", "business development", "account manager", "sales development", "销售", "业务拓展", "客户经理"),
    "product": ("product manager", "product lead", "产品经理"),
    "design": ("designer", "design", "ux", "user experience", "设计师"),
    "marketing": ("marketing", "growth", "demand generation", "市场营销", "推广"),
    "data": ("data analyst", "data science", "data scientist", "analytics engineer", "数据分析"),
    "finance": ("accountant", "accounting", "finance", "financial analyst", "财务", "会计"),
    "hr": ("human resources", "talent acquisition", "recruiter", "people operations", "人力资源", "招聘"),
    "operations": ("operations", "logistics", "supply chain", "运营", "仓储", "物流"),
    "customer": ("customer success", "customer support", "customer service", "客服", "客户服务"),
    "intern": ("internship", "intern", "实习"),
    "engineering": ("engineer", "engineering", "工程师"),
}
SKILL_SYNONYMS = {
    "javascript": ("js", "javascript"),
    "typescript": ("ts", "typescript"),
    "python": ("python",),
    "sql": ("sql",),
    "react": ("react", "reactjs", "react.js"),
    "excel": ("excel", "microsoft excel"),
    "aws": ("aws", "amazon web services"),
    "gcp": ("gcp", "google cloud"),
    "azure": ("azure",),
    "docker": ("docker",),
    "kubernetes": ("k8s", "kubernetes"),
    "java": ("java",),
    "salesforce": ("salesforce", "sfcrm"),
    "figma": ("figma",),
    "pytorch": ("pytorch",),
}
LEVEL = {"HIGH_SCHOOL": 1, "ASSOCIATE": 2, "BACHELOR": 3, "MASTER": 4, "PHD": 5}
EDUCATION_ZH = {"HIGH_SCHOOL": "高中", "ASSOCIATE": "专科", "BACHELOR": "本科", "MASTER": "硕士", "PHD": "博士", "UNRESTRICTED": "明确无学历要求"}
AUDIT_EXCLUDED = {
    "MISSING_FROM_OFFICIAL_BOARD", "OFFICIAL_URL_CHANGED",
    "OFFICIAL_SOURCE_READ_FAILED", "OFFICIAL_TITLE_CHANGED",
    "INVALID_ATS_ID_OR_URL", "DUPLICATE_JOB_ID", "INVALID_JOB_ID",
}
MAX_MATCHES = 15


def normalized(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").lower()).strip()


def has_phrase(text: str, phrase: str) -> bool:
    value = normalized(phrase)
    if not value:
        return False
    if re.fullmatch(r"[a-z0-9+.# -]+", value):
        return re.search(r"(?<![a-z0-9])" + re.escape(value) + r"(?![a-z0-9])", text) is not None
    return value in text


def role_categories(text: str) -> list[str]:
    t = normalized(text)
    result = []
    for name, aliases in ROLE_ALIASES.items():
        if any(has_phrase(t, alias) for alias in aliases):
            result.append(name)
    return result


def normalize_skill(value: str) -> str:
    t = normalized(value)
    for name, aliases in SKILL_SYNONYMS.items():
        if t == name or t in aliases:
            return name
    return t


def valid_official_url(job: dict) -> bool:
    platform, slug, value = job.get("platform"), job.get("source"), job.get("url")
    job_id = str(job.get("id") or "")
    if platform not in PLATFORMS or not isinstance(slug, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,100}", slug):
        return False
    if not job_id.startswith(f"{platform}-{slug}-"):
        return False
    try:
        u = urlparse(value)
        if u.scheme != "https" or not u.hostname or u.username or u.password or u.port or u.fragment:
            return False
        if u.hostname in HOSTS[platform] and slug in u.path.strip("/").split("/"):
            return True
        if platform != "greenhouse" or slug not in BRANDED:
            return False
        host, path = BRANDED[slug]
        native = job_id[len(f"{platform}-{slug}-"):]
        return (u.hostname == host and bool(re.fullmatch(r"[0-9]{5,20}", native))
                and (u.path.startswith(path) if path.endswith("/") else u.path == path)
                and parse_qs(u.query).get("gh_jid") == [native])
    except (ValueError, TypeError):
        return False


def profile_from_llm(raw: dict, redacted_resume: str) -> dict:
    """Reject profile assertions without verbatim source evidence. No PII fields."""
    if not isinstance(raw, dict):
        raise ValueError("PROFILE_NOT_JSON_OBJECT")
    src = normalized(redacted_resume)
    def evidence_ok(value: Any) -> bool:
        return isinstance(value, str) and 3 <= len(value) <= 220 and normalized(value) in src

    skills = []
    seen = set()
    for item in (raw.get("skills") if isinstance(raw.get("skills"), list) else [])[:35]:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if not isinstance(name, str) or len(name.strip()) > 45 or not evidence_ok(item.get("evidence")):
            continue
        skill = normalize_skill(name)
        if skill and skill not in seen:
            seen.add(skill)
            skills.append({"name": skill, "evidence": item["evidence"][:180]})

    edu = raw.get("education") if isinstance(raw.get("education"), dict) else {}
    level = edu.get("level")
    education = level if isinstance(level, str) and level in LEVEL and evidence_ok(edu.get("evidence")) else None
    years = raw.get("experience_years")
    years_ev = raw.get("experience_evidence")
    if not isinstance(years, (int, float)) or isinstance(years, bool) or not (0 <= years <= 55) or not evidence_ok(years_ev):
        years = None
    else:
        years = round(float(years), 1)

    target_roles = []
    for item in (raw.get("target_roles") if isinstance(raw.get("target_roles"), list) else [])[:8]:
        if not isinstance(item, dict) or not isinstance(item.get("role"), str) or not evidence_ok(item.get("evidence")):
            continue
        text = item["role"].strip()[:70]
        if text and text not in target_roles:
            target_roles.append(text)

    # Evidence is shown only to the owner and remains in this response; never persisted.
    return {
        "education": education,
        "education_evidence": edu.get("evidence", "")[:180] if education else None,
        "experience_years": years,
        "experience_evidence": years_ev[:180] if years is not None else None,
        "skills": skills,
        "target_roles": target_roles,
        "warnings": ["AI 提取仅供核对；缺失信息不代表你没有这项能力。"],
    }


def rank_official_jobs(profile: dict, jobs: list[dict], facets: dict[str, dict],
                       audits: dict[str, dict], *, country: str = "", remote_only: bool = False,
                       role_hint: str = "", limit: int = MAX_MATCHES) -> list[dict]:
    if country and not re.fullmatch(r"[A-Z]{2}", country):
        raise ValueError("INVALID_COUNTRY")
    if limit < 1 or limit > MAX_MATCHES:
        raise ValueError("INVALID_LIMIT")
    user_roles = set(role_categories(" ".join(profile["target_roles"] + ([role_hint] if role_hint else []))))
    user_skills = {normalize_skill(skill["name"]) for skill in profile["skills"]}
    out = []
    for j in jobs:
        if not isinstance(j, dict) or j.get("domestic") is True or not valid_official_url(j):
            continue
        evidence = audits.get(j.get("id"))
        if (not isinstance(evidence, dict)
                or evidence.get("status") not in {"OFFICIAL_JD_AND_REQUIREMENTS_FOUND", "OFFICIAL_JD_REQUIREMENTS_UNCLASSIFIED"}
                or evidence.get("full_original_jd_verified") is not True):
            continue
        f = facets.get(j["id"], {})
        if not isinstance(f, dict) or not re.fullmatch(r"[a-f0-9]{64}", str(f.get("original_source_hash") or "")):
            continue
        if f["original_source_hash"] != evidence.get("jd_sha256"):
            continue
        if country and f.get("countryCode") != country:
            continue
        if remote_only and j.get("remote") is not True:
            continue
        job_roles = set(role_categories(j.get("title")))
        if not job_roles:
            continue
        role_overlap = (job_roles & user_roles) - {"engineering"}
        job_skills = {normalize_skill(x) for x in f.get("skills", []) if isinstance(x, str)}
        overlap = sorted(user_skills & job_skills)
        discussed_not_evidenced = sorted(job_skills - user_skills)
        if not role_overlap and not overlap:
            continue

        # Scores are discovery heuristics, not selection probabilities.
        score = 28 if role_overlap else 5
        score += min(24, len(overlap) * 8)
        if user_roles and not role_overlap:
            score -= 12
        if f.get("countryCode"):
            score += 3
        matched, missing, unknown = [], [], []
        if role_overlap:
            matched.append("简历方向与岗位名称一致：" + "、".join(sorted(role_overlap)))
        if overlap:
            matched.append("简历明确出现的相关技能：" + "、".join(overlap))
        if discussed_not_evidenced:
            missing.append("岗位描述提及、但简历尚未证明的技能：" + "、".join(discussed_not_evidenced[:6])
                           + "（不一定都是硬性要求）")
        education_required = f.get("education")
        applicant_education = profile.get("education")
        if education_required in LEVEL:
            if applicant_education in LEVEL:
                if LEVEL[applicant_education] >= LEVEL[education_required]:
                    score += 12
                    matched.append(f"学历层级：简历 {EDUCATION_ZH[applicant_education]}，岗位识别为 {EDUCATION_ZH[education_required]}")
                else:
                    score -= 18
                    missing.append(f"岗位识别的学历为 {EDUCATION_ZH[education_required]}，简历仅证明 {EDUCATION_ZH[applicant_education]}，需核实原文是否允许等同经验")
            else:
                unknown.append(f"岗位识别为 {EDUCATION_ZH[education_required]}，简历的学历证据不足")
        elif education_required == "UNRESTRICTED":
            matched.append("岗位文本明确没有学历要求")
        else:
            unknown.append("官方岗位未明确识别到学历要求，不能当作不限学历")
        req_years = f.get("experienceMinYears")
        own_years = profile.get("experience_years")
        if isinstance(req_years, (float, int)) and not isinstance(req_years, bool):
            if isinstance(own_years, (float, int)) and not isinstance(own_years, bool):
                if own_years >= req_years:
                    matched.append(f"简历工作年限 {own_years:g} 年；岗位识别的最低经验 {req_years:g} 年")
                    score += 10
                else:
                    missing.append(f"岗位识别最低 {req_years:g} 年经验，简历目前能证明 {own_years:g} 年")
                    score -= 12
            else:
                unknown.append(f"岗位识别最低 {req_years:g} 年经验，简历未能证实年限")
        else:
            unknown.append("官方职位没有明确识别到最低工作年限")
        if not j.get("remote") is True:
            unknown.append("是否可以远程工作须以官网说明为准")
        unknown.append("工作签证、语言、资格证书和具体专业等条件未全面核实")
        score = max(1, min(95, score))
        out.append({
            "id": j["id"],
            "company": j.get("company") or "",
            "title": j.get("title") or "",
            "title_zh": j.get("titleZh") or None,
            "location": j.get("location") or "",
            "official_url": j["url"],
            "platform": j["platform"],
            "source": j["source"],
            "remote": j.get("remote") is True,
            "reference_score": score,
            "matched": matched,
            "not_evidenced": missing,
            "needs_verification": unknown,
            "requirements_basis": "官方 JD 提取的检索元数据，非人工认证的录用资格",
        })
    return sorted(out, key=lambda item: (-item["reference_score"], item["id"]))[:limit]
