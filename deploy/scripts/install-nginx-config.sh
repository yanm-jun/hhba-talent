#!/usr/bin/env bash
set -Eeuo pipefail
: "${HHBA_DOMAIN:?Set HHBA_DOMAIN, e.g. www.example.com}"
: "${HHBA_RELEASES_DIR:=/srv/hhba/releases}"
: "${HHBA_NGINX_AVAILABLE:=/etc/nginx/sites-available/hhba.conf}"
: "${HHBA_NGINX_ENABLED:=/etc/nginx/sites-enabled/hhba.conf}"

if [[ ! "$HHBA_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then echo 'HHBA_DOMAIN is invalid' >&2; exit 2; fi
install -d -m 0755 /var/www/acme "$HHBA_RELEASES_DIR"
sed "s/__HHBA_DOMAIN__/$HHBA_DOMAIN/g" deploy/nginx/hhba-bootstrap-http.conf.template > "$HHBA_NGINX_AVAILABLE"
ln -sfn "$HHBA_NGINX_AVAILABLE" "$HHBA_NGINX_ENABLED"
nginx -t
systemctl reload nginx
printf 'HTTP challenge configuration installed. Obtain a certificate with: certbot certonly --webroot -w /var/www/acme -d %s\nThen run deploy/scripts/enable-https.sh to install HTTPS.\n' "$HHBA_DOMAIN"
