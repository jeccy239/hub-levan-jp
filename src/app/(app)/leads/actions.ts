"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireApprover, requireUser } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { runLeadResearchAgent } from "@/agents/leadResearchAgent";
import {
  approveAndSendMessage,
  draftOutreachMessage,
  recordAndClassifyReply,
  rejectMessage,
} from "@/agents/salesAgent";
import { generateMeetingBriefing } from "@/agents/salesResearchAgent";
import {
  approveProposal,
  recordMeetingAndDraftProposal,
  rejectProposal,
  signContract,
} from "@/agents/proposalAgent";

export async function createLead(formData: FormData) {
  await requireUser();

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
  await requireUser();
  await draftOutreachMessage(leadId);
  revalidatePath(`/leads/${leadId}`);
}

export async function approveMessage(messageId: string, leadId: string) {
  const user = await requireApprover();
  await approveAndSendMessage(messageId, user.id);
  await logAudit({ userId: user.id, action: "outreach.approve", targetType: "outreach_message", targetId: messageId });
  revalidatePath(`/leads/${leadId}`);
}

export async function declineMessage(messageId: string, leadId: string) {
  const user = await requireApprover();
  await rejectMessage(messageId, user.id);
  await logAudit({ userId: user.id, action: "outreach.reject", targetType: "outreach_message", targetId: messageId });
  revalidatePath(`/leads/${leadId}`);
}

export async function submitReply(formData: FormData) {
  await requireUser();
  const leadId = String(formData.get("leadId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!leadId || !body) return;

  await recordAndClassifyReply(leadId, body);
  revalidatePath(`/leads/${leadId}`);
}

export async function generateBriefing(leadId: string) {
  await requireUser();
  await generateMeetingBriefing(leadId);
  revalidatePath(`/leads/${leadId}`);
}

export async function submitMeetingTranscript(formData: FormData) {
  await requireUser();
  const meetingId = String(formData.get("meetingId") ?? "");
  const leadId = String(formData.get("leadId") ?? "");
  const transcript = String(formData.get("transcript") ?? "").trim();
  if (!meetingId || !transcript) return;

  await recordMeetingAndDraftProposal(meetingId, transcript);
  revalidatePath(`/leads/${leadId}`);
}

export async function approveProposalAction(proposalId: string, leadId: string) {
  const user = await requireApprover();
  await approveProposal(proposalId, user.id);
  await logAudit({ userId: user.id, action: "proposal.approve", targetType: "proposal", targetId: proposalId });
  revalidatePath(`/leads/${leadId}`);
}

export async function rejectProposalAction(proposalId: string, leadId: string) {
  const user = await requireApprover();
  await rejectProposal(proposalId, user.id);
  await logAudit({ userId: user.id, action: "proposal.reject", targetType: "proposal", targetId: proposalId });
  revalidatePath(`/leads/${leadId}`);
}

export async function signContractAction(formData: FormData) {
  const user = await requireApprover();
  const proposalId = String(formData.get("proposalId") ?? "");
  const leadId = String(formData.get("leadId") ?? "");
  const plan = String(formData.get("plan") ?? "").trim();
  const monthlyFeeJpy = Number(formData.get("monthlyFeeJpy") ?? 0);
  if (!proposalId || !plan || !monthlyFeeJpy) return;

  const contract = await signContract({ proposalId, plan, monthlyFeeJpy });
  await logAudit({
    userId: user.id,
    action: "contract.sign",
    targetType: "contract",
    targetId: contract.id,
    detail: { plan, monthlyFeeJpy },
  });
  revalidatePath(`/leads/${leadId}`);
}
