import { prisma } from "@/lib/prisma";
import { callLlm } from "./llm";
import { logDecision } from "./decisionLog";
import { SendStatus } from "@/generated/prisma/client";

const AGENT_NAME = "report_agent";

export type MonthlyMetrics = {
  pageViews: number;
  users: number;
  topQueries: string[];
  avgRanking: number;
  ctr: number;
  conversions: number;
  cvr: number;
};

/**
 * Level 1 — analyzes the month's metrics (entered manually here since no
 * GA4/GSC connection exists yet) and drafts the report. A human must
 * approve it before it's ever sent to the customer.
 */
export async function generateMonthlyReport(projectId: string, period: string, metrics: MonthlyMetrics) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { customer: { include: { company: true } }, contentItems: true },
  });

  const publishedCount = project.contentItems.filter((c) => c.status === "PUBLISHED").length;

  const system =
    "あなたはLEVANのReport Agentです。月次のアクセス・検索データから、" +
    "「今月何が起きたか」「なぜ起きたか」「来月何をすべきか」の3点を含む月次レポート文を作成してください。" +
    "日本語で、顧客にそのまま送れる丁寧な文体にしてください。JSON等の記号は使わず、レポート本文のみを出力してください。";

  const prompt =
    `会社名: ${project.customer.company.name}\n対象期間: ${period}\n` +
    `PV: ${metrics.pageViews}\nユーザー数: ${metrics.users}\n主要検索クエリ: ${metrics.topQueries.join(", ")}\n` +
    `平均検索順位: ${metrics.avgRanking}\nCTR: ${metrics.ctr}%\nコンバージョン数: ${metrics.conversions}\n` +
    `CVR: ${metrics.cvr}%\n公開記事数（累計）: ${publishedCount}`;

  const stubResponse =
    `${period}の月次レポートです。\n\n` +
    `【今月何が起きたか】\nPVは${metrics.pageViews.toLocaleString("ja-JP")}件、ユーザー数は${metrics.users.toLocaleString("ja-JP")}件でした。平均検索順位は${metrics.avgRanking}位、CVRは${metrics.cvr}%でした。\n\n` +
    `【なぜ起きたか】\n公開記事数が累計${publishedCount}本に達し、「${metrics.topQueries[0] ?? "主要キーワード"}」からの流入が伸びています。一方で検索順位はまだ改善余地があります。\n\n` +
    `【来月何をすべきか】\n上位表示されていない記事のリライトと、内部リンクの強化を優先することを推奨します。\n\n` +
    `（本文はスタブ応答のため簡略化されています）`;

  const llm = await callLlm({ system, prompt, stubResponse, maxTokens: 1000 });

  const report = await prisma.report.upsert({
    where: { projectId_period: { projectId, period } },
    update: { metricsJson: metrics, summaryText: llm.text, status: SendStatus.DRAFT },
    create: {
      projectId,
      period,
      metricsJson: metrics,
      summaryText: llm.text,
      status: SendStatus.DRAFT,
    },
  });

  await logDecision({
    agentName: AGENT_NAME,
    targetType: "report",
    targetId: report.id,
    input: metrics,
    decision: `${period}の月次レポート下書きを生成し、人間承認待ちとした`,
    reason: `公開記事${publishedCount}本、平均順位${metrics.avgRanking}位のデータに基づく分析`,
    output: { summary: llm.text },
    llm,
  });

  return report;
}

export async function approveAndSendReport(reportId: string) {
  return prisma.report.update({
    where: { id: reportId },
    data: { status: SendStatus.SENT, sentAt: new Date() },
  });
}
