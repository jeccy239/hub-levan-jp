"use server";

import { revalidatePath } from "next/cache";
import { requireApprover, requireUser } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { discoverProspectCompanies } from "@/agents/leadResearchAgent";
import { sendBulkOutreach, sendTestEmail } from "@/agents/salesAgent";

export async function runProspectingAction() {
  await requireUser();
  const created = await discoverProspectCompanies(10);
  revalidatePath("/sales-ai");
  return { count: created.length };
}

export async function sendTestEmailAction(formData: FormData) {
  await requireUser();
  const subjectTemplate = String(formData.get("subject") ?? "");
  const bodyTemplate = String(formData.get("body") ?? "");
  return sendTestEmail({ subjectTemplate, bodyTemplate });
}

export async function sendBulkOutreachAction(formData: FormData) {
  const user = await requireApprover();
  const subjectTemplate = String(formData.get("subject") ?? "").trim();
  const bodyTemplate = String(formData.get("body") ?? "").trim();
  const leadIds = formData.getAll("leadIds").map(String);

  if (!subjectTemplate || !bodyTemplate || leadIds.length === 0) {
    throw new Error("件名・本文・送信先企業をすべて指定してください。");
  }

  const sentIds = await sendBulkOutreach({ leadIds, subjectTemplate, bodyTemplate, approvedById: user.id });

  await logAudit({
    userId: user.id,
    action: "sales_ai.bulk_send",
    targetType: "outreach_message",
    targetId: sentIds[0] ?? "batch",
    detail: { count: sentIds.length, leadIds },
  });

  revalidatePath("/sales-ai");
  revalidatePath("/leads");
  return { count: sentIds.length };
}
