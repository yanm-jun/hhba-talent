# V4 dual-model job matching
Default existing behavior is unchanged until explicitly enabled. On Pages project hhba-talent, Production (and Preview for acceptance), set:
- GOOGLE_GEMINI_BASE_URL (text): https://api-c.reqtoken.com
- GEMINI_MODEL (text): gemini-3.8-flash (relay model ID; confirm entitlement)
- GEMINI_API_KEY (encrypted secret): actual key, never in Git
- HHBA_V4_JOB_PROVIDER (text): gemini (enable only after validation and privacy/consent review)
Keep HHBA_AGENT_RELAY_* unchanged. OCR, initial profile and resume rewriting remain OpenAI. All V4 job research calls use Gemini when enabled, with no silent OpenAI fallback.
Native endpoint: /v1beta/models/{model}:generateContent; x-goog-api-key header. Search requests use google_search; grounding metadata is normalized into existing source contract. A search tool citation is not official JD evidence. Existing independent official page verification and exact quote scoring remain in force. Google Search decides whether to run; required-search calls without grounding are rejected.
Run node --test scripts/v4-gemini-job-provider.test.mjs from apps/web. Before production activation, verify native relay compatibility with a synthetic public job search, actual grounding metadata and official URL retrieval, then run V4 500/50 acceptance with an explicitly authorized test resume. Do not send real customer data until actual data recipients, retention and transfer obligations have been verified. Logs HHBA_V4_MODEL_USAGE contain token counts and elapsed time; pricing is relay-specific and not inferred. Roll back via HHBA_V4_JOB_PROVIDER=openai; finish or cancel active tasks before switching to avoid mixing providers.

Native GenerateContent does not inherit OpenAI's store:false flag. Confirm relay/provider data retention and processing before enabling for real users.

## Native capabilities and continuity
- Actual Gemini webSearchQueries and grounding chunks are retained; missing required grounding remains incomplete, not a successful search. Redirect landing pages are independently read and registered as leads, never accepted as verified jobs solely from a citation.
- Optional GEMINI_STREAM=1 enables native SSE, with fallback only on explicit transport rejection. GEMINI_URL_CONTEXT=1 enables native URL Context for public-only JD-source recovery, not resume payloads. Both remain off until the synthetic operator probe reports native support.
- Gemini discovery defaults to adaptive parallel research unless explicitly disabled. Workers connection scheduling limits are per request, not total AI-call limits. A below-target Gemini completion gets an independent review before final partial delivery; exact repeated no-progress work is still stopped transparently rather than billed indefinitely.
- Independent background execution requires a private Workflow Worker and Pages service binding. Do not claim it is active until deployed, bound, enabled and tested with cancellation/continuation.
