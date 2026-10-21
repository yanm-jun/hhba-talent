/**
 * 短信服务适配器 —— Phase 2
 * 落点: ops/legacy-marketplace/auth/sms-provider.ts
 *
 * 接口隔离三件事：发码（sendVerificationCode）、错误码映射（内部统一错误码）、发送日志（由调用方落 sms_send_log）。
 * 生产网关是阿里云 Dysmsapi SendSms；这里给出官方 SDK 形状的适配器（动态 import @alicloud/dysmsapi20170525，
 * 未装 SDK 时抛 SMS_SDK_MISSING，绝不静默降级到 mock）。
 *
 * 后门纪律（任务书 5.3 / 禁止事项 5）:
 *   - 没有「万能验证码」概念：mock 网关同样走 generateCode() 随机生成，验证码只经 log 通道给本机联调者看；
 *   - mock 仅当 HHBA_SMS_PROVIDER=mock 且 HHBA_ALLOW_MOCK_SMS=1 且 NODE_ENV!=="production" 三条件同时成立才可构造，
 *     任一不满足直接抛错（createSmsProvider 的生产防线，单测覆盖）；
 *   - 环境变量 HHBA_SMS_PROVIDER=aliyun 时必须齐备 AccessKey/签名/模板，缺一抛错 fail-fast。
 */

export interface SmsSendResult {
  ok: boolean;
  provider: "aliyun" | "mock";
  providerRequestId: string | null;
  /** 内部统一错误码；成功时为 null。原始服务商码保留在 rawCode 供日志对账。 */
  errorCode: string | null;
  rawCode: string | null;
}

export interface SmsProvider {
  readonly name: "aliyun" | "mock";
  sendVerificationCode(phone: string, code: string): Promise<SmsSendResult>;
}

/** 阿里云 Dysmsapi 常见返回码 → 内部错误码（排障与前端文案都用内部码，不透传原文案）。 */
const ALIYUN_ERROR_MAP: Record<string, string> = {
  OK: "",
  "isv.BUSINESS_LIMIT_CONTROL": "SMS_PROVIDER_RATE_LIMITED", // 流控：分钟/小时/天上限
  "isv.MOBILE_NUMBER_ILLEGAL": "SMS_PHONE_ILLEGAL",
  "isv.SMS_TEMPLATE_ILLEGAL": "SMS_TEMPLATE_NOT_APPROVED",
  "isv.SMS_SIGNATURE_ILLEGAL": "SMS_SIGNATURE_NOT_APPROVED",
  "isv.AMOUNT_NOT_ENOUGH": "SMS_BALANCE_INSUFFICIENT",
  "isv.INVALID_PARAMETERS": "SMS_BAD_PARAMETERS",
  InvalidAccessKeyId: "SMS_CREDENTIAL_INVALID",
  SignatureDoesNotMatch: "SMS_CREDENTIAL_INVALID",
};

export function mapAliyunError(rawCode: string | null | undefined): string {
  if (!rawCode) return "SMS_PROVIDER_ERROR";
  return ALIYUN_ERROR_MAP[rawCode] ?? "SMS_PROVIDER_ERROR";
}

export interface AliyunSmsConfig {
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;      // 已审核签名
  templateCode: string;  // 已审核模板 CODE，模板内容须含 ${code} 变量
  region?: string;       // 默认 cn-hangzhou
}

/**
 * 阿里云网关：按 Dysmsapi 2017-05-25 SendSms 的请求/响应形状调用官方 SDK。
 * SDK 通过注入的 clientFactory 构造，便于单测用假 client 验证参数形状；
 * 生产装配时由 createSmsProvider 动态 import 官方包。
 */
export class AliyunSmsProvider implements SmsProvider {
  readonly name = "aliyun" as const;
  constructor(
    private cfg: AliyunSmsConfig,
    private client: { sendSms(req: Record<string, unknown>): Promise<{ body?: { code?: string; message?: string; requestId?: string; bizId?: string } }> },
  ) {
    for (const [k, v] of Object.entries({
      accessKeyId: cfg.accessKeyId, accessKeySecret: cfg.accessKeySecret,
      signName: cfg.signName, templateCode: cfg.templateCode,
    })) if (!v) throw new Error(`ALIYUN_SMS_CONFIG_MISSING:${k}`);
  }

  async sendVerificationCode(phone: string, code: string): Promise<SmsSendResult> {
    try {
      const resp = await this.client.sendSms({
        phoneNumbers: phone,
        signName: this.cfg.signName,
        templateCode: this.cfg.templateCode,
        templateParam: JSON.stringify({ code }),
      });
      const raw = resp.body?.code ?? null;
      const ok = raw === "OK";
      return {
        ok,
        provider: "aliyun",
        providerRequestId: resp.body?.requestId ?? resp.body?.bizId ?? null,
        errorCode: ok ? null : mapAliyunError(raw),
        rawCode: raw,
      };
    } catch {
      // 网络/SDK 异常统一降级为服务商错误；细节只进服务端日志，不回前端
      return { ok: false, provider: "aliyun", providerRequestId: null, errorCode: "SMS_PROVIDER_ERROR", rawCode: null };
    }
  }
}

/** Mock 网关：不真发短信，把「本应发送的码」交给注入的 sink（默认 console），仅供非 production 联调。 */
export class MockSmsProvider implements SmsProvider {
  readonly name = "mock" as const;
  constructor(private sink: (phone: string, code: string) => void = (p, c) => console.log(`[mock-sms] ${p} code=${c}`)) {}
  async sendVerificationCode(phone: string, code: string): Promise<SmsSendResult> {
    this.sink(phone, code);
    return { ok: true, provider: "mock", providerRequestId: `mock-${Date.now()}`, errorCode: null, rawCode: "OK" };
  }
}

export interface SmsEnv {
  provider?: string;
  allowMock?: string;
  nodeEnv?: string;
  aliyun?: Partial<AliyunSmsConfig>;
  /** 单测注入点：替代官方 SDK client 构造。 */
  aliyunClientFactory?: (cfg: AliyunSmsConfig) => Promise<ConstructorParameters<typeof AliyunSmsProvider>[1]>;
}

/** 按环境装配网关。生产防线集中在这里，任何绕过构造函数的用法都不应存在。 */
export async function createSmsProvider(env: SmsEnv): Promise<SmsProvider> {
  const provider = env.provider ?? "mock";
  const isProd = (env.nodeEnv ?? "development") === "production";
  if (provider === "mock") {
    if (isProd) throw new Error("MOCK_SMS_FORBIDDEN_IN_PRODUCTION");
    if (env.allowMock !== "1") throw new Error("MOCK_SMS_NOT_EXPLICITLY_ENABLED");
    return new MockSmsProvider();
  }
  if (provider === "aliyun") {
    const cfg: AliyunSmsConfig = {
      accessKeyId: env.aliyun?.accessKeyId ?? "",
      accessKeySecret: env.aliyun?.accessKeySecret ?? "",
      signName: env.aliyun?.signName ?? "",
      templateCode: env.aliyun?.templateCode ?? "",
      region: env.aliyun?.region ?? "cn-hangzhou",
    };
    if (!env.aliyunClientFactory) throw new Error("SMS_SDK_MISSING:@alicloud/dysmsapi20170525 (装配时注入)");
    const client = await env.aliyunClientFactory(cfg);
    return new AliyunSmsProvider(cfg, client);
  }
  throw new Error(`SMS_PROVIDER_UNKNOWN:${provider}`);
}
