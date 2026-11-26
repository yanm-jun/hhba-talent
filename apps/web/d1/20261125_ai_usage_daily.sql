-- Private aggregate OpenAI usage; no prompts, resume contents, user IDs or credentials.
CREATE TABLE IF NOT EXISTS hhba_ai_usage_daily (
 day TEXT NOT NULL, model TEXT NOT NULL, stage TEXT NOT NULL, effort TEXT NOT NULL, status TEXT NOT NULL,
 calls INTEGER NOT NULL DEFAULT 0, usage_calls INTEGER NOT NULL DEFAULT 0,
 input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
 total_tokens INTEGER NOT NULL DEFAULT 0, reasoning_tokens INTEGER NOT NULL DEFAULT 0, cached_tokens INTEGER NOT NULL DEFAULT 0,
 reasoning_known_calls INTEGER NOT NULL DEFAULT 0, cache_known_calls INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,model,stage,effort,status)
);
