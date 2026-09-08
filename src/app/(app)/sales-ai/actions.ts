"use server";

import { revalidatePath } from "next/cache";
import { getSenderName, requireApprover, requireUser } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { discoverProspectCompanies } from "@/agents/leadResearchAgent";
import { draftTemplate, sendBulkOutreach, sendTestEmail } from "@/agents/salesAgent";
import { GbizApiError, GbizNotConfiguredError } from "@/lib/gbizinfo";
import { collectRecipients, parseManualEmails, type Recipient } from "@/lib/recipients";

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

export async function sendTestEmailAction(formData: FormData) {
  const user = await requireUser();
  const subjectTemplate = String(formData.get("subject") ?? "");
  const bodyTemplate = String(formData.get("body") ?? "");
  const to = String(formData.get("to") ?? "").trim() || user.email;
  const sampleJson = String(formData.get("sample") ?? "");

  let sample: { name: string; website: string; tools: string[]; seoGaps: string[] } | undefined;
  try {
    sample = sampleJson ? JSON.parse(sampleJson) : undefined;
  } catch {
    sample = undefined;
  }

  return sendTestEmail({ subjectTemplate, bodyTemplate, to, sample, senderName: await getSenderName() });
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
