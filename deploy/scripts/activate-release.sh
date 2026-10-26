#!/usr/bin/env bash
set -Eeuo pipefail
: "${HHBA_RELEASES_DIR:=/srv/hhba/releases}"
: "${HHBA_CURRENT_LINK:=/srv/hhba/current}"
release="${1:?Usage: activate-release.sh /srv/hhba/releases/<release-id>}"
release="$(readlink -f "$release")"
releases="$(readlink -f "$HHBA_RELEASES_DIR")"
[[ -f "$release/index.html" && "$release" == "$releases"/* ]] || { echo 'Refusing invalid release path' >&2; exit 2; }
[[ ! -e "$release/preview-admin" ]] || { echo 'Refusing release containing preview-admin' >&2; exit 3; }
ln -sfn "$release" "${HHBA_CURRENT_LINK}.next"
mv -Tf "${HHBA_CURRENT_LINK}.next" "$HHBA_CURRENT_LINK"
nginx -t && systemctl reload nginx
