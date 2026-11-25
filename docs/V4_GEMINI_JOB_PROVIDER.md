# V4 dual-model job matching
Default existing behavior is unchanged until explicitly enabled. On Pages project hhba-talent, Production (and Preview for acceptance), set:
- GOOGLE_GEMINI_BASE_URL (text): https://api-c.reqtoken.com
- GEMINI_MODEL (text): gemini-3.8-flash (relay model ID; confirm entitlement)
- GEMINI_API_KEY (encrypted secret): actual key, never in Git
- HHBA_V4_JOB_PROVIDER (text): gemini (enable only after validation and privacy/consent review)
Keep HHBA_AGENT_RELAY_* unchanged. OCR, initial profile and resume rewriting remain OpenAI. All V4 job research calls use Gemini when enabled, with no silent OpenAI fallback.
Native endpoint: /v1beta/models/{model}:generateContent; x-goog-api-key header. Search requests use google_search; grounding metadata is normalized into existing source contract. A search tool citation is not official JD evidence. Existing independent official page verification and exact quote scoring remain in force. Google Search decides whether to run; required-search calls without grounding are rejected.
Run node --test scripts/v4-gemini-job-provider.test.mjs from apps/web. Before production activation, verify native relay compatibility with a synthetic public job search, actual grounding metadata and official URL retrieval, then run V4 500/50 acceptance with an explicitly authorized test resume. Do not send real customer data until actual data recipients, retention and transfer obligations have been verified. Logs HHBA_V4_MODEL_USAGE contain token counts and elapsed time; pricing is relay-specific and not inferred. Roll back via HHBA_V4_JOB_PROVIDER=openai; finish or cancel active tasks before switching to avoid mixing providers.
