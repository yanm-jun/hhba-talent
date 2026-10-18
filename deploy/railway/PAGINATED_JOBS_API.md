# HHBA paged recruitment marketplace API — scaling to 100 ATS boards

New endpoint: `GET /api/jobs/page?limit=30&offset=0&q=中文关键词&company=OpenAI&remote=true`.
- The backend matches the full live allowlisted index; the browser downloads at most 60 jobs per response, not the entire job corpus.
- Search matches original + Chinese title/company/location and existing Chinese occupational synonyms.
- Response includes matching `total`, overall `allJobs`, `boards`, `failures`, stable company filter choices on the first page, and current translation count.
- Browser debounces input 220ms, discards obsolete requests with a monotonically increasing token, supports mobile scrolling pagination through “Load more”, and uses consistent Chinese/English language preferences.
- Existing `/api/jobs` all-jobs JSON route remains unchanged for existing audit clients.
- Do not use offset-paging as a long-term source of truth if frequent ATS syncs reshuffle sorted results; a scalable DB snapshot/cursor will be required for larger rollouts.

E2E checks should compare `/api/jobs/page` against `/api/jobs` total counts, verify Chinese search results, company/remote filtering, and clickthrough to real official JD.
