# HHBA enterprise brand logo expansion (2026-10-20)

- Current official ATS index: 50 source identities with approved job records.
- Source-reviewed assets: 50 identities. Original 28 from PR #51; 21 from PR #52; final Headway logo from its ATS-employer-specific OG image.
- **Headway source resolved:** `headway.co` blocks automated access, but the exact Headway Ashby recruitment board at `jobs.ashbyhq.com/headway` declares an employer-specific `og:image` at `app.ashbyhq.com/api/images/org-theme-logo/...png`. This is the employer's uploaded brand image, not Ashby's favicon. Record the exact SHA-256; do not confuse it with same-name unrelated companies.
- Source rules: matching `company + ATS platform + board source` exactly; never fuzzy-match subsidiaries, jobs or domain substrings.
- Vetted brand display can share a source for corporate boards only with affirmative evidence, e.g. SpaceX Global official Greenhouse board currently displays `SpaceX`, so we copy the existing authenticated SpaceX SVG unchanged but keep the separate employer source ID.
- Assets from brand-controlled sites are actual declared favicon / apple-touch icon sources. Official `image/png` assets remain byte-for-byte original; ICO gets pixel-equivalent PNG with the original source SHA-256 also recorded. Simple Icons additions are source-traceable upstream vectors, not official downloads or a trademark license.
- Original file SHA-256 and relevant source URL are in `apps/web/public/brands/PROVENANCE.json`; every record points to a specific employer source. Source site and trademark ownership do **not** imply HR partnership or endorsement.
- The Railway web gateway allows only local patterns `/brands/openai.svg`, `/brands/claude.svg`, `/brands/spacex.svg`, `/brands/si-*.svg` and `/brands/brand-*.png|svg`. Arbitrary file access and external logo proxies remain disabled.
- Headway was verified from its exact Ashby board `og:image` declaration and has a 500×500 original employer PNG. Source record must remain tied to ATS `ashby/headway`, never to a generic string match.

To add further companies, first observe a genuinely approved recent ATS board in the current jobs snapshot. Verify the source-hosted brand asset explicitly, then update the registry and provenance in one reviewed commit and repeat the complete Railway browser acceptance.
