# HHBA Home Recommendation Engine — Phase 1

## Scope

The homepage now presents domestic career opportunities with deterministic,
explainable ranking from a signed-in candidate's existing preferred role, city,
skills, and saved jobs. Unauthenticated users can choose internship/campus/social
segments. All cards come from the existing verified-source marketplace reader;
an official job-listing URL is **not** proof that applications remain open.

The optional collaboration API computes cross-account co-save relationships
ONLY from accounts that opted in. It applies a minimum of three distinct
participating peers for every returned job; no peer identifiers or resumes
are returned. With no consent, overlapping saves, or enough participants,
it falls back to content-based ranking. No age data is collected or used.

## Cloudflare deployment prerequisites

1. Run `apps/web/d1/0020_home_recommendations.sql` on a **staging copy**
   of `HHBA_PNVS_AUTH_DB`. Confirm existing tables and account login work.
2. Verify Pages binding `HHBA_PNVS_AUTH_DB` and the existing real-auth build
   switch (`VITE_HHBA_REAL_AUTH_ENABLED=1`) only in the authorized environment.
3. Run the production migration only after an approved backup and staged checks.
   Without it, content ranking still works; the collaborative consent UI
   accurately marks the database unavailable.
4. Protect `/admin-preview/*` with the existing Cloudflare Access app and
   retain configured admin audience and allowlisted email. The new
   `/admin-preview/api/recommendations` endpoint requires a verified Access
   JWT on **every request**.
5. Recheck source freshness, domestic-only locations, candidate login,
   bookmark changes, opt-in / opt-out, anonymous fallback and mobile cards.
6. Deploy only after review. This branch is not auto-promoted to `main`.

## Main files

- `src/services/homeRecommendations.ts`: deterministic content + co-save scoring
- `src/components/HomeRecommendedJobs.tsx`: homepage cards and consent controls
- `functions/api/recommendations/[[path]].js`: authenticated consent / co-save API
- `functions/_lib/recommendation-collab.js`: three-peer anonymous co-save filter
- `functions/admin-preview/api/recommendations.js`: private aggregate status
- `apps/admin-preview/`: visible operator recommendation panel

## Known constraints

- The first candidate pool is bounded by the existing market pages plus one
  preferred-role query; this is not a full-catalog nearest-neighbor service.
- No recommendation impressions/click attribution, conversion rate, or hiring
  outcome is currently measured. Admin panel must display unavailable metrics as dashes.
- No Gorse server is deployed. It can replace/augment the co-save candidate
  generator after real opt-in data and quality metrics justify extra infrastructure.
- Privacy opt-in is separate from historical anonymous aggregate site analytics.
- The existing general job market is preserved after the personalized section.

## Acceptance tests

- Different profiles/stages change ordering and reasons without invented jobs.
- No consumer of collaboration can retrieve another person's identity.
- Users without opt-in never contribute their bookmarks to co-save results.
- Cancelled consent immediately excludes peers in subsequent queries.
- Missing DB, missing permission, or stale public source fail closed or
  show a user-readable fallback rather than fabricated jobs or KPI counts.
