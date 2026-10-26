# HHBA Phase 1 deployment

This configuration builds and serves the React static site only. It deliberately does not start `Dockerfile.hhba`, `ops/legacy-marketplace`, PostgreSQL, the Railway proxy, or `apps/api`; those components include recruitment and/or administrative workflows that have not passed Phase 1 review.

## Required server-side prerequisites

- An isolated Linux host with Node 22–24, Nginx, Certbot, Git, and a non-root deployment account.
- DNS and ICP prerequisites confirmed by the domain owner before public traffic is enabled.
- A hostname selected by the owner. Do not substitute a guessed domain.
- Ports 80 and 443 allowed by the security group; SSH restricted to authorized sources. Do not expose database, Node, Bun, or development ports.

## Initial install (after an approved server backup)

1. Clone the reviewed `deploy/aliyun-phase1` commit under a non-public path such as `/srv/hhba/source`.
2. As root, set `HHBA_DOMAIN` and run `deploy/scripts/install-nginx-config.sh` from that checkout. It installs an HTTP-only ACME challenge site, which is safe to validate before a certificate exists.
3. Issue the certificate with `certbot certonly --webroot -w /var/www/acme -d "$HHBA_DOMAIN"`; then run `deploy/scripts/enable-https.sh` and test renewal with `certbot renew --dry-run`.
4. As the deployment account, run `deploy/scripts/build-release.sh` from the source checkout.
5. Inspect the generated release, then run `sudo deploy/scripts/activate-release.sh /srv/hhba/releases/<release-id>`.
6. Verify `/`, a deep link such as `/companies/discover`, and prohibited paths `/preview-admin/`, `/api/v1/`, and `/candidate/resume/new`.

`build-release.sh` makes a new version directory and `activate-release.sh` changes only the `/srv/hhba/current` symlink after Nginx syntax validation. Roll back by activating the previous release directory and rechecking Nginx:

```bash
sudo deploy/scripts/activate-release.sh /srv/hhba/releases/<previous-release-id>
```

Nginx logs are `/var/log/nginx/hhba.access.log` and `/var/log/nginx/hhba.error.log`. No application process is required for Phase 1; health verification is `curl -fsS https://<domain>/` plus the negative-path checks above.
