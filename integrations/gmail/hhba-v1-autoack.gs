/**
 * HHBA V1 / Gmail inbound auto-acknowledgement (optional Google Apps Script).
 * Bound to the owner's Google account; no passwords or API keys are stored here.
 * This script is NOT activated by a GitHub/Cloudflare deployment: installation
 * and Gmail OAuth approval in script.google.com are necessary.
 *
 * Safety: only HHBA-related direct inbox mail, not unrelated personal mail;
 * one acknowledgement per thread, excludes spam, system senders, list mail,
 * outgoing replies and historical messages. Never auto-invite or reject.
 */
const HHBA_ACK = Object.freeze({
  label: 'HHBA/已自动回执',
  functionName: 'hhbaCheckInboundMessages',
  maxThreads: 60,
  maxDaily: 25,
  maxPerRun: 10,
  search: 'in:inbox newer_than:2d',
  brand: '汇方职场 · HHBA',
});

function hhbaInstallAutoAcknowledgement() {
  const mailbox = Session.getEffectiveUser().getEmail();
  if (!mailbox || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mailbox)) {
    throw new Error('请使用收件 Gmail 账号授权此脚本，无法识别当前邮箱。');
  }
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('HHBA_ACK_START')) {
    properties.setProperty('HHBA_ACK_START', String(Date.now()));
  }
  properties.setProperty('HHBA_ACK_MAILBOX', mailbox);
  if (!GmailApp.getUserLabelByName(HHBA_ACK.label)) {
    GmailApp.createLabel(HHBA_ACK.label);
  }
  const exists = ScriptApp.getProjectTriggers().some((trigger) =>
    trigger.getHandlerFunction() === HHBA_ACK.functionName);
  if (!exists) {
    ScriptApp.newTrigger(HHBA_ACK.functionName).timeBased().everyMinutes(5).create();
  }
  Logger.log('HHBA 自动回执定时任务已安装，仅处理安装后收到的 HHBA 相关邮件。');
}
function hhbaStopAutoAcknowledgement() {
  ScriptApp.getProjectTriggers().filter((trigger) =>
    trigger.getHandlerFunction() === HHBA_ACK.functionName)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  Logger.log('HHBA 自动回执已停止。');
}
function hhbaSenderAddress(from) {
  const source = String(from || '');
  const wrapped = source.match(/<([^<>]+@[^<>]+)>/);
  const plain = wrapped ? wrapped[1] : source;
  const matched = plain.match(/[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return matched ? matched[0].toLowerCase() : '';
}
function hhbaHtmlEscape(text) {
  return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function hhbaLooksAutomated(message) {
  const from = message.getFrom();
  const subject = message.getSubject() || '';
  if (/(?:no[-_.]?reply|auto[-_.]?reply|mailer[-_.]?daemon|postmaster|do-not-reply)@/i.test(from)) return true;
  if (/(?:自动回复|外出自动回复|delivery status|undeliverable|mail delivery|退信|验证码|verification code)/i.test(subject)) return true;
  // A reply to the website's Resend acknowledgment is human correspondence; do not start another automated response.
  if (/(?:已收到你的合作申请|已收到你的来信|感谢你愿意认识 HHBA)/i.test(subject)) return true;
  if (/@(?:notify\.hhba\.work|resend\.dev|resend\.com)>?$/i.test(from)) return true;
  // Inspect headers only; do not process attachments or quoted personal messages.
  const header = String(message.getRawContent() || '').split(/\r?\n\r?\n/, 1)[0].slice(0, 20000);
  if (/^Auto-Submitted:\s*(?!no\b)/im.test(header)) return true;
  if (/^Precedence:\s*(?:bulk|list|junk)/im.test(header)) return true;
  if (/^List-(?:Id|Unsubscribe):/im.test(header)) return true;
  if (/^X-Auto-Response-Suppress:\s*(?:all|autoreply|auto-reply)/im.test(header)) return true;
  return false;
}
function hhbaLooksBusinessRelated(message) {
  const subject = message.getSubject() || '';
  const bodyStart = (message.getPlainBody() || '').slice(0, 1000);
  return /HHBA|汇方职场|汇方|加入我们|合作意向|合作申请|招聘合作|企业合作|加入团队/i.test(subject + '\n' + bodyStart);
}
function hhbaInboundHtml(senderName) {
  const name = hhbaHtmlEscape(senderName || '朋友');
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<style>@media(max-width:640px){.shell{width:100%!important}.pad{padding-left:24px!important;padding-right:24px!important}}</style></head>'
    + '<body style="margin:0;background:#f2f6fb"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f6fb"><tr><td align="center" style="padding:28px 12px">'
    + '<table role="presentation" class="shell" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border-radius:12px;overflow:hidden">'
    + '<tr><td height="5" style="background:#1169e8;font-size:0">&nbsp;</td></tr>'
    + '<tr><td style="padding:25px 37px"><table role="presentation" width="100%"><tr><td width="57"><img src="https://hhba.work/images/email/hhba-mail-logo.png" width="51" height="51" alt="HHBA Logo" style="display:block;border:0"></td>'
    + '<td><strong style="font:700 20px Arial,Microsoft YaHei,sans-serif;color:#172b4d">汇方职场 <span style="color:#1169e8">· HHBA</span></strong>'
    + '<div style="color:#667a92;font:12px/1.8 Arial,Microsoft YaHei,sans-serif">让机会与人才，找到彼此。</div></td>'
    + '<td align="right" style="color:#93a3b8;font:bold 9px Arial,sans-serif;letter-spacing:1px">HUMAN<br>CAPABILITY<br>NETWORK</td></tr></table></td></tr>'
    + '<tr><td><img src="https://hhba.work/images/email/hhba-mail-banner.jpg" width="600" alt="HHBA 团队协作照片" style="display:block;border:0;width:100%;height:auto"></td></tr>'
    + '<tr><td class="pad" style="padding:34px 40px 26px"><div style="color:#1169e8;font:bold 11px Arial,sans-serif;letter-spacing:1.5px">WE HAVE RECEIVED YOUR EMAIL</div>'
    + '<h1 style="font:700 25px/1.4 Arial,Microsoft YaHei,sans-serif;color:#172b4d;margin:14px 0">感谢来信，我们已经收到</h1>'
    + '<p style="font:15px/1.9 Arial,Microsoft YaHei,sans-serif;color:#172b4d">你好，' + name + '：</p>'
    + '<p style="font:15px/1.9 Arial,Microsoft YaHei,sans-serif;color:#172b4d">感谢你主动联系汇方职场 · HHBA。你的邮件已经送达，我们会认真阅读，并根据实际情况安排后续沟通。</p>'
    + '<p style="font:15px/1.9 Arial,Microsoft YaHei,sans-serif;color:#172b4d">无论最终是否有机会合作，都感谢这份信任。</p>'
    + '<p style="background:#f2f7ff;border-left:3px solid #1169e8;padding:19px;color:#315788;font:14px/1.8 Arial,Microsoft YaHei,sans-serif">我们相信，每一份认真表达的期待，都值得被认真回应。</p>'
    + '<p style="font:14px/1.9 Arial,Microsoft YaHei,sans-serif;color:#172b4d">祝好，<br><strong>汇方职场 · HHBA 团队</strong></p>'
    + '<p style="font:12px/1.7 Arial,Microsoft YaHei,sans-serif;color:#8da1b8">这是一封自动收件确认邮件，不代表审核通过、合作邀约或承诺回复时间。</p></td></tr>'
    + '<tr><td style="padding:23px 40px;background:#f8fafe;font:12px/1.8 Arial,Microsoft YaHei,sans-serif;color:#667a92"><strong style="color:#172b4d">汇方职场 · HHBA</strong>　'
    + '<a href="https://hhba.work/" style="color:#1169e8">hhba.work</a><br>让机会与人才，找到彼此。<br>© 2026 HHBA</td></tr>'
    + '</table></td></tr></table></body></html>';
}
function hhbaCheckInboundMessages() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const properties = PropertiesService.getScriptProperties();
    const mailbox = String(properties.getProperty('HHBA_ACK_MAILBOX') || '').toLowerCase();
    const start = Number(properties.getProperty('HHBA_ACK_START') || 0);
    if (!mailbox || !start) return; // Nothing happens before install/authorization.
    const label = GmailApp.getUserLabelByName(HHBA_ACK.label) || GmailApp.createLabel(HHBA_ACK.label);
    const day = Utilities.formatDate(new Date(), 'Asia/Shanghai', 'yyyyMMdd');
    const countKey = 'HHBA_ACK_SENT_' + day;
    let count = Number(properties.getProperty(countKey) || '0');
    let sentThisRun = 0;
    const threads = GmailApp.search(HHBA_ACK.search, 0, HHBA_ACK.maxThreads);
    for (const thread of threads) {
      if (count >= HHBA_ACK.maxDaily || sentThisRun >= HHBA_ACK.maxPerRun) break;
      if (thread.getLabels().some((item) => item.getName() === HHBA_ACK.label)) continue;
      const messages = thread.getMessages();
      // Ignore threads already handled by owner or the script.
      if (messages.some((msg) => hhbaSenderAddress(msg.getFrom()) === mailbox)) {
        label.addToThread(thread);
        continue;
      }
      const incoming = messages.find((msg) =>
        msg.getDate().getTime() >= start
        && hhbaSenderAddress(msg.getFrom()) !== mailbox
        && hhbaLooksBusinessRelated(msg)
        && !hhbaLooksAutomated(msg));
      if (!incoming) continue;
      const address = hhbaSenderAddress(incoming.getFrom());
      if (!address || address === mailbox) continue;
      // Mark each message ID to mitigate retries if a trigger runs again.
      const key = 'HHBA_ACK_DONE_' + incoming.getId();
      if (properties.getProperty(key)) { label.addToThread(thread); continue; }
      const subject = 'Re: ' + (incoming.getSubject() || '联系汇方职场 HHBA').replace(/^Re:\s*/i, '').slice(0, 180);
      const display = String(incoming.getFrom() || '').split('<')[0].replace(/["<>]/g, '').trim().slice(0, 60);
      const text = '你好，' + (display || '朋友') + '：\n\n感谢你主动联系汇方职场 HHBA。你的邮件已经送达，我们会认真阅读并根据实际情况安排后续沟通。\n\n本邮件为自动收件确认，不代表审核通过、合作邀约或承诺回复时间。\n\n汇方职场 · HHBA 团队\n让机会与人才，找到彼此。';
      GmailApp.sendEmail(address, subject, text, {
        name: HHBA_ACK.brand, replyTo: mailbox, htmlBody: hhbaInboundHtml(display),
      });
      properties.setProperty(key, String(Date.now()));
      label.addToThread(thread);
      count++;
      sentThisRun++;
      properties.setProperty(countKey, String(count));
    }
  } finally {
    lock.releaseLock();
  }
}
