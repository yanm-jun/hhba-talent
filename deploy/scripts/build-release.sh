#!/usr/bin/env bash
set -Eeuo pipefail
: "${HHBA_RELEASES_DIR:=/srv/hhba/releases}"
sha="$(git rev-parse --verify HEAD)"
release="$HHBA_RELEASES_DIR/${sha:0:12}"
[[ -d "$release" ]] && { echo "Release already exists: $release" >&2; exit 2; }
export HHBA_GITHUB_PAGES=0
export VITE_HHBA_PHASE1_PUBLIC_ONLY=1
export VITE_HHBA_ACCOUNT_API_ENABLED=0
export VITE_HHBA_RECRUITMENT_RESPONSIBILITY_API_ENABLED=0
export VITE_HHBA_EVIDENCE_API_ENABLED=0
export VITE_HHBA_EMPLOYEE_FEEDBACK_API_ENABLED=0
export VITE_HHBA_SCORING_API_ENABLED=0
export VITE_HHBA_APPEALS_API_ENABLED=0
export VITE_HHBA_IMPROVEMENTS_API_ENABLED=0
export VITE_HHBA_PUBLICATION_API_ENABLED=0
export VITE_HHBA_AID_COMMERCIAL_API_ENABLED=0
npm ci --prefix apps/web --no-audit --no-fund
npm run build:production --prefix apps/web
node --test apps/web/scripts/hhba-unified-static.contract.test.mjs apps/web/scripts/strict-auth-no-photo-outlinks.behavior.test.mjs apps/web/scripts/official-recruitment-gate-photos.contract.test.mjs
[[ -s apps/web/dist/index.html && ! -e apps/web/dist/preview-admin ]]
install -d -m 0755 "$HHBA_RELEASES_DIR"
cp -a apps/web/dist "$release"
printf '%s\n' "$sha" > "$release/REVISION"
printf 'Built %s\n' "$release"
