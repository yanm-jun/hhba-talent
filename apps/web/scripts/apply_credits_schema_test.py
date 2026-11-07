import pathlib
import sqlite3

schema=pathlib.Path(__file__).resolve().parents[1] / 'd1/0009_apply_credits_orders.sql'
connection=sqlite3.connect(':memory:')
connection.execute('PRAGMA foreign_keys=ON')
connection.execute('CREATE TABLE hhba_auth_users (phone TEXT PRIMARY KEY,role TEXT)')
connection.execute("INSERT INTO hhba_auth_users VALUES ('13800138000','candidate')")
connection.executescript(schema.read_text())
connection.executescript((schema.parent/'0010_apply_refund_requests.sql').read_text())
connection.executescript((schema.parent/'0011_apply_ai_requests.sql').read_text())
connection.executescript((schema.parent/'0012_apply_extension_pairing.sql').read_text())
connection.executescript((schema.parent/'0014_apply_profile_sync.sql').read_text())
connection.executescript((schema.parent/'0015_candidate_application_ledger.sql').read_text())
connection.execute("""INSERT INTO hhba_apply_orders
(id,phone,package_uses,amount_fen,status,created_at)
VALUES ('order-1','13800138000',10,300,'pending','2026-11-06T00:00:00Z')""")
def credits():
    purchased=connection.execute("""SELECT COALESCE(SUM(package_uses),0) FROM hhba_apply_orders
        WHERE phone='13800138000' AND status='paid'""").fetchone()[0]
    reserved=connection.execute("""SELECT COUNT(*) FROM hhba_apply_tasks WHERE phone='13800138000'
        AND status='reserved'""").fetchone()[0]
    consumed=connection.execute("""SELECT COUNT(*) FROM hhba_apply_tasks WHERE phone='13800138000'
        AND status='completed'""").fetchone()[0]
    return purchased, reserved, consumed, purchased-reserved-consumed

assert credits()==(0,0,0,0), 'Pending orders cannot mint credits'
connection.execute("UPDATE hhba_apply_orders SET status='paid',provider_trade_no='trade-1' WHERE id='order-1' AND status='pending'")
assert credits()==(10,0,0,10)
assert connection.execute("UPDATE hhba_apply_orders SET status='paid' WHERE id='order-1' AND status='pending'").rowcount==0
connection.execute("""INSERT INTO hhba_apply_tasks VALUES
('task-1','13800138000','reserved','2026-11-06T01:00:00Z',NULL)""")
assert credits()==(10,1,0,9)
connection.execute("UPDATE hhba_apply_tasks SET status='completed' WHERE id='task-1' AND status='reserved'")
assert credits()==(10,0,1,9)
connection.execute("""INSERT INTO hhba_apply_tasks VALUES
('task-2','13800138000','reserved','2026-11-06T01:00:00Z',NULL)""")
connection.execute("UPDATE hhba_apply_tasks SET status='released' WHERE id='task-2' AND status='reserved'")
assert credits()==(10,0,1,9)
try:
    connection.execute("""INSERT INTO hhba_apply_orders
      (id,phone,package_uses,amount_fen,status,provider_trade_no,created_at)
      VALUES ('bad','13800138000',10,200,'paid','trade-2','2026-11-06T00:00:00Z')""")
    raise AssertionError('Underpriced credits not rejected')
except sqlite3.IntegrityError: pass
try:
    connection.execute("""INSERT INTO hhba_apply_orders
      (id,phone,package_uses,amount_fen,status,provider_trade_no,created_at)
      VALUES ('dup','13800138000',10,300,'paid','trade-1','2026-11-06T00:00:00Z')""")
    raise AssertionError('Duplicated provider transaction not rejected')
except sqlite3.IntegrityError: pass

# Actual reservation INSERT...SELECT is a single SQLite write with a balance
# predicate; no read-then-write race or client-side credit decrement.
reserve_sql = (
 "INSERT OR IGNORE INTO hhba_apply_tasks(id,phone,status,created_at) "
 "SELECT ?,?,'reserved',? WHERE "
 "(SELECT COALESCE(SUM(package_uses),0) FROM hhba_apply_orders WHERE phone=? AND status='paid')>"
 "(SELECT COUNT(*) FROM hhba_apply_tasks WHERE phone=? AND status IN ('reserved','completed'))"
)
for n in range(9):
    task_id=f'guard-{n}'
    result=connection.execute(reserve_sql,(task_id,'13800138000','2026-11-06T02:00:00Z',
                                          '13800138000','13800138000'))
    assert result.rowcount==1, (n, credits())
assert credits()==(10,9,1,0)
assert connection.execute(reserve_sql,('guard-extra','13800138000','2026-11-06T02:00:00Z',
                                     '13800138000','13800138000')).rowcount==0
assert connection.execute(reserve_sql,('guard-0','13800138000','2026-11-06T02:00:00Z',
                                     '13800138000','13800138000')).rowcount==0
assert credits()==(10,9,1,0)
connection.execute("UPDATE hhba_apply_tasks SET status='released' WHERE id='guard-0' AND status='reserved'")
assert credits()==(10,8,1,1)
assert connection.execute(reserve_sql,('guard-extra','13800138000','2026-11-06T02:00:00Z',
                                     '13800138000','13800138000')).rowcount==1
assert credits()==(10,9,1,0)

print('HHBA apply credits: D1 schema, amount, paid gate, atomic reservation and release PASS')

# Refund request never changes payment state or credited uses.
connection.execute("INSERT INTO hhba_apply_refund_requests(id,order_id,phone,reason,created_at,updated_at) VALUES (?,?,?,?,?,?)",
 ('refund-1','order-1','13800138000','申请人工核实退款','2026-11-06T03:00:00Z','2026-11-06T03:00:00Z'))
assert connection.execute("SELECT status FROM hhba_apply_refund_requests WHERE id='refund-1'").fetchone()[0]=='requested'
assert credits()==(10,9,1,0)
connection.execute("INSERT INTO hhba_apply_ai_requests(id,phone,created_at) VALUES (?,?,?)",
 ('ai-1','13800138000','2026-11-06T03:00:00Z'))
assert connection.execute("SELECT COUNT(*) FROM hhba_apply_ai_requests WHERE phone='13800138000'").fetchone()[0]==1

# Pairing token and code hashes only; no website bearer or raw codes ever stored.
connection.execute("""INSERT INTO hhba_apply_pair_codes
 (code_hash,phone,created_at,expires_at) VALUES (?,?,?,?)""",
 ('SHA256_TEST_CODE_HASH','13800138000','2026-11-06T04:00:00Z','2026-11-06T04:05:00Z'))
assert connection.execute("""UPDATE hhba_apply_pair_codes SET used_at=?
 WHERE code_hash=? AND used_at IS NULL AND expires_at>?""",
 ('2026-11-06T04:01:00Z','SHA256_TEST_CODE_HASH','2026-11-06T04:01:00Z')).rowcount == 1
assert connection.execute("""UPDATE hhba_apply_pair_codes SET used_at=?
 WHERE code_hash=? AND used_at IS NULL AND expires_at>?""",
 ('2026-11-06T04:01:00Z','SHA256_TEST_CODE_HASH','2026-11-06T04:01:00Z')).rowcount == 0
connection.execute("""INSERT INTO hhba_apply_extension_sessions
 (token_hash,phone,extension_id,created_at,expires_at) VALUES (?,?,?,?,?)""",
 ('SHA256_TEST_DEVICE_HASH','13800138000','abcdefghijklmnopabcdefghijklmnop',
  '2026-11-06T04:01:00Z','2026-11-06T16:01:00Z'))
assert connection.execute("""SELECT COUNT(*) FROM hhba_apply_extension_sessions
 WHERE phone=? AND revoked_at IS NULL""",('13800138000',)).fetchone()[0] == 1
connection.execute("""UPDATE hhba_apply_extension_sessions SET revoked_at=?
 WHERE phone=? AND revoked_at IS NULL""",
 ('2026-11-06T04:02:00Z','13800138000'))
assert connection.execute("""SELECT COUNT(*) FROM hhba_apply_extension_sessions
 WHERE phone=? AND revoked_at IS NULL""",('13800138000',)).fetchone()[0] == 0
print('HHBA limited browser pairing: one-time code, device revocation PASS')

# AES-GCM ciphertext is the only durable profile representation. The SQLite
# handoff is atomically claimed and cannot be replayed or claimed after expiry.
connection.execute("""INSERT INTO hhba_apply_profile_transfers
 (phone,resume_id,nonce_hex,cipher_hex,created_at,expires_at)
 VALUES(?,?,?,?,?,?)""",
 ('13800138000','00000000-0000-4000-8000-000000000001','a'*24,'b'*180,
  '2026-11-06T04:00:00Z','2026-11-06T04:05:00Z'))
lease=connection.execute("""UPDATE hhba_apply_profile_transfers SET claimed_at=?
 WHERE phone=? AND claimed_at IS NULL AND expires_at>? RETURNING nonce_hex,cipher_hex""",
 ('2026-11-06T04:01:00Z','13800138000','2026-11-06T04:01:00Z')).fetchone()
assert lease==('a'*24,'b'*180)
assert connection.execute("""UPDATE hhba_apply_profile_transfers SET claimed_at=?
 WHERE phone=? AND claimed_at IS NULL AND expires_at>? RETURNING nonce_hex,cipher_hex""",
 ('2026-11-06T04:01:01Z','13800138000','2026-11-06T04:01:01Z')).fetchone() is None
connection.execute("DELETE FROM hhba_apply_profile_transfers WHERE phone='13800138000'")
assert connection.execute("SELECT COUNT(*) FROM hhba_apply_profile_transfers").fetchone()[0]==0
print('HHBA structured CV sync: encrypted-only schema + atomic one-use profile claim PASS')

# User-owned application ledger never mutates HHBA paid task/credit rows.
before=credits()
connection.execute("INSERT INTO hhba_candidate_applications (id,phone,job_key,company,position,application_url,status,source,evidence_kind,recorded_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",(
 '11111111-1111-4111-8111-111111111111','13800138000','example:company:role','示例企业','运营实习','https://example.com/jobs/123','pending','edge','none','2026-11-07T00:00:00Z','2026-11-07T00:00:00Z'))
assert connection.execute('SELECT status FROM hhba_candidate_applications WHERE phone=?',('13800138000',)).fetchone()[0]=='pending'
try:
 connection.execute("INSERT INTO hhba_candidate_applications (id,phone,job_key,company,position,application_url,status,source,evidence_kind,recorded_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",(
 '22222222-2222-4222-8222-222222222222','13800138000','example:company:role','示例企业','运营实习','https://example.com/jobs/123','confirmed','edge','success_notice','2026-11-07T00:01:00Z','2026-11-07T00:01:00Z'))
 raise AssertionError('Duplicate applicant+job key must be rejected')
except sqlite3.IntegrityError:
 pass
connection.execute("UPDATE hhba_candidate_applications SET status='confirmed',evidence_kind='success_notice' WHERE phone=?",('13800138000',))
assert connection.execute("SELECT status FROM hhba_candidate_applications WHERE phone=?",('13800138000',)).fetchone()[0]=='confirmed'
assert credits()==before,'application records must never spend or mint credits'
try:
 connection.execute("INSERT INTO hhba_candidate_applications (id,phone,job_key,company,position,application_url,status,source,evidence_kind,recorded_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",(
 '33333333-3333-4333-8333-333333333333','13800138000','bad:status','示例企业','运营','https://example.com','approved','edge','none','2026-11-07T00:01:00Z','2026-11-07T00:01:00Z'))
 raise AssertionError('Unapproved application status accepted')
except sqlite3.IntegrityError:
 pass
print('HHBA private application history: dedupe, constrained statuses and billing isolation PASS')
