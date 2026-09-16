import { z } from "zod";
import { callLlm } from "@/agents/llm";
import { prisma } from "@/lib/prisma";
import type { AdSpendSummary } from "./adsService";
import { buildAlerts, buildChannels, buildFunnel, buildKpis, buildNotFound, buildSeo, sectionData } from "./metrics";
import { rangeCacheKey, type ResolvedRange } from "./range";
import type { Metric, WebrisAnalyticsPayload } from "./types";

/**
 * 「現在のWEBRISの状態」の AI 要約。
 * 画面に出している計算済みの数値だけを渡し、AI に数値を作らせない。
 * 生成はボタン押下時のみ（毎回の表示でAPIを呼ばない）。結果は期間ごとに保存する。
 */

const Impact = z
  .string()
  .transform((v): "高" | "中" | "低" => (/高|high/i.test(v) ? "高" : /低|low/i.test(v) ? "低" : "中"));

// AI の出力の揺れ（件数超過・impact の表記ゆれ）で失敗しないよう、受け取ってから整える。
const SummarySchema = z.object({
  headline: z.string(),
  summary: z.string(),
  good: z.array(z.string()).transform((a) => a.slice(0, 5)),
  concerns: z.array(z.string()).transform((a) => a.slice(0, 5)),
  actions: z
    .array(z.object({ title: z.string(), reason: z.string(), impact: Impact }))
    .transform((a) => a.slice(0, 5)),
  confidence: z.string().default(""),
});

export type AiSummary = z.infer<typeof SummarySchema> & {
  generatedAt: string;
  dataFetchedAt: string;
  model: string;
};

const keyFor = (range: ResolvedRange) => `ai:${rangeCacheKey(range)}`;

export async function getAiSummary(range: ResolvedRange): Promise<AiSummary | null> {
  const row = await prisma.webrisAnalyticsCache.findUnique({ where: { key: keyFor(range) } }).catch(() => null);
  if (!row) return null;
  const parsed = SummarySchema.safeParse(row.payload);
  if (!parsed.success) return null;
  const meta = row.payload as { generatedAt?: string; dataFetchedAt?: string; model?: string };
  return { ...parsed.data, generatedAt: meta.generatedAt ?? row.fetchedAt.toISOString(), dataFetchedAt: meta.dataFetchedAt ?? "", model: meta.model ?? "" };
}

function metricFact(m: Metric) {
  if (m.kind === "value") return { value: Number(m.value.toFixed(4)), previous: m.prev === null ? null : Number(m.prev.toFixed(4)) };
  return { value: null, status: m.kind === "error" ? "取得エラー" : "未計測", reason: m.reason };
}

export function buildFacts(p: WebrisAnalyticsPayload, range: ResolvedRange, ads: AdSpendSummary, adsPrev: AdSpendSummary) {
  const ga4 = sectionData(p.ga4);
  const gsc = sectionData(p.gsc);
  const product = sectionData(p.product);
  const funnel = buildFunnel(p);
  return {
    period: range.label,
    comparedWith: range.compareLabel,
    dataSources: {
      ga4: p.ga4.status,
      searchConsole: p.gsc.status,
      stripe: p.revenue.status,
      webrisDb: p.product.status,
    },
    kpis: Object.fromEntries(buildKpis(p, ads, adsPrev).map((k) => [k.label, metricFact(k.metric)])),
    mrrJpy: product?.totals.mrrJpy ?? null,
    payingAccounts: product?.totals.paying ?? null,
    totalAccounts: product?.totals.companies ?? null,
    adSpendJpy: ads.hasData ? ads.totalJpy : "未入力",
    channels: ga4
      ? buildChannels(ga4, ads).rows.map((c) => ({ channel: c.label, users: c.users, sessions: c.sessions, prevSessions: c.prevSessions, signupsTracked: c.signups }))
      : "GA4未取得",
    funnel: funnel.rows.map((r) => ({ step: r.label, source: r.source, basis: r.basis, users: r.value ?? "未計測", fromPrev: r.fromPrev === null ? null : Number(r.fromPrev.toFixed(3)) })),
    biggestDrop: funnel.worst ? { from: funnel.worst.prevLabel, to: funnel.worst.label, dropRate: Number((funnel.worst.dropRate ?? 0).toFixed(3)) } : null,
    topPages: ga4?.pages.slice(0, 8).map((pg) => ({ path: pg.path, title: pg.title, views: pg.views, users: pg.users, bounceRate: Number(pg.bounceRate.toFixed(2)) })) ?? "GA4未取得",
    notFound: buildNotFound(p).rows.slice(0, 5),
    seo: gsc
      ? (() => {
          const s = buildSeo(gsc);
          return {
            clicks: gsc.current.clicks,
            prevClicks: gsc.previous.clicks,
            impressions: gsc.current.impressions,
            avgPosition: Number(gsc.current.position.toFixed(1)),
            keywords: s.keywordCount,
            top10: s.top10,
            trend: s.counts,
            bigDrops: s.bigDrops.slice(0, 5).map((q) => ({ query: q.query, from: q.prevPosition, to: q.position })),
            opportunities: s.opportunities.slice(0, 5).map((q) => ({ query: q.query, position: Number(q.position.toFixed(1)), impressions: q.impressions })),
          };
        })()
      : "Search Console未取得",
    competitors: sectionData(p.competitors)?.items ?? null,
    alerts: buildAlerts(p, ads, adsPrev).map((a) => `${a.level}: ${a.title} — ${a.detail}`),
  };
}

const SYSTEM = `あなたはSaaS「WEBRIS」（SEO・サイト分析SaaS）の事業アナリストです。
与えられたJSONの事実だけを根拠に、経営者が30秒で状況を把握できる日本語の要約を作ります。

厳守事項:
- JSONに無い数値を作らない。推測で補わない。「未計測」「取得エラー」の項目は、その旨をそのまま扱う。
- アクティブユーザーが数十人未満など母数が小さい場合、増減や比率を「傾向」「改善/悪化」と断定しない。「初期データのため判断保留」と明記する。
- 改善アクションは、JSONの事実（最大離脱・404・順位・未計測イベントなど）に直接ひもづくものだけを出す。
- 出力は次のJSONのみ。前後に文章やコードブロックを付けない。
{"headline":"20〜40字の一文","summary":"3〜5文","good":["良い点"],"concerns":["懸念点"],"actions":[{"title":"具体的な打ち手","reason":"根拠となる事実","impact":"高|中|低"}],"confidence":"データの信頼度についての一文"}`;

export async function generateAiSummary(
  p: WebrisAnalyticsPayload,
  range: ResolvedRange,
  ads: AdSpendSummary,
  adsPrev: AdSpendSummary,
  dataFetchedAt: Date,
): Promise<AiSummary> {
  const facts = buildFacts(p, range, ads, adsPrev);
  const result = await callLlm({
    system: SYSTEM,
    prompt: `WEBRISの現状データ:\n${JSON.stringify(facts)}`,
    stubResponse: "",
    maxTokens: 1500,
  });
  if (result.model === "stub") {
    throw new Error("ANTHROPIC_API_KEY が未設定のため、AI要約を生成できません。");
  }
  const json = result.text.slice(result.text.indexOf("{"), result.text.lastIndexOf("}") + 1);
  let parsed: z.infer<typeof SummarySchema>;
  try {
    parsed = SummarySchema.parse(JSON.parse(json));
  } catch {
    throw new Error("AIの応答を解釈できませんでした。もう一度お試しください。");
  }
  const summary: AiSummary = {
    ...parsed,
    generatedAt: new Date().toISOString(),
    dataFetchedAt: dataFetchedAt.toISOString(),
    model: result.model,
  };
  const key = keyFor(range);
  await prisma.webrisAnalyticsCache.upsert({
    where: { key },
    create: { key, payload: summary as never },
    update: { payload: summary as never, fetchedAt: new Date() },
  });
  return summary;
}
