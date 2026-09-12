"use server";

import { revalidatePath } from "next/cache";
import { getSenderName, requireApprover, requireUser } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { discoverProspectCompanies } from "@/agents/leadResearchAgent";
import { registerEcShopProspects, parseShopUrls } from "@/agents/ecShopResearchAgent";
import { draftTemplate, sendBulkOutreach, sendTestEmail } from "@/agents/salesAgent";
import { GbizApiError, GbizNotConfiguredError } from "@/lib/gbizinfo";
import { collectRecipients, parseManualEmails, type Recipient } from "@/lib/recipients";
import { saveThanksEmailConfig, unresolvedThanksTokens } from "@/lib/thanksEmail";

export async function runProspectingAction(formData?: FormData) {
  await requireUser();
  const prefecture = String(formData?.get("prefecture") ?? "") || undefined;
  const page = Number(formData?.get("page") ?? 1) || 1;

  try {
    const r = await discoverProspectCompanies({ prefecture, page, limit: 10 });
    revalidatePath("/sales-ai");
    return { ok: true as const, ...r };
  } catch (e) {
    if (e instanceof GbizNotConfiguredError || e instanceof GbizApiError) {
      return { ok: false as const, error: e.message };
    }
    throw e;
  }
}

export async function runEcShopProspectingAction(formData?: FormData) {
  await requireUser();
  const category = String(formData?.get("category") ?? "");
  const urlsRaw = String(formData?.get("urls") ?? "");
  const urls = parseShopUrls(urlsRaw);

  if (!category) {
    return { ok: false as const, error: "カテゴリを選択してください。" };
  }
  if (urls.length === 0) {
    return { ok: false as const, error: "有効なショップURLが1件もありません。" };
  }

  const r = await registerEcShopProspects({ urls, category });
  revalidatePath("/sales-ai");
  return { ok: true as const, ...r };
}

export async function sendTestEmailAction(formData: FormData) {
  const user = await requireUser();
  const subjectTemplate = String(formData.get("subject") ?? "");
  const bodyTemplate = String(formData.get("body") ?? "");
  const to = String(formData.get("to") ?? "").trim() || user.email;
  const sampleJson = String(formData.get("sample") ?? "");
  const bodyFormat = formData.get("bodyFormat") === "html" ? ("html" as const) : ("text" as const);

  let sample: { name: string; website: string; tools: string[]; seoGaps: string[] } | undefined;
  try {
    sample = sampleJson ? JSON.parse(sampleJson) : undefined;
  } catch {
    sample = undefined;
  }

  return sendTestEmail({ subjectTemplate, bodyTemplate, to, sample, bodyFormat, senderName: await getSenderName() });
}

export async function draftTemplateAction(instruction: string) {
  await requireUser();
  return draftTemplate(instruction);
}

export async function sendBulkOutreachAction(formData: FormData) {
  const user = await requireApprover();
  const subjectTemplate = String(formData.get("subject") ?? "").trim();
  const bodyTemplate = String(formData.get("body") ?? "").trim();
  const recipientIds = formData.getAll("recipientIds").map(String);
  const manualRaw = String(formData.get("manualEmails") ?? "");
  const bodyFormat = formData.get("bodyFormat") === "html" ? ("html" as const) : ("text" as const);

  if (!subjectTemplate || !bodyTemplate) {
    throw new Error("件名と本文を入力してください。");
  }

  // 画面から来るのはIDだけで、宛先アドレスはサーバ側で引き直す。アドレスを
  // クライアントから受け取る作りにすると、任意の相手に送れてしまう。
  const { recipients: known } = await collectRecipients();
  const byId = new Map(known.map((r) => [r.id, r]));

  const selected: Recipient[] = [];
  for (const id of recipientIds) {
    const r = byId.get(id);
    if (r) selected.push(r);
  }

  // 手入力ぶんだけは既存IDが無いのでここで組み立てる
  const { valid, invalid } = parseManualEmails(manualRaw);
  if (invalid.length > 0) {
    throw new Error(`メールアドレスとして解釈できない入力があります: ${invalid.slice(0, 3).join("、")}`);
  }

  const alreadySelected = new Set(selected.map((r) => r.email.toLowerCase()));
  for (const email of valid) {
    if (alreadySelected.has(email)) continue;
    alreadySelected.add(email);
    selected.push({
      id: `manual:${email}`,
      kind: "manual",
      name: email.split("@")[1] ?? email,
      email,
      meta: null,
      website: "",
      tools: [],
      seoGaps: [],
      alreadyContacted: false,
    });
  }

  if (selected.length === 0) {
    throw new Error("送信先を1件以上指定してください。");
  }

  const outcome = await sendBulkOutreach({
    recipients: selected,
    subjectTemplate,
    bodyTemplate,
    approvedById: user.id,
    senderName: await getSenderName(),
    bodyFormat,
  });

  await logAudit({
    userId: user.id,
    action: "sales_ai.bulk_send",
    targetType: "outreach_message",
    targetId: "batch",
    detail: {
      requested: outcome.total,
      delivered: outcome.delivered,
      recorded: outcome.recorded,
      failed: outcome.failed.length,
      manualCount: valid.length,
      emailConfigured: outcome.emailConfigured,
    },
  });

  revalidatePath("/sales-ai");
  revalidatePath("/leads");
  return outcome;
}

/**
 * 新規登録者への自動サンクスメールの設定を保存する。有効にすると、WEBRISに
 * 新規登録（企業アカウント）があったとき cron が自動でこの文面を送信する。
 * 顧客への実送信につながる設定なので承認者権限を必須にする。
 */
export async function saveThanksEmailConfigAction(formData: FormData) {
  const user = await requireApprover();
  const enabled = formData.get("enabled") === "1";
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!subject || !body) throw new Error("件名と本文を入力してください。");

  const bad = [...new Set([...unresolvedThanksTokens(subject), ...unresolvedThanksTokens(body)])];
  if (bad.length > 0) {
    throw new Error(
      `この自動メールで使える差込変数は {{company}} / {{sender}} / {{webris_url}} / {{company_address}} だけです。未対応: ${bad.join("、")}`,
    );
  }
  if (!body.includes("{{company_address}}")) {
    throw new Error("特定電子メール法により、送信者情報 {{company_address}} を本文に含めてください。");
  }

  await saveThanksEmailConfig({ enabled, subject, body });
  await logAudit({
    userId: user.id,
    action: "webris.thanks_email.save",
    targetType: "app_setting",
    targetId: "webris_thanks_email",
    detail: { enabled },
  });
  revalidatePath("/sales-ai/compose");
  return { ok: true as const, enabled };
}
