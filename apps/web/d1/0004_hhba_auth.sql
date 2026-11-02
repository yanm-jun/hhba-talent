-- HHBA 真实短信认证（Cloudflare Pages Functions + PNVS），与 0003 指标库分开存放。
-- 适用库：新建的认证 D1（Pages 绑定名 HHBA_AUTH_DB），不要改 0003 迁移。
-- 安全红线：本迁移 deliberately 没有任何验证码字段。验证码由阿里云 PNVS 生成与
-- 核验，后端只存“发过码 / 验过码 / 验码成功后已消费”这三类事件，绝不入库验证码原文。
-- 会话 token 同理：只存 token 的 SHA-256 哈希，原始 token 只在签发响应里返回一次。

CREATE TABLE IF NOT EXISTS hhba_auth_users (
  phone TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'candidate' CHECK (role IN ('candidate')),
  created_at TEXT NOT NULL,
  last_login_at TEXT,
  failed_pw_attempts INTEGER NOT NULL DEFAULT 0,
  pw_locked_until TEXT
);
CREATE INDEX IF NOT EXISTS idx_hhba_auth_users_username ON hhba_auth_users(username);

-- 发码事件：purpose 区分注册 / 登录 / 找回密码，三者绝不通用。
-- consumed=1 表示该次发码已被一次成功验码消费，同一码不允许第二次验码通过。
CREATE TABLE IF NOT EXISTS hhba_sms_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'login', 'reset')),
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'blocked')),
  biz_id TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hhba_sms_events_phone_purpose_time
  ON hhba_sms_events(phone, purpose, created_at);
CREATE INDEX IF NOT EXISTS idx_hhba_sms_events_ip_time
  ON hhba_sms_events(ip_hash, created_at);

-- 验码事件：只记成功与否与次数，不记验证码原文；用于验码次数上限风控。
CREATE TABLE IF NOT EXISTS hhba_auth_verify_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'login', 'reset')),
  success INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_auth_verify_events_phone_purpose_time
  ON hhba_auth_verify_events(phone, purpose, created_at);

-- 会话：只存 token 哈希。expires_at 过后或 revoked=1 后一律失效。
CREATE TABLE IF NOT EXISTS hhba_auth_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_hhba_auth_sessions_phone ON hhba_auth_sessions(phone);
