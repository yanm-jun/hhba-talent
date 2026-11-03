// Cloudflare Pages Function：加入我们合作意向接收口（/api/join-apply）。
// 流程：校验 -> 限流 -> D1 存申请记录 -> 调 Resend 发邮件给负责人（含简历附件）。
// 收件人、发件人、发信密钥一律走 Pages 环境变量，绝不写进代码与仓库：
//   JOIN_OWNER_EMAIL：负责人收件邮箱（必填，否则报 EMAIL_NOT_CONFIGURED）
//   RESEND_API_KEY：Resend 发信密钥（必填，否则报 EMAIL_NOT_CONFIGURED）
//   JOIN_FROM_EMAIL：发件人，默认 onboarding@resend.dev（未做域名验证时的测试发件人）
// 简历不长期存库：只随邮件发附件，D1 只记文件名与大小；邮件失败时申请记录仍在库里可找回。
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIRECTIONS = new Set(['tech-lead', 'backend', 'ai-data', 'governance', 'business', 'product', 'other']);
const WEEKLY = new Set(['每周 1–5 小时', '每周 6–15 小时', '每周 16–30 小时', '每周 30 小时以上', '待进一步沟通']);
const MODES = new Set(['远程协作', '线上线下结合', '未来正式岗位', '灵活协商']);
const RESUME_EXTS = new Set(['pdf', 'doc', 'docx']);
const RESUME_MAX_BYTES = 10 * 1024 * 1024;
const IP_MAX_PER_HOUR = 5;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
const bad = (code, status = 400) => json({ ok: false, error: code }, status);
const iso = (ms) => new Date(ms).toISOString();

function extOf(name) {
  const parts = String(name || '').toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}
async function ipHash(request) {
  const raw =
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '';
  if (!raw) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return bad('METHOD_NOT_ALLOWED', 405);
  const db = env.HHBA_PNVS_AUTH_DB ?? env.HHBA_JOIN_DB ?? env.HHBA_AUTH_DB;
  if (!db) return bad('AUTH_DB_NOT_CONFIGURED', 503);
  const nowMs = Date.now();
  let form;
  try {
    form = await request.formData();
  } catch {
    return bad('INVALID_INPUT', 400);
  }
  const get = (k) => String(form.get(k) || '').trim();
  const name = get('name');
  const email = get('email');
  const direction = get('direction');
  const experience = get('experience');
  const strength = get('strength');
  const portfolio = get('portfolio');
  const weeklyTime = get('weeklyTime');
  const mode = get('mode');
  const note = get('note');
  const acknowledged = form.get('acknowledged') === 'true';
  const resume = form.get('resume');
  const hasResume = resume && typeof resume === 'object' && typeof resume.arrayBuffer === 'function' && resume.size > 0;

  if (!name || name.length > 80 || !EMAIL_RE.test(email) || email.length > 180 || !direction || !experience || experience.length < 10) {
    return bad('INVALID_INPUT', 400);
  }
  if (!DIRECTIONS.has(direction)) return bad('INVALID_DIRECTION', 400);
  if (experience.length > 1200 || strength.length > 600 || portfolio.length > 400 || note.length > 600) {
    return bad('INVALID_INPUT', 400);
  }
  if (!WEEKLY.has(weeklyTime) || !MODES.has(mode) || !acknowledged) return bad('INVALID_INPUT', 400);
  let resumeName = null;
  let resumeSize = 0;
  let resumeBytes = null;
  if (hasResume) {
    if (!RESUME_EXTS.has(extOf(resume.name)) || resume.size > RESUME_MAX_BYTES) return bad('INVALID_RESUME', 400);
    resumeName = resume.name;
    resumeSize = resume.size;
    resumeBytes = new Uint8Array(await resume.arrayBuffer());
  }

  const hash = await ipHash(request);
  if (hash) {
    const row = await db
      .prepare("SELECT COUNT(*) AS n FROM hhba_join_applications WHERE ip_hash=? AND created_at>=?")
      .bind(hash, iso(nowMs - 60 * 60 * 1000))
      .first();
    if (Number(row?.n || 0) >= IP_MAX_PER_HOUR) return bad('RATE_LIMITED', 429);
  }

  // 先存库，再发邮件：邮件失败时申请仍可找回，不会悄悄丢掉。
  const idRow = await db
    .prepare('INSERT INTO hhba_join_applications(name,email,direction,experience,strength,portfolio,weekly_time,mode,note,resume_filename,resume_size,ip_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(name, email, direction, experience, strength, portfolio, weeklyTime, mode, note, resumeName, resumeSize, hash, iso(nowMs))
    .run();
  const applicationId = idRow?.meta?.last_row_id || null;

  const ownerEmail = String(env.JOIN_OWNER_EMAIL || '').trim();
  const apiKey = String(env.RESEND_API_KEY || '').trim();
  if (!ownerEmail || !apiKey) return bad('EMAIL_NOT_CONFIGURED', 503);
  const from = String(env.JOIN_FROM_EMAIL || 'onboarding@resend.dev').trim();
  const directionLabel = direction;
  const textLines = [
    `称呼：${name}`,
    `邮箱：${email}`,
    `合作方向：${directionLabel}`,
    `每周投入：${weeklyTime}`,
    `合作方式：${mode}`,
    `相关技能和项目经历：${experience}`,
    strength ? `想解决的问题：${strength}` : '',
    portfolio ? `作品链接：${portfolio}` : '',
    note ? `备注：${note}` : '',
    resumeName ? `简历：${resumeName}（${resumeSize} 字节，随邮件附件）` : '简历：未上传',
    applicationId ? `申请记录 ID：${applicationId}` : '',
  ].filter(Boolean);
  const attachments = [];
  if (resumeBytes) {
    let b64 = '';
    const chunk = 0x8000;
    for (let i = 0; i < resumeBytes.length; i += chunk) {
      b64 += String.fromCharCode.apply(null, resumeBytes.subarray(i, i + chunk));
    }
    attachments.push({ filename: resumeName, content: btoa(b64) });
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [ownerEmail],
        reply_to: email,
        subject: `HHBA 加入我们：${directionLabel} - ${name}`,
        text: textLines.join('\n'),
        html: `<h2>HHBA 加入我们合作意向</h2>${textLines.map((l) => `<p>${esc(l)}</p>`).join('')}`,
        attachments: attachments.length ? attachments : undefined,
      }),
    });
    if (!res.ok) return bad('EMAIL_SEND_FAILED', 502);
  } catch {
    return bad('EMAIL_SEND_FAILED', 502);
  }
  return json({ ok: true, application_id: applicationId });
}
