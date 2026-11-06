-- Phase 2: requests only. Recording a request never triggers Alipay refund
-- and never revokes credits. A separate audited admin process must
-- reconcile payment and credit consumption before any actual refund.
CREATE TABLE IF NOT EXISTS hhba_apply_refund_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES hhba_apply_orders(id) ON DELETE CASCADE,
  phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 2 AND 300),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK(status IN ('requested','reviewing','rejected','completed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_apply_refund_phone
 ON hhba_apply_refund_requests(phone,created_at DESC);
