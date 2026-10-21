-- HHBA Phase 2 真实账户系统 schema（PostgreSQL 17）
-- 落点: apps/api/db/001_auth_schema.sql
--   - docker-compose 首次初始化时经 /docker-entrypoint-initdb.d 自动执行（仅空库）；
--   - 已有库升级用版本化迁移逐个执行，禁止改已发布迁移文件。
-- 设计要点（对应任务书 5.4）:
--   * 手机号是中国大陆 11 位，唯一约束保证「一手机号一账户」，重复注册在 DB 层就不可能；
--   * 求职者/招聘方是角色不是两套账户：users.account_role 区分，招聘方另走 employers 认证，
--     手机登录成功 != 企业已认证（employer_verifications.status 独立流转）；
--   * 管理员不能自助获得：is_admin 只能由受控流程置位，且必须记录 granted_by / granted_at，
--     CHECK 约束保证「有管理员标记必有授予记录」；
--   * 注册/登录双入口严格分开（2026-10-21 用户拍板）：sms_codes.purpose 绑定入口、验证码不可跨用途；
--     users.registered_from 记录建号来源，登录流程在应用层没有任何 INSERT users 路径；
--   * 验证码与会话只存哈希（HMAC-SHA256，密钥在环境变量 SMS_CODE_PEPPER / 会话密钥），库里没有明文；
--   * 设备级匿名收藏（现有 hhba-saved.sqlite）与账户收藏是两张语义不同的表，禁止自动合并：
--     saved_jobs_account 只写登录后用户主动收藏；匿名收藏迁移须用户在前端显式确认后逐条调用接口。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- 用户 ----------
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           text NOT NULL UNIQUE
                    CONSTRAINT users_phone_cn_format CHECK (phone ~ '^1[3-9][0-9]{9}$'),
  nickname        text,
  account_role    text NOT NULL DEFAULT 'candidate'
                    CONSTRAINT users_role_chk CHECK (account_role IN ('candidate', 'recruiter')),
  status          text NOT NULL DEFAULT 'active'
                    CONSTRAINT users_status_chk CHECK (status IN ('active', 'suspended', 'deleted')),
  is_admin        boolean NOT NULL DEFAULT false,
  registered_from text NOT NULL DEFAULT 'register'
                    CONSTRAINT users_registered_from_chk CHECK (registered_from IN ('register', 'admin')),
                    -- 账户来源：'register'=经注册入口自助注册（本系统唯一自助建号路径，2026-10-21 双入口拍板）；
                    -- 'admin'=受控离线流程预置。登录路径永不 INSERT users，此列即对账证据。
  admin_granted_by uuid,            -- 授予人（另一名管理员或离线受控流程的记录 id）
  admin_granted_at timestamptz,
  CONSTRAINT users_admin_grant_required
    CHECK ((is_admin = false) OR (admin_granted_by IS NOT NULL AND admin_granted_at IS NOT NULL)),
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_login_at   timestamptz,
  deleted_at      timestamptz
);
CREATE INDEX users_created_at_idx ON users (created_at);

-- ---------- 个人资料（与账户行分离：资料可空、可扩展，不污染登录热路径） ----------
CREATE TABLE user_profiles (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name  text,
  headline      text,
  city          text,
  work_years    integer CONSTRAINT profiles_years_chk CHECK (work_years IS NULL OR work_years BETWEEN 0 AND 60),
  skills        text[] NOT NULL DEFAULT '{}',
  extra         jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- 登录会话（只存 token 哈希；撤销=置 revoked_at） ----------
CREATE TABLE auth_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,           -- HMAC/哈希后的会话令牌，禁止存明文 token
  csrf_hash    text,                           -- 双提交 CSRF token 的哈希
  ip           inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id, expires_at) WHERE revoked_at IS NULL;

-- ---------- 短信验证码（哈希存储；成功即 consumed，错误计数封顶） ----------
CREATE TABLE sms_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        text NOT NULL,
  purpose      text NOT NULL CONSTRAINT sms_purpose_chk CHECK (purpose IN ('register', 'login')),
                    -- 用途与入口绑定（2026-10-21 双入口拍板）：无默认值，应用层发码必填；
                    -- register 码只能完成注册、login 码只能完成登录，跨用途在应用层查无此码即失败。
  code_hash    text NOT NULL,                  -- HMAC-SHA256(pepper, phone|purpose|code)，绝不存明文验证码
  attempts     integer NOT NULL DEFAULT 0 CONSTRAINT sms_attempts_chk CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5,
  sent_via     text NOT NULL DEFAULT 'mock',   -- aliyun | mock（mock 仅非 production，应用层强制）
  request_ip   inet,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,           -- created_at + 5 分钟（应用层常量，两处须一致）
  consumed_at  timestamptz                     -- 成功验证或作废时置位；非空即不可再用
);
CREATE INDEX sms_codes_phone_open_idx ON sms_codes (phone, created_at DESC) WHERE consumed_at IS NULL;

-- ---------- 短信发送日志（对账/统计/排障；不含验证码明文） ----------
CREATE TABLE sms_send_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,
  provider    text NOT NULL,                   -- aliyun | mock
  provider_request_id text,                    -- 阿里云 SendSms 返回的 RequestId / BizId
  status      text NOT NULL CONSTRAINT sms_log_status_chk CHECK (status IN ('accepted', 'rejected', 'error', 'rate_limited')),
  error_code  text,                            -- 映射后的内部错误码，原始码放 detail
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_ip  inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sms_send_log_phone_day_idx ON sms_send_log (phone, created_at DESC);

-- ---------- 账户级职位收藏（与设备收藏严格隔离） ----------
CREATE TABLE saved_jobs_account (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id     text NOT NULL,                    -- 岗位索引 id（与 /api/jobs/page 的 id 同一命名空间）
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX saved_jobs_account_job_idx ON saved_jobs_account (job_id);

-- ---------- 招聘方企业与认证 ----------
CREATE TABLE employers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id),   -- 申请入驻的登录用户
  legal_name    text NOT NULL,
  credit_code   text,                                  -- 统一社会信用代码（展示/存储时脱敏，唯一性防重复入驻）
  status        text NOT NULL DEFAULT 'pending'
                  CONSTRAINT employers_status_chk CHECK (status IN ('pending', 'verified', 'rejected', 'suspended')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employers_credit_code_uniq UNIQUE (credit_code)
);

CREATE TABLE employer_verifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id  uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES users(id),
  status       text NOT NULL DEFAULT 'submitted'
                 CONSTRAINT verif_status_chk CHECK (status IN ('submitted', 'approved', 'rejected')),
  materials    jsonb NOT NULL DEFAULT '{}'::jsonb,     -- 证件文件引用/哈希，不存未加密原件
  reviewer_id  uuid REFERENCES users(id),              -- 审核管理员（须 is_admin）
  review_note  text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at  timestamptz
);
CREATE INDEX employer_verifications_queue_idx ON employer_verifications (status, submitted_at);

-- ---------- 企业岗位审核队列（复用前端 AdminRecruitmentPage 的状态语义） ----------
CREATE TABLE job_reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id  uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  posting_id   text NOT NULL,                          -- 企业自发岗位 id（非官方索引 id）
  status       text NOT NULL DEFAULT 'pending_review'
                 CONSTRAINT job_review_status_chk CHECK (status IN ('pending_review', 'approved', 'rejected', 'closed')),
  reviewer_id  uuid REFERENCES users(id),
  review_note  text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at  timestamptz
);
CREATE INDEX job_reviews_queue_idx ON job_reviews (status, submitted_at);

-- ---------- 管理员操作审计（后台一切写操作落表） ----------
CREATE TABLE admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES users(id),             -- 新体系管理员；旧单密码后台过渡期可为空但 action 必填
  action      text NOT NULL,                           -- 如 employer_verification.approve / job_review.reject / user.admin_grant
  target_type text NOT NULL,
  target_id   text NOT NULL,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_time_idx ON admin_audit_log (created_at DESC);
