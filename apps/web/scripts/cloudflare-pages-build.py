#!/usr/bin/env python3
"""Build HHBA Pages with the same evidence-backed media preparation as GitHub Pages.

The canonical list of preparation steps remains in hhba-github-pages-preview.yml.
Run from apps/web (Cloudflare Pages' configured root directory).
Only execute audited media-generation steps, not CI release/deploy steps.
"""
from __future__ import annotations

import os
import json
from pathlib import Path
import re
import subprocess
import shutil

import yaml

WEB = Path(__file__).resolve().parents[1]
REPO = WEB.parents[1]
WORKFLOW = REPO / ".github/workflows/hhba-github-pages-preview.yml"


def run(args: list[str] | str, *, cwd: Path, env: dict[str, str] | None = None) -> None:
    if isinstance(args, str):
        # The workflow runs on Ubuntu with 'python'. Some Pages images expose
        # only 'python3'; normalize command invocations, not script contents.
        args = re.sub(r"(?m)^(\s*)python(?=\s)", r"\1python3", args)
        cmd = ["bash", "-euo", "pipefail", "-c", args]
    else:
        cmd = args
    print(f"HHBA_CLOUDFLARE_RUN {cwd.relative_to(REPO)}: {str(cmd)[:140]}", flush=True)
    subprocess.run(cmd, check=True, cwd=cwd, env=env)


def main() -> None:
    if not WORKFLOW.exists():
        raise SystemExit("Missing canonical GitHub Pages workflow")
    wf = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    steps = wf["jobs"]["build"]["steps"]

    # Reuse only the same published media preparation scripts from the
    # canonical workflow. Do not copy out stale assets or mutate source Git.
    prep = []
    for step in steps:
        if step.get("name") == "Install dependencies":
            break
        name = step.get("name", "")
        command = step.get("run")
        if command and (name.startswith("Import the first employer") or
                        name.startswith("Import source-backed Schneider") or
                        re.search(r"python(?:3)?\s+(?:apps/web/)?scripts/prepare-[^\s]+\.py", command)):
            prep.append(step)
    if len(prep) < 18:
        raise SystemExit(f"Media generation drift: expected at least 18 steps, got {len(prep)}")

    for step in prep:
        working = step.get("working-directory", ".")
        run(step["run"], cwd=REPO / working)
    print(f"HHBA_CLOUDFLARE_MEDIA_STEPS_OK={len(prep)}", flush=True)

    # University media is also assembled dynamically in the official Pages job.
    campus = [s for s in steps
              if "run" in s and
              re.search(r"python(?:3)?\s+apps/web/scripts/package-[^\s]+-campus-photos\.py", s["run"])]
    if len(campus) != 5:
        raise SystemExit(f"Campus media generation drift: expected 5, got {len(campus)}")
    for step in campus:
        run(step["run"], cwd=REPO / step.get("working-directory", "."))
    print("HHBA_CLOUDFLARE_CAMPUS_MEDIA_OK=5", flush=True)

    # Cloudflare Pages runs at '/', not Github Pages '/hhba-talent/'.
    # Enable the audited same-origin public catalogue BEFORE Vite embeds its
    # feature flags. Without this it fetches /live-recruitment/api/jobs/page,
    # a dev-only proxy which becomes HTML SPA fallback on Cloudflare.
    run(["npm", "run", "build"], cwd=WEB,
        env={**os.environ, "VITE_HHBA_VERIFIED_SNAPSHOT": "1"})

    # Cloudflare serves the VERY SAME original admin-preview source as GitHub Pages.
    # Only asset paths differ between the standalone app and the /admin-preview/ subpath.
    # No new admin UI, no new route prefix, no synthetic user or business records.
    original_admin = REPO / "apps" / "admin-preview"
    cloudflare_admin = WEB / "dist" / "admin-preview"
    cloudflare_admin.mkdir(parents=True, exist_ok=True)
    for filename in ("index.html", "dashboard.js", "styles.css", "favicon.svg"):
        shutil.copy2(original_admin / filename, cloudflare_admin / filename)
    admin_html = (cloudflare_admin / "index.html").read_text(encoding="utf-8")
    for old, new in (
        ('href="/styles.css"', 'href="./styles.css"'),
        ('src="/dashboard.js"', 'src="./dashboard.js"'),
        ('href="/favicon.svg"', 'href="./favicon.svg"'),
    ):
        if old not in admin_html:
            raise SystemExit("Original admin asset reference changed: " + old)
        admin_html = admin_html.replace(old, new)
    (cloudflare_admin / "index.html").write_text(admin_html, encoding="utf-8")
    print("HHBA_CLOUDFLARE_ORIGINAL_ADMIN_READY=/admin-preview/", flush=True)

    # Same-site company deep links; do not add 404.html, so Cloudflare Pages
    # retains its native SPA fallback for other client-side routes.
    run(["node", "scripts/materialize-company-route-entries.mjs"], cwd=WEB,
        env={**os.environ, "HHBA_CLOUDFLARE_PAGES": "1"})

    # Locally host the licensed font used by the brand slogan.
    run(["python3", "scripts/prepare-home-xingshu-font.py"], cwd=WEB)

    # Public recruitment catalogue comes directly from audited official ATS boards.
    # Legacy Railway 404s cannot block deployments. Incomplete current boards are
    # explicitly reported; minimum verified board/job coverage still fails closed.
    run(["node", "scripts/prepare-pages-jobs.mjs"], cwd=WEB)
    run(["node", "scripts/audit-all-official-jds.mjs"], cwd=WEB)
    run(["node", "scripts/verify-cloudflare-recruitment.mjs"], cwd=WEB)

    # Publish manifest tied to the actual Cloudflare Git commit (no fabricated SHA).
    env = dict(os.environ)
    if env.get("CF_PAGES_COMMIT_SHA"):
        env["GITHUB_SHA"] = env["CF_PAGES_COMMIT_SHA"]
    if env.get("GITHUB_SHA"):
        run(["node", "--experimental-strip-types",
             "scripts/write-talent-city-manifest.mjs"], cwd=WEB, env=env)

    # Make broken asset generation a failed deployment rather than a silent
    # green check. These paths are generated by the canonical workflow.
    checks = [
        "images/autumn-real-logos/cn-autumn-001.svg",
        "images/autumn-real-logos/cn-autumn-002.svg",
        "images/employer-profiles/cn-autumn-027/logo.png",
        "images/employer-profiles/cn-autumn-027/photo1.jpg",
        "images/employer-profiles/cn-autumn-027/photo2.jpg",
        "images/employer-profiles/cn-autumn-031/photo1.jpg",
        "images/employer-profiles/cn-autumn-034/photo1.jpg",
        "images/employer-profiles/cn-autumn-157/logo.webp",
        "fonts/hhba-people-xingshu.woff2",
        "data/jobs.json",
        "admin-preview/index.html",
        "admin-preview/dashboard.js",
        "companies/autumn/cn-autumn-034/index.html",
    ]
    missing = [p for p in checks if not (WEB / "dist" / p).is_file()
               or (WEB / "dist" / p).stat().st_size == 0]
    if missing:
        raise SystemExit("Missing required Cloudflare artifacts: " + ", ".join(missing))
    print(f"HHBA_CLOUDFLARE_BUILD_VERIFIED={len(checks)}", flush=True)

    # Every employer's image path must exist in the released static files.
    # Check actual profile JSON after the sourced-media scripts have updated it.
    validated = 0
    editorial_photo_slots = 0
    missing_profile_media = []
    for profile_path in sorted((WEB / "src/data/employerProfiles").glob("cn-autumn-*.json")):
        profile = json.loads(profile_path.read_text(encoding="utf8"))
        media = profile.get("media") or {}
        photos = media.get("photos", [])
        if len(photos) != 2:
            missing_profile_media.append(f"{profile_path.name}: expected 2 photos, got {len(photos)}")
        editorial_photo_slots += sum(str(p.get("path", "")).endswith(".svg") for p in photos)
        items = [media.get("logo")] + [p.get("path") for p in photos]
        for candidate in items:
            if not isinstance(candidate, str) or not candidate:
                missing_profile_media.append(f"{profile_path.name}: empty media path")
                continue
            if not candidate.startswith("images/") or ".." in Path(candidate).parts:
                missing_profile_media.append(f"{profile_path.name}: unsafe/nonlocal media {candidate}")
                continue
            dest = WEB / "dist" / candidate
            if not dest.is_file() or dest.stat().st_size <= 0:
                missing_profile_media.append(f"{profile_path.name}: {candidate}")
            else:
                validated += 1
    if missing_profile_media:
        raise SystemExit("Unresolved employer media:\\n" + "\\n".join(missing_profile_media[:100]))
    print(f"HHBA_CLOUDFLARE_EMPLOYER_MEDIA_VERIFIED={validated} EDITORIAL_SVG_PHOTO_SLOTS={editorial_photo_slots}", flush=True)


if __name__ == "__main__":
    main()
