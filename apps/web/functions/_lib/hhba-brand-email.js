// HHBA V1 transactional email templates: table layout, inline CSS, escaped user content.
// Public images are immutable brand assets. Text and links remain readable when images are blocked.
const IMAGE_ROOT = 'https://hhba.work/images/email/';
const BLUE = '#1169e8';
const NAVY = '#172b4d';
const MUTED = '#667a92';
const DIRECTIONS = Object.freeze({
  'tech-lead': '技术负责人 / 全栈架构工程师',
  backend: '后端与数据库工程师',
  'ai-data': '官方招聘数据与检索工程师',
  'ai-match': 'AI 匹配与推荐算法工程师',
  'edge-apply': 'Edge 网申插件工程师',
  'content-growth': '新媒体内容与用户增长伙伴',
  governance: '企业治理与劳动权益研究伙伴',
  business: '企业合作与商业发展伙伴',
  product: '产品设计 / 前端体验伙伴',
  other: '其他专业 / 自荐加入',
});

export function directionName(value) {
  return DIRECTIONS[value] || '开放合作方向';
}
export function escapeEmailHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function readable(value) {
  return escapeEmailHtml(value).replace(/\r\n|\r|\n/g, '<br>');
}
function singleLine(value) {
  return String(value ?? '').replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').trim();
}
function paragraph(body) {
  return '<p style="margin:0 0 18px;color:' + NAVY + ';font:15px/1.9 Arial,Microsoft YaHei,PingFang SC,sans-serif;">' + body + '</p>';
}
function divider() {
  return '<tr><td style="padding:0 40px"><div style="height:1px;background:#e8edf5;line-height:1px;font-size:0">&nbsp;</div></td></tr>';
}
function section(title, body) {
  return '<tr><td class="pad" style="padding:18px 40px 12px"><div style="font:700 15px/1.5 Arial,Microsoft YaHei,sans-serif;color:' + NAVY + ';padding-bottom:12px">' + title + '</div>' + body + '</td></tr>';
}
function field(label, value) {
  return '<tr><td valign="top" width="110" style="padding:8px 8px 8px 0;color:' + MUTED + ';font:13px/1.7 Arial,Microsoft YaHei,sans-serif">' + label + '</td><td style="padding:8px 0;color:' + NAVY + ';font:600 14px/1.7 Arial,Microsoft YaHei,sans-serif;word-break:break-word">' + readable(value || '—') + '</td></tr>';
}
function brandHeader() {
  return '<tr><td style="padding:25px 37px 22px;background:#fff"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + '<td width="58" valign="middle"><img src="' + IMAGE_ROOT + 'hhba-mail-logo.png" alt="HHBA 品牌标志" width="51" height="51" style="display:block;width:51px;height:51px;border:0"></td>'
    + '<td valign="middle"><div style="color:' + NAVY + ';font:bold 20px/1.3 Arial,Microsoft YaHei,sans-serif">汇方职场 <span style="color:' + BLUE + '">· HHBA</span></div>'
    + '<div style="color:' + MUTED + ';font:12px/1.6 Arial,Microsoft YaHei,sans-serif;margin-top:4px">让机会与人才，找到彼此。</div></td>'
    + '<td align="right" valign="middle" style="font:bold 10px/1.45 Arial,sans-serif;letter-spacing:.8px;color:#93a3b8">HUMAN<br>CAPABILITY<br>NETWORK</td>'
    + '</tr></table></td></tr>';
}
function brandPhoto() {
  return '<tr><td style="padding:0;background:#eaf1fb"><img src="' + IMAGE_ROOT + 'hhba-mail-banner.jpg" alt="HHBA 团队协作品牌照片" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>';
}
function intro(eyebrow, headline, subtitle) {
  return '<tr><td class="pad" style="padding:36px 40px 23px">'
    + '<div style="color:' + BLUE + ';font:bold 11px/1.5 Arial,sans-serif;letter-spacing:1.8px;margin-bottom:13px">' + escapeEmailHtml(eyebrow) + '</div>'
    + '<h1 style="margin:0 0 13px;color:' + NAVY + ';font:bold 26px/1.4 Arial,Microsoft YaHei,sans-serif">' + escapeEmailHtml(headline) + '</h1>'
    + '<p style="margin:0;color:' + MUTED + ';font:14px/1.8 Arial,Microsoft YaHei,sans-serif">' + escapeEmailHtml(subtitle) + '</p>'
    + '</td></tr>';
}
function brandFooter() {
  return '<tr><td style="padding:25px 40px 30px;background:#f8fafe"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
    + '<td style="color:' + NAVY + ';font:bold 13px/1.5 Arial,Microsoft YaHei,sans-serif">汇方职场 · HHBA</td>'
    + '<td align="right"><a href="https://hhba.work/" style="color:' + BLUE + ';text-decoration:none;font:12px/1.5 Arial,sans-serif">hhba.work</a></td></tr>'
    + '<tr><td colspan="2" style="padding-top:9px;color:' + MUTED + ';font:12px/1.8 Arial,Microsoft YaHei,sans-serif">让机会与人才，找到彼此。<br>© 2026 HHBA · 让每一次沟通都值得认真对待。</td></tr>'
    + '</table></td></tr>';
}
function emailShell({ subject, preheader, eyebrow, headline, subtitle, body, photoFirst = true }) {
  const header = brandHeader();
  const photo = brandPhoto();
  const lead = intro(eyebrow, headline, subtitle);
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">'
    + '<title>' + escapeEmailHtml(subject) + '</title><style>@media only screen and (max-width:640px){.email-shell{width:100%!important}.pad{padding-left:24px!important;padding-right:24px!important}}</style></head>'
    + '<body style="margin:0;padding:0;background:#f2f6fb;-webkit-text-size-adjust:100%">'
    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' + escapeEmailHtml(preheader) + '</div>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f2f6fb"><tr><td align="center" style="padding:32px 12px 40px">'
    + '<table role="presentation" width="600" class="email-shell" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#fff;border-collapse:separate;border-radius:14px;overflow:hidden">'
    + '<tr><td height="5" style="height:5px;line-height:5px;font-size:0;background:' + BLUE + '">&nbsp;</td></tr>'
    + header + (photoFirst ? photo + lead : lead + photo) + divider() + body + brandFooter()
    + '</table></td></tr></table></body></html>';
}
function dateBeijing(iso) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso)) + '（北京时间）';
  } catch {
    return '';
  }
}
export function renderJoinOwnerEmail(data) {
  const d = directionName(data.direction);
  const subject = 'HHBA 新合作申请｜' + singleLine(d) + '｜' + singleLine(data.name).slice(0, 80);
  const baseInfo = '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" border="0">'
    + field('申请人', data.name) + field('联系邮箱', data.email)
    + field('合作方向', d) + field('每周投入', data.weeklyTime)
    + field('合作方式', data.mode) + field('申请时间', dateBeijing(data.createdAt))
    + (data.applicationId ? field('记录编号', '#' + data.applicationId) : '')
    + '</table>';
  const skillHtml = paragraph(readable(data.experience))
    + (data.strength ? '<div style="color:' + MUTED + ';font-size:12px;font-weight:700;margin-bottom:8px">希望解决的问题</div>' + paragraph(readable(data.strength)) : '');
  let works = '';
  if (data.portfolio) {
    let url = '';
    try {
      const parsed = new URL(data.portfolio);
      if (['http:', 'https:'].includes(parsed.protocol)) url = parsed.href;
    } catch {}
    works = url
      ? '<a href="' + escapeEmailHtml(url) + '" style="color:' + BLUE + ';word-break:break-all">' + escapeEmailHtml(data.portfolio) + '</a>'
      : readable(data.portfolio);
  }
  const details = (works ? paragraph('作品链接：' + works) : '')
    + paragraph('简历附件：' + (data.resumeName ? escapeEmailHtml(data.resumeName) + '（随邮件附件发送）' : '未上传'))
    + (data.note ? paragraph('申请人备注：' + readable(data.note)) : '');
  const replyLink = 'mailto:' + encodeURIComponent(String(data.email || '')) + '?subject=' + encodeURIComponent('Re: HHBA 合作申请｜' + d);
  const actions = '<tr><td class="pad" style="padding:22px 40px 37px;text-align:center"><a href="' + escapeEmailHtml(replyLink)
    + '" style="display:inline-block;background:' + BLUE + ';color:#fff;padding:14px 28px;border-radius:7px;text-decoration:none;font:bold 14px/1.5 Arial,Microsoft YaHei,sans-serif">直接回复申请人 →</a>'
    + '<p style="color:#93a3b8;font:11px/1.8 Arial,Microsoft YaHei,sans-serif;margin-top:16px">请核实申请资料；这封通知不构成录用或合作承诺。</p></td></tr>';
  const body = section('01 · 基本信息', baseInfo) + divider()
    + section('02 · 能力与经历', skillHtml) + divider()
    + section('03 · 作品、简历与备注', details) + actions;
  return {
    subject,
    text: ['HHBA 收到新的合作申请', '申请人：' + data.name, '邮箱：' + data.email,
      '合作方向：' + d, '每周投入：' + data.weeklyTime, '合作方式：' + data.mode,
      '申请时间：' + dateBeijing(data.createdAt), '相关技能与项目经历：' + data.experience,
      '想解决的问题：' + (data.strength || '未填写'), '作品链接：' + (data.portfolio || '未填写'),
      '简历：' + (data.resumeName || '未上传'), '备注：' + (data.note || '无'),
      '记录编号：' + (data.applicationId || '—')].join('\n'),
    html: emailShell({ subject, preheader: '一份新的 HHBA 合作意向等待查看',
      eyebrow: 'JOIN US / NEW APPLICATION', headline: '收到一份新的合作意向',
      subtitle: '有人希望与你一起建设 HHBA。请查看申请资料，并按需要回复。',
      body, photoFirst: false }),
  };
}
export function renderJoinReceiptEmail(data) {
  const d = directionName(data.direction);
  const name = singleLine(data.name).slice(0, 80);
  const subject = '【汇方职场 HHBA】已收到你的合作申请';
  const body = '<tr><td class="pad" style="padding:26px 40px 36px">'
    + paragraph('你好，' + escapeEmailHtml(name) + '：')
    + paragraph('感谢你花时间介绍自己的经历，也谢谢你愿意了解尚在建设中的 HHBA。')
    + paragraph('我们已经收到你关于 <strong>「' + escapeEmailHtml(d)
    + '」</strong> 方向的合作意向。团队将结合目前的实际需求认真阅读资料；如果适合进一步交流，我们会通过邮件与你联系。')
    + paragraph('无论未来是否有机会同行，都感谢这份信任。')
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;background:#f2f7ff;border-left:3px solid ' + BLUE
    + '"><tr><td style="padding:20px 22px;color:#315788;font:14px/1.85 Arial,Microsoft YaHei,sans-serif">我们相信，每一份认真表达的期待，都值得被认真回应。</td></tr></table>'
    + '<p style="margin:30px 0 0;color:' + NAVY + ';font:14px/1.9 Arial,Microsoft YaHei,sans-serif">祝好，<br><strong>汇方职场 · HHBA 合作团队</strong></p>'
    + '<p style="margin:13px 0 0;color:#8da1b8;font:12px/1.8 Arial,Microsoft YaHei,sans-serif">你可以直接回复此邮件，与我们继续沟通。自动确认不代表已通过审核或获得合作邀请。</p></td></tr>';
  return {
    subject,
    text: ['你好，' + name + '：', '', '感谢你花时间介绍自己的经历，也谢谢你愿意了解尚在建设中的 HHBA。',
      '我们已经收到你关于「' + d + '」方向的合作意向。团队会认真阅读资料；如果适合进一步交流，我们会通过邮件与你联系。',
      '无论未来是否有机会同行，都感谢这份信任。', '',
      '我们相信，每一份认真表达的期待，都值得被认真回应。', '',
      '汇方职场 · HHBA 合作团队', '让机会与人才，找到彼此。',
      '此邮件是自动收件确认，不代表审核通过或录用承诺。'].join('\n'),
    html: emailShell({ subject, preheader: '你的合作意向，我们已经认真收到。',
      eyebrow: 'WE HAVE RECEIVED YOUR APPLICATION', headline: '感谢你愿意认识 HHBA',
      subtitle: '你的合作意向，我们已经认真收到。', body }),
  };
}
export function renderInboundReceiptEmail(data = {}) {
  const subject = '【汇方职场 HHBA】已收到你的来信';
  const name = singleLine(data.name || '朋友').slice(0, 80);
  const body = '<tr><td class="pad" style="padding:26px 40px 36px">'
    + paragraph('你好，' + escapeEmailHtml(name) + '：')
    + paragraph('感谢你主动联系汇方职场 · HHBA。你的邮件已经送达，我们会认真阅读，并根据实际情况安排后续沟通。')
    + paragraph('这封邮件是自动收件确认，并不代表合作、录用或确定的回复时限。')
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;background:#f2f7ff;border-left:3px solid ' + BLUE
    + '"><tr><td style="padding:20px 22px;color:#315788;font:14px/1.85 Arial,Microsoft YaHei,sans-serif">让每一次真诚的联系，都得到应有的尊重。</td></tr></table>'
    + '<p style="margin:28px 0 0;color:' + NAVY + ';font:14px/1.9 Arial,Microsoft YaHei,sans-serif">祝好，<br><strong>汇方职场 · HHBA 团队</strong></p></td></tr>';
  return { subject,
    text: '你好，' + name + '：\n\n感谢你主动联系汇方职场 HHBA。你的邮件已经送达，我们会认真阅读并根据实际情况安排后续沟通。\n本邮件为自动收件确认，不代表合作、录用或确定的回复时限。\n\n汇方职场 · HHBA 团队\n让机会与人才，找到彼此。',
    html: emailShell({ subject, preheader: '感谢来信，HHBA 已经收到。',
      eyebrow: 'WE HAVE RECEIVED YOUR EMAIL', headline: '感谢来信，我们已经收到',
      subtitle: '每一次真诚的联系，都值得被认真对待。', body }),
  };
}
