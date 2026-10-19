# HHBA machine translation title warmup

The 30-board rollout introduced ~6,200 more jobs. Plain dictionary fallback may be partial English; Machine Translation via the private LibreTranslate server is gradually enabled for titles.

- Prioritize titles where dictionary produced no Han characters (`pending`).
- Same title original text hash is used as cache key, independent of the employer.
- At most **320 translation title requests per UTC day**, persisted in SQLite under /data; **96 titles per single run**, run triggered by a public jobs list request, with 1.45 seconds between 4-title batches.
- No DeepSeek or LLM API key required. This still consumes Railway CPU/time.
- Untranslatable/invalid titles are left in review status and not silently marked accurate. The English original is always available.
- DO NOT claim that every title is already a natural Chinese translation. `/api/i18n/status` shows actual machine/rule/pending counts.

Service-independent official JD validation continues through HHBA 30 Board Live Acceptance.
