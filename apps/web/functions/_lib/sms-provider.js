// 短信商适配器：发码与验码的统一接口，PNVS 只是第一实现。
//
// 自定义短信商接入方式：实现一个同名对象
//   { name, configured, sendCode(phone, purpose), verifyCode(phone, code) }
// 其中 sendCode 返回 { bizId }（无业务 id 时为 null），verifyCode 成功返回 true、
// 失败抛错（err.code 为上游错误码）；然后只改本文件底部的 createSmsProvider，
// 不动任何路由 handler。绝不允许“本地生成验证码并比对”的实现混进来：
// 验证码必须由短信商生成与核验，后端永远不生成、不存储验证码原文。
//
// PNVS 参数与 10 月 ECS 测试后端 apps/real-backend/pnvs.mjs 一致：
// 端点 dypnsapi.aliyuncs.com，版本 2017-05-25，RPC 签名 HMAC-SHA1，
// SendSmsVerifyCode（签名与模板见下，TemplateParam 为 {"code":"##code##","min":"5"}，
// 表示“请短信商生成验证码”，模板 100001 内容含 ${code} 与 ${min} 两个变量，缺 min 会报
// isv.INVALID_PARAMETERS；CodeType=1（纯数字）为占位符发码时的必填项），CheckSmsVerifyCode 验码。
// 凭证只从 Pages Secret 环境变量读取，本文件与仓库中绝不出现真实密钥值。

export const PNVS_SIGN_NAME = '恒创联众';
export const PNVS_TEMPLATE_CODE = '100001';
const PNVS_ENDPOINT = 'dypnsapi.aliyuncs.com';
const PNVS_VERSION = '2017-05-25';

// 阿里云 RPC 百分号编码：encodeURIComponent 不编码 !'()*，需单独转义。
function enc(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function hmacSha1Base64(secret, text) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  let binary = '';
  const bytes = new Uint8Array(sig);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export class PnvsSmsProvider {
  name = 'pnvs';
  constructor(env) {
    this.env = env || {};
  }
  get configured() {
    return Boolean(this.env.ALIBABA_CLOUD_ACCESS_KEY_ID && this.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET);
  }
  async rpc(action, extra, failureCode) {
    if (!this.configured) {
      const err = new Error('PNVS_NOT_CONFIGURED');
      err.code = 'PNVS_NOT_CONFIGURED';
      throw err;
    }
    const params = {
      AccessKeyId: this.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
      Action: action,
      Format: 'JSON',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      SignatureVersion: '1.0',
      Timestamp: isoNow(),
      Version: PNVS_VERSION,
      ...extra,
    };
    if (this.env.ALIBABA_CLOUD_SECURITY_TOKEN) params.SecurityToken = this.env.ALIBABA_CLOUD_SECURITY_TOKEN;
    const canonical = Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join('&');
    const stringToSign = `GET&${enc('/')}&${enc(canonical)}`;
    const signature = await hmacSha1Base64(`${this.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET}&`, stringToSign);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(`https://${PNVS_ENDPOINT}/?${canonical}&Signature=${enc(signature)}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.Code !== 'OK') {
        const err = new Error(data.Code || failureCode);
        err.code = data.Code || failureCode;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }
  async sendCode(phone) {
    const data = await this.rpc(
      'SendSmsVerifyCode',
      {
        PhoneNumber: phone,
        SignName: PNVS_SIGN_NAME,
        TemplateCode: PNVS_TEMPLATE_CODE,
        TemplateParam: JSON.stringify({ code: '##code##', min: '5' }),
        CodeType: 1,
      },
      'PNVS_SEND_FAILED',
    );
    return { bizId: data.BizId || null };
  }
  async verifyCode(phone, code) {
    await this.rpc(
      'CheckSmsVerifyCode',
      { PhoneNumber: phone, VerifyCode: code },
      'PNVS_CHECK_FAILED',
    );
    return true;
  }
}

// 工厂：默认 pnvs。HHBA_SMS_PROVIDER 设为其他值时，不静默回退到任何
// “假发码”实现，而是返回未配置的 pnvs 适配器，让接口明确报
// PNVS_NOT_CONFIGURED，而不是谎称短信已发出。
export function createSmsProvider(env) {
  const wanted = String((env || {}).HHBA_SMS_PROVIDER || 'pnvs').trim().toLowerCase();
  if (wanted && wanted !== 'pnvs') {
    const provider = new PnvsSmsProvider(env);
    provider.name = wanted;
    // 标记为“未实现该短信商”：configured 为 false 时 handler 直接拒绝发码。
    Object.defineProperty(provider, 'configured', { value: false });
    return provider;
  }
  return new PnvsSmsProvider(env);
}
