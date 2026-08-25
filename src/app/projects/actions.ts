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
