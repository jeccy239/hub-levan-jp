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
import { prisma } from "@/lib/prisma";

export async function generateKeywords(projectId: string) {
  await generateKeywordPlan(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function generateDraft(contentItemId: string, projectId: string) {
  await generateContentDraft(contentItemId);
  revalidatePath(`/projects/${projectId}`);
}

export async function runQc(contentItemId: string, projectId: string) {
  await runQualityControl(contentItemId);
  revalidatePath(`/projects/${projectId}`);
}

export async function approveContent(contentItemId: string, projectId: string) {
  await approveContentItem(contentItemId);
  revalidatePath(`/projects/${projectId}`);
}

export async function sendBackToDraft(contentItemId: string, projectId: string) {
  await sendContentItemBackToDraft(contentItemId);
  revalidatePath(`/projects/${projectId}`);
}

export async function publishContent(contentItemId: string, projectId: string) {
  await publishContentItem(contentItemId);
  revalidatePath(`/projects/${projectId}`);
}

const OPERATOR_EMAIL = "operator@levan.jp";

async function getOperatorId(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: OPERATOR_EMAIL },
    update: {},
    create: { email: OPERATOR_EMAIL, name: "Operator", role: "ADMIN" },
  });
  return user.id;
}

export async function generateReport(formData: FormData) {
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
  await approveAndSendReport(reportId);
  revalidatePath(`/projects/${projectId}`);
}

export async function generateUpsell(customerId: string, projectId: string) {
  await generateUpsellCandidates(customerId);
  revalidatePath(`/projects/${projectId}`);
}

export async function approveUpsellAction(upsellId: string, projectId: string) {
  const operatorId = await getOperatorId();
  await approveUpsell(upsellId, operatorId);
  revalidatePath(`/projects/${projectId}`);
}

export async function rejectUpsellAction(upsellId: string, projectId: string) {
  const operatorId = await getOperatorId();
  await rejectUpsell(upsellId, operatorId);
  revalidatePath(`/projects/${projectId}`);
}

export async function presentUpsellAction(upsellId: string, projectId: string) {
  await markUpsellPresented(upsellId);
  revalidatePath(`/projects/${projectId}`);
}
