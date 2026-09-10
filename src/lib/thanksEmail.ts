// 新規登録者への自動サンクスメールの設定と描画。
//
// - 有効/無効と文面は AppSetting テーブルに保存（/sales-ai/compose で編集）。
// - 未保存ならコード側の既定文面（thanksEmailTemplate.ts）を使う。
// - 実送信は WEBRIS 契約検知の cron（webrisContractNotify.ts）から呼ばれる。

import { getSettings, setSettings } from "@/lib/appSettings";
import { htmlToText, sendEmail, type SendResult } from "@/lib/email";
import { SENDER_COMPANY_ADDRESS, SENDER_COMPANY_NAME, WEBRIS_PUBLIC_URL } from "@/lib/senderIdentity";
import {
  THANKS_EMAIL_ALLOWED_TOKENS,
  THANKS_EMAIL_DEFAULT_BODY,
  THANKS_EMAIL_DEFAULT_SUBJECT,
} from "@/lib/thanksEmailTemplate";

export const SETTING_KEYS = {
  enabled: "webris_thanks_email.enabled",
  subject: "webris_thanks_email.subject",
  body: "webris_thanks_email.body",
} as const;

const SENDER_NAME = process.env.SUPPORT_SENDER_NAME || "サポート担当";

export type ThanksEmailConfig = {
  enabled: boolean;
  subject: string;
  body: string;
  /** 差出人名（cron送信時に使用。編集画面では読み取り専用で表示） */
  senderName: string;
};

export async function getThanksEmailConfig(): Promise<ThanksEmailConfig> {
  const s = await getSettings([SETTING_KEYS.enabled, SETTING_KEYS.subject, SETTING_KEYS.body]);
  return {
    enabled: s[SETTING_KEYS.enabled] === "1",
    subject: s[SETTING_KEYS.subject] ?? THANKS_EMAIL_DEFAULT_SUBJECT,
    body: s[SETTING_KEYS.body] ?? THANKS_EMAIL_DEFAULT_BODY,
    senderName: SENDER_NAME,
  };
}

export async function saveThanksEmailConfig(input: {
  enabled: boolean;
  subject: string;
  body: string;
}): Promise<void> {
  await setSettings({
    [SETTING_KEYS.enabled]: input.enabled ? "1" : "0",
    [SETTING_KEYS.subject]: input.subject,
    [SETTING_KEYS.body]: input.body,
  });
}

/** 差込。登録直後に確実に取れる値のみ対応する。 */
export function fillThanksTemplate(
  template: string,
  ctx: { company: string; sender: string; webrisUrl: string },
): string {
  return template
    .replaceAll("{{company}}", ctx.company)
    .replaceAll("{{sender}}", ctx.sender)
    .replaceAll("{{webris_url}}", ctx.webrisUrl)
    .replaceAll("{{company_address}}", `${SENDER_COMPANY_NAME}\n${SENDER_COMPANY_ADDRESS}`);
}

/** template中の {{...}} のうち、対応トークン以外を返す。空なら送信可。 */
export function unresolvedThanksTokens(template: string): string[] {
  const found = new Set(template.match(/\{\{[^}\n]{1,40}\}\}/g) ?? []);
  return [...found].filter((t) => !THANKS_EMAIL_ALLOWED_TOKENS.includes(t as never));
}

/**
 * 新規登録者1名にサンクスメールを送る。呼び出し側で enabled を確認済みの前提。
 * 戻り値は WebrisContractNotice.thanksEmailStatus にそのまま入れる文字列。
 */
export async function sendThanksEmail(params: {
  to: string;
  company: string;
  config: ThanksEmailConfig;
}): Promise<string> {
  const ctx = { company: params.company, sender: params.config.senderName, webrisUrl: WEBRIS_PUBLIC_URL };
  const subject = fillThanksTemplate(params.config.subject, ctx);
  const html = fillThanksTemplate(params.config.body, ctx);

  const bad = unresolvedThanksTokens(params.config.body).concat(unresolvedThanksTokens(params.config.subject));
  if (bad.length > 0) return `failed:未対応の差込変数 ${[...new Set(bad)].join("、")}`;

  const result: SendResult = await sendEmail({ to: params.to, subject, text: htmlToText(html), html });
  return result.delivered ? "delivered" : `failed:${result.reason}`;
}
