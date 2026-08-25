"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { runLeadResearchAgent } from "@/agents/leadResearchAgent";
import {
  approveAndSendMessage,
  draftOutreachMessage,
  recordAndClassifyReply,
  rejectMessage,
} from "@/agents/salesAgent";

// Phase 1 has no auth yet — every approval is attributed to a fixed seed
// operator account. Real user sessions arrive with RBAC in a later phase.
const OPERATOR_EMAIL = "operator@levan.jp";

async function getOperatorId(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: OPERATOR_EMAIL },
    update: {},
    create: { email: OPERATOR_EMAIL, name: "Operator", role: "ADMIN" },
  });
  return user.id;
}

export async function createLead(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;

  if (!name || !website) {
    throw new Error("会社名とURLは必須です");
  }

  const company = await prisma.company.create({
    data: { name, website, industry, location },
  });
  const lead = await prisma.lead.create({ data: { companyId: company.id } });

  await runLeadResearchAgent(lead.id);

  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function generateOutreachDraft(leadId: string) {
  await draftOutreachMessage(leadId);
  revalidatePath(`/leads/${leadId}`);
}

export async function approveMessage(messageId: string, leadId: string) {
  const operatorId = await getOperatorId();
  await approveAndSendMessage(messageId, operatorId);
  revalidatePath(`/leads/${leadId}`);
}

export async function declineMessage(messageId: string, leadId: string) {
  const operatorId = await getOperatorId();
  await rejectMessage(messageId, operatorId);
  revalidatePath(`/leads/${leadId}`);
}

export async function submitReply(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!leadId || !body) return;

  await recordAndClassifyReply(leadId, body);
  revalidatePath(`/leads/${leadId}`);
}
