"use server";

import { revalidatePath } from "next/cache";
import { generateKeywordPlan } from "@/agents/seoStrategyAgent";
import { generateContentDraft } from "@/agents/contentAgent";
import {
  approveContentItem,
  publishContentItem,
  runQualityControl,
  sendContentItemBackToDraft,
} from "@/agents/qualityControlAgent";
import { approveAndSendReport, generateMonthlyReport, type MonthlyMetrics } from "@/agents/reportAgent";
import { approveUpsell, generateUpsellCandidates, markUpsellPresented, rejectUpsell } from "@/agents/upsellAgent";
import { requireApprover, requireUser } from "@/lib/authz";
import { logAudit } from "@/lib/audit";

export async function generateKeywords(projectId: string) {
  await requireUser();
  await generateKeywordPlan(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function generateDraft(contentItemId: string, projectId: string) {
  await requireUser();
  await generateContentDraft(contentItemId);
  revalidatePath(`/projects/${projectId}`);
}

export async function runQc(contentItemId: string, projectId: string) {
  await requireUser();
  await runQualityControl(contentItemId);
  revalidatePath(`/projects/${projectId}`);
}

export async function approveContent(contentItemId: string, projectId: string) {
  const user = await requireApprover();
  await approveContentItem(contentItemId);
  await logAudit({ userId: user.id, action: "content.approve", targetType: "content_item", targetId: contentItemId });
  revalidatePath(`/projects/${projectId}`);
}

export async function sendBackToDraft(contentItemId: string, projectId: string) {
  await requireUser();
  await sendContentItemBackToDraft(contentItemId);
  revalidatePath(`/projects/${projectId}`);
}

export async function publishContent(contentItemId: string, projectId: string) {
  const user = await requireApprover();
  await publishContentItem(contentItemId);
  await logAudit({ userId: user.id, action: "content.publish", targetType: "content_item", targetId: contentItemId });
  revalidatePath(`/projects/${projectId}`);
}

export async function generateReport(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const period = String(formData.get("period") ?? "").trim();
  if (!projectId || !period) return;

  const metrics: MonthlyMetrics = {
    pageViews: Number(formData.get("pageViews") ?? 0),
    users: Number(formData.get("users") ?? 0),
    topQueries: String(formData.get("topQueries") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    avgRanking: Number(formData.get("avgRanking") ?? 0),
    ctr: Number(formData.get("ctr") ?? 0),
    conversions: Number(formData.get("conversions") ?? 0),
    cvr: Number(formData.get("cvr") ?? 0),
  };

  await generateMonthlyReport(projectId, period, metrics);
  revalidatePath(`/projects/${projectId}`);
}

export async function sendReport(reportId: string, projectId: string) {
  const user = await requireApprover();
  await approveAndSendReport(reportId);
  await logAudit({ userId: user.id, action: "report.send", targetType: "report", targetId: reportId });
  revalidatePath(`/projects/${projectId}`);
}

export async function generateUpsell(customerId: string, projectId: string) {
  await requireUser();
  await generateUpsellCandidates(customerId);
  revalidatePath(`/projects/${projectId}`);
}

export async function approveUpsellAction(upsellId: string, projectId: string) {
  const user = await requireApprover();
  await approveUpsell(upsellId, user.id);
  await logAudit({ userId: user.id, action: "upsell.approve", targetType: "upsell_proposal", targetId: upsellId });
  revalidatePath(`/projects/${projectId}`);
}

export async function rejectUpsellAction(upsellId: string, projectId: string) {
  const user = await requireApprover();
  await rejectUpsell(upsellId, user.id);
  await logAudit({ userId: user.id, action: "upsell.reject", targetType: "upsell_proposal", targetId: upsellId });
  revalidatePath(`/projects/${projectId}`);
}

export async function presentUpsellAction(upsellId: string, projectId: string) {
  const user = await requireApprover();
  await markUpsellPresented(upsellId);
  await logAudit({ userId: user.id, action: "upsell.present", targetType: "upsell_proposal", targetId: upsellId });
  revalidatePath(`/projects/${projectId}`);
}
