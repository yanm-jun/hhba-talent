# HHBA enterprise brand logo expansion (2026-10-20)

- Current official ATS index: 50 source identities with approved job records.
- Source-reviewed assets: 49 identities. Original 28 from PR #51; 21 new in this batch.
- **Not yet approved:** Headway (Ashby board `headway`). `headway.co` blocks our evidence client; do not confuse it with Headway Inc (`headway.inc`), product studio (`headway.io`) or unrelated same-name companies.
- Source rules: matching `company + ATS platform + board source` exactly; never fuzzy-match subsidiaries, jobs or domain substrings.
- Vetted brand display can share a source for corporate boards only with affirmative evidence, e.g. SpaceX Global official Greenhouse board currently displays `SpaceX`, so we copy the existing authenticated SpaceX SVG unchanged but keep the separate employer source ID.
- Assets from brand-controlled sites are actual declared favicon / apple-touch icon sources. Official `image/png` assets remain byte-for-byte original; ICO gets pixel-equivalent PNG with the original source SHA-256 also recorded. Simple Icons additions are source-traceable upstream vectors, not official downloads or a trademark license.
- Original file SHA-256 and relevant source URL are in `apps/web/public/brands/PROVENANCE.json`; every record points to a specific employer source. Source site and trademark ownership do **not** imply HR partnership or endorsement.
- The Railway web gateway allows only local patterns `/brands/openai.svg`, `/brands/claude.svg`, `/brands/spacex.svg`, `/brands/si-*.svg` and `/brands/brand-*.png|svg`. Arbitrary file access and external logo proxies remain disabled.
- To review remaining Headway, retrieve an original mark from its *own* verified official site or verified Ashby-hosted employer metadata. Record original URL, company identity and actual SHA-256; otherwise keep the generic building icon.

To add further companies, first observe a genuinely approved recent ATS board in the current jobs snapshot. Verify the source-hosted brand asset explicitly, then update the registry and provenance in one reviewed commit and repeat the complete Railway browser acceptance.
