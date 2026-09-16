import { prisma } from "@/lib/prisma";
import { daysBetween } from "./range";
import type { DateRange } from "./types";

/**
 * AdsService — 広告費。Meta / Google 広告の API 連携はまだ無いので、
 * HUB で手入力された実績（WebrisAdSpend）だけを使う。
 * 入力が1件も無い期間は「未入力」として扱い、0円とは表示しない。
 */

export { AD_CHANNELS, AD_CHANNEL_LABEL, type AdChannel } from "./adChannels";

export type AdSpendEntry = {
  id: string;
  channel: string;
  periodStart: string;
  periodEnd: string;
  amountJpy: number;
  memo: string | null;
};

export type AdSpendSummary = {
  /** 表示期間に1件でも入力が重なっているか。false なら CAC/ROAS は「—」 */
  hasData: boolean;
  totalJpy: number;
  byChannel: Record<string, number>;
  /** 入力期間の一部だけが表示期間に重なる場合、日割りで按分している */
  prorated: boolean;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

function overlapDays(a: DateRange, b: DateRange) {
  const start = a.start > b.start ? a.start : b.start;
  const end = a.end < b.end ? a.end : b.end;
  return start > end ? 0 : daysBetween({ start, end });
}

export async function listAdSpend(limit = 50): Promise<AdSpendEntry[]> {
  const rows = await prisma.webrisAdSpend.findMany({ orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }], take: limit });
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    periodStart: iso(r.periodStart),
    periodEnd: iso(r.periodEnd),
    amountJpy: r.amountJpy,
    memo: r.memo,
  }));
}

export async function summarizeAdSpend(range: DateRange): Promise<AdSpendSummary> {
  const rows = await prisma.webrisAdSpend.findMany({
    where: {
      periodStart: { lte: new Date(`${range.end}T00:00:00Z`) },
      periodEnd: { gte: new Date(`${range.start}T00:00:00Z`) },
    },
  });
  const byChannel: Record<string, number> = {};
  let prorated = false;
  for (const r of rows) {
    const entry = { start: iso(r.periodStart), end: iso(r.periodEnd) };
    const total = daysBetween(entry);
    const inside = overlapDays(entry, range);
    if (inside < total) prorated = true;
    const amount = Math.round((r.amountJpy * inside) / total);
    byChannel[r.channel] = (byChannel[r.channel] ?? 0) + amount;
  }
  return {
    hasData: rows.length > 0,
    totalJpy: Object.values(byChannel).reduce((a, b) => a + b, 0),
    byChannel,
    prorated,
  };
}
