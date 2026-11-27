-- Genuine anonymous observed output events by UTC minute.
-- No resume, user/account/task IDs, employer URLs or model content.
-- Sources are intentionally kept separate to prevent double counting when
-- the same independently verified JD is later merged into the main phase.
CREATE TABLE IF NOT EXISTS hhba_v4_minute_ops (
 minute_utc TEXT NOT NULL,
 source TEXT NOT NULL CHECK(source IN ('phase','independent')),
 kind TEXT NOT NULL CHECK(kind IN ('candidate','jd','score','report')),
 events INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(minute_utc,source,kind)
);
