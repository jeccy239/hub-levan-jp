// Outbound email delivery via Resend. Without RESEND_API_KEY the whole app
// stays in the same simulate-only mode it has always run in: nothing is
// delivered, and the caller is told so explicitly rather than being allowed
// to believe mail went out.

import { Resend } from "resend";

export type SendResult =
  | { delivered: true; providerId: string }
  | { delivered: false; reason: string };

let client: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  /** Plain-text body; converted to minimal HTML so the tracking pixel works. */
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const resend = getClient();
  const from = process.env.MAIL_FROM;

  if (!resend || !from) {
    return {
      delivered: false,
      reason: "メール配信が未設定です（RESEND_API_KEY / MAIL_FROM）。DBには記録しましたが実際には送信されていません。",
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html ?? textToHtml(params.text),
      replyTo: params.replyTo ?? process.env.MAIL_REPLY_TO ?? undefined,
    });

    if (error) return { delivered: false, reason: error.message };
    return { delivered: true, providerId: data?.id ?? "" };
  } catch (e) {
    return { delivered: false, reason: e instanceof Error ? e.message : "送信に失敗しました" };
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Plain text -> HTML, linkifying bare URLs so the click tracker is clickable. */
export function textToHtml(text: string): string {
  const body = escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replaceAll("\n", "<br>");
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#111">${body}</div>`;
}

/**
 * HTML -> プレーンテキスト。HTMLメールでも text/plain を必ず同梱するために使う。
 * 片方しか入れないメールは迷惑メール判定を受けやすく、テキスト専用の
 * メールクライアントでは中身が読めなくなる。
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    // リンクは「文言 (URL)」にして、テキストでも遷移先が分かるようにする
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const text = String(label).replace(/<[^>]+>/g, "").trim();
      return text && text !== href ? `${text} (${href})` : href;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "・")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}
