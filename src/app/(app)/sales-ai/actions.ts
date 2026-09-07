"use server";

import { revalidatePath } from "next/cache";
import { requireApprover, requireUser } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { discoverProspectCompanies } from "@/agents/leadResearchAgent";
import { draftTemplate, sendBulkOutreach, sendTestEmail } from "@/agents/salesAgent";
import { GbizApiError, GbizNotConfiguredError } from "@/lib/gbizinfo";

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
  const sampleLeadId = String(formData.get("sampleLeadId") ?? "") || undefined;

  return sendTestEmail({ subjectTemplate, bodyTemplate, to, sampleLeadId });
}

export async function draftTemplateAction(instruction: string) {
  await requireUser();
  return draftTemplate(instruction);
}

export async function sendBulkOutreachAction(formData: FormData) {
  const user = await requireApprover();
  const subjectTemplate = String(formData.get("subject") ?? "").trim();
  const bodyTemplate = String(formData.get("body") ?? "").trim();
  const leadIds = formData.getAll("leadIds").map(String);

  if (!subjectTemplate || !bodyTemplate || leadIds.length === 0) {
    throw new Error("件名・本文・送信先企業をすべて指定してください。");
  }

  const outcome = await sendBulkOutreach({ leadIds, subjectTemplate, bodyTemplate, approvedById: user.id });

  await logAudit({
    userId: user.id,
    action: "sales_ai.bulk_send",
    targetType: "outreach_message",
    targetId: "batch",
    detail: {
      requested: outcome.total,
      delivered: outcome.delivered,
      recorded: outcome.recorded,
      skippedNoAddress: outcome.skippedNoAddress.length,
      failed: outcome.failed.length,
      emailConfigured: outcome.emailConfigured,
    },
  });

  revalidatePath("/sales-ai");
  revalidatePath("/leads");
  return outcome;
}
