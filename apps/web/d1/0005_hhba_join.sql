-- 加入我们合作意向申请记录（邮件 + 存库方案中的存库部分）。
-- 简历文件本身不入库，只随邮件发附件；这里只记文件名与大小。
CREATE TABLE IF NOT EXISTS hhba_join_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  direction TEXT NOT NULL,
  experience TEXT NOT NULL,
  strength TEXT,
  portfolio TEXT,
  weekly_time TEXT NOT NULL,
  mode TEXT NOT NULL,
  note TEXT,
  resume_filename TEXT,
  resume_size INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_join_applications_ip_created
  ON hhba_join_applications(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_join_applications_created
  ON hhba_join_applications(created_at);
