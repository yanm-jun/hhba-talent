-- HHBA 本地开发库初始化（测试数据专用）
-- 启用向量扩展；不导入真实简历
CREATE EXTENSION IF NOT EXISTS vector;

-- 能力档案最小占位表（Phase 0 仅验证扩展可用，V0.1 再定正式模型）
CREATE TABLE IF NOT EXISTS capability_profiles_phase0 (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    embedding   vector(1536),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
