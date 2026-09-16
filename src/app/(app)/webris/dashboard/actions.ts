"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireApprover, requireUser } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AD_CHANNELS } from "@/lib/webrisAnalytics/adChannels";
import { summarizeAdSpend } from "@/lib/webrisAnalytics/adsService";
import { generateAiSummary } from "@/lib/webrisAnalytics/aiSummary";
import { resolveRange } from "@/lib/webrisAnalytics/range";
import { getDashboardData } from "@/lib/webrisAnalytics/webrisService";

export type ActionState = { ok: boolean; message: string } | null;

function rangeFrom(formData: FormData) {
  const get = (k: string) => (formData.get(k) as string | null) ?? undefined;
  return resolveRange({ range: get("range"), compare: get("compare"), from: get("from"), to: get("to") });
}

/** キャッシュを無視してWEBRISから取り直す */
export async function refreshDashboard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const result = await getDashboardData(rangeFrom(formData), { force: true });
  refresh();
  if (!result.error) return { ok: true, message: "最新のデータを取得しました。" };
  return { ok: false, message: result.stale ? `${result.error} 表示中のデータは前回取得分です。` : result.error };
}

export async function generateSummary(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const range = rangeFrom(formData);
  const data = await getDashboardData(range);
  if (!data.payload || !data.fetchedAt) {
    return { ok: false, message: data.error ?? "要約の元になるデータがありません。" };
  }
  try {
    const [ads, adsPrev] = await Promise.all([summarizeAdSpend(range.current), summarizeAdSpend(range.previous)]);
    await generateAiSummary(data.payload, range, ads, adsPrev, data.fetchedAt);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "AI要約の生成に失敗しました。" };
  }
  refresh();
  return { ok: true, message: "AI要約を更新しました。" };
}

const AdSpendInput = z
  .object({
    channel: z.enum(AD_CHANNELS.map((c) => c.value) as [string, ...string[]]),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "開始日を入力してください"),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "終了日を入力してください"),
    amountJpy: z.coerce.number({ error: "金額は数字で入力してください" }).int("金額は整数で入力してください").min(0, "金額は0以上で入力してください").max(100_000_000),
    memo: z.string().max(200).optional(),
  })
  .refine((v) => v.periodStart <= v.periodEnd, { message: "終了日は開始日以降にしてください" });

export async function addAdSpend(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let user;
  try {
    user = await requireApprover();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "権限がありません。" };
  }
  const parsed = AdSpendInput.safeParse({
    channel: formData.get("channel"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    amountJpy: String(formData.get("amountJpy") ?? "").replace(/[,¥\s]/g, ""),
    memo: (formData.get("memo") as string | null)?.trim() || undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };

  const row = await prisma.webrisAdSpend.create({
    data: {
      channel: parsed.data.channel,
      periodStart: new Date(`${parsed.data.periodStart}T00:00:00Z`),
      periodEnd: new Date(`${parsed.data.periodEnd}T00:00:00Z`),
      amountJpy: parsed.data.amountJpy,
      memo: parsed.data.memo ?? null,
      createdById: user.id,
    },
  });
  await logAudit({ userId: user.id, action: "webris_ad_spend.create", targetType: "WebrisAdSpend", targetId: row.id, detail: parsed.data });
  refresh();
  return { ok: true, message: "広告費を登録しました。" };
}

export async function deleteAdSpend(formData: FormData): Promise<void> {
  const user = await requireApprover();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const row = await prisma.webrisAdSpend.delete({ where: { id } }).catch(() => null);
  if (row) {
    await logAudit({ userId: user.id, action: "webris_ad_spend.delete", targetType: "WebrisAdSpend", targetId: id, detail: { channel: row.channel, amountJpy: row.amountJpy } });
  }
  refresh();
}
