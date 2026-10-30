// 阿里云 PNVS 短信验证码客户端。
// 来源：ECS 测试站 /srv/hhba-test-login/real-backend/pnvs.mjs 的源码级重写，
// 不是逐字节副本；签名、模板与凭证优先级等已核对项与测试包一致。
// 本文件不含任何真实凭证：凭证只从实例元数据或环境变量读取。
import crypto from 'node:crypto';

export const PNVS_SIGN_NAME = '恒创联众';
export const PNVS_TEMPLATE_CODE = '100001';
const PNVS_ENDPOINT = 'dypnsapi.aliyuncs.com';
const PNVS_VERSION = '2017-05-25';
const METADATA_BASE = 'http://100.100.100.200/latest/meta-data/ram/security-credentials/';
const ROLE_TIMEOUT_MS = 2000;
const CACHE_EARLY_MS = 300000;

// 阿里云 RPC 百分号编码：encodeURIComponent 不编码 !'()*，需单独转义。
function enc(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

let cached = null;

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error('METADATA_HTTP_' + res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// 实例角色临时凭证：先取角色名，再取该角色的临时凭证；过期前 300000 毫秒失效。
async function roleCreds() {
  if (cached && Date.now() < cached.expiresAt - CACHE_EARLY_MS) return cached;
  const role = (await fetchText(METADATA_BASE, ROLE_TIMEOUT_MS)).trim();
  if (!role) throw new Error('PNVS_NO_ROLE');
  const data = JSON.parse(await fetchText(METADATA_BASE + encodeURIComponent(role), ROLE_TIMEOUT_MS));
  if (!data.AccessKeyId || !data.AccessKeySecret) throw new Error('PNVS_NOT_CONFIGURED');
  cached = {
    accessKeyId: data.AccessKeyId,
    accessKeySecret: data.AccessKeySecret,
    securityToken: data.SecurityToken || '',
    role,
    source: 'instance-role',
    expiresAt: data.Expiration ? Date.parse(data.Expiration) : 0,
  };
  return cached;
}

// 环境变量备用凭证。
function envCreds() {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) throw new Error('PNVS_NOT_CONFIGURED');
  return {
    accessKeyId,
    accessKeySecret,
    securityToken: process.env.ALIBABA_CLOUD_SECURITY_TOKEN || '',
    role: null,
    source: 'env',
    expiresAt: null,
  };
}

// 凭证优先级：实例角色优先，失败回退环境变量。
async function creds() {
  try {
    return await roleCreds();
  } catch {
    return envCreds();
  }
}

// 供健康接口使用：只报告可用性与来源，不返回凭证本身。
export async function pnvsCredentialSource() {
  try {
    const c = await creds();
    return { available: true, source: c.source, role: c.role, expiresAt: c.expiresAt };
  } catch {
    return { available: false, source: null, role: null, expiresAt: null };
  }
}

function signParams(params, accessKeySecret) {
  const canonical = Object.keys(params).sort().map((k) => enc(k) + '=' + enc(params[k])).join('&');
  const stringToSign = 'GET&' + enc('/') + '&' + enc(canonical);
  const signature = crypto.createHmac('sha1', accessKeySecret + '&').update(stringToSign).digest('base64');
  return canonical + '&Signature=' + enc(signature);
}

async function rpc(action, extra, failureCode) {
  const c = await creds();
  const params = {
    AccessKeyId: c.accessKeyId,
    Action: action,
    Format: 'JSON',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: crypto.randomBytes(16).toString('hex'),
    SignatureVersion: '1.0',
    Timestamp: isoNow(),
    Version: PNVS_VERSION,
    ...extra,
  };
  if (c.securityToken) params.SecurityToken = c.securityToken;
  const query = signParams(params, c.accessKeySecret);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch('https://' + PNVS_ENDPOINT + '/?' + query, { signal: controller.signal });
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

// 发码：验证码由 PNVS 生成，后端不生成、不存储验证码原文。
export async function pnvsSend(phone, templateCode) {
  return rpc('SendSmsVerifyCode', {
    PhoneNumber: phone,
    SignName: PNVS_SIGN_NAME,
    TemplateCode: templateCode || PNVS_TEMPLATE_CODE,
    TemplateParam: JSON.stringify({ code: '##code##' }),
  }, 'PNVS_SEND_FAILED');
}

// 验码：直接向 PNVS 校验，后端不比对本地存储的验证码。
export async function pnvsCheck(phone, code) {
  return rpc('CheckSmsVerifyCode', {
    PhoneNumber: phone,
    VerifyCode: code,
  }, 'PNVS_CHECK_FAILED');
}
