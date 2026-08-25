import { prisma } from "@/lib/prisma";
import { callLlm } from "./llm";
import { logDecision } from "./decisionLog";
import { UpsellStatus } from "@/generated/prisma/client";

const AGENT_NAME = "upsell_agent";

type UpsellCandidate = { category: string; rationale: string };

function parseCandidates(text: string): UpsellCandidate[] {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((c) => ({ category: String(c.category ?? ""), rationale: String(c.rationale ?? "") }))
      .filter((c) => c.category && c.rationale);
  } catch {
    return [];
  }
}

/**
 * Level 1 — only extracts candidates worth considering; never presents
 * anything to the customer itself. The prompt explicitly forbids proposing
 * something without a concrete, customer-specific benefit — this is meant
 * to stay rare and well-targeted, not a constant upsell drumbeat.
 */
export async function generateUpsellCandidates(customerId: string) {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId },
    include: {
      company: true,
      project: { include: { contentItems: true, reports: true } },
      contracts: true,
    },
  });

  const publishedCount = customer.project?.contentItems.filter((c) => c.status === "PUBLISHED").length ?? 0;
  const latestReport = customer.project?.reports.sort((a, b) => b.period.localeCompare(a.period))[0];

  const system =
    "あなたはLEVANのUpsell Agentです。顧客の状況から、追加提案（Web制作・SEOコンサルティング・AI導入支援・" +
    "業務自動化・AIチャットボット・AI営業支援・システム開発等）の候補を抽出してください。" +
    "顧客にとって明確なメリットがある場合のみ提案し、根拠のない無理な提案は行わないでください。" +
    "該当する提案がなければ空配列を返してください。" +
    '必ず次のJSON配列形式のみで応答してください: [{"category": "...", "rationale": "..."}]';

  const prompt =
    `会社名: ${customer.company.name}\n契約プラン: ${customer.contracts[0]?.plan ?? "不明"}\n` +
    `公開記事数: ${publishedCount}\n直近レポート要約: ${latestReport?.summaryText ?? "なし"}`;

  const stubResponse = JSON.stringify(
    publishedCount >= 1
      ? [
          {
            category: "LP制作",
            rationale: "SEO記事からの流入は増えているが、問い合わせ導線となるLPが未整備のため、CVR改善余地が大きい。",
          },
        ]
      : [],
  );

  const llm = await callLlm({ system, prompt, stubResponse, maxTokens: 600 });
  const candidates = parseCandidates(llm.text);

  const created = await prisma.$transaction(
    candidates.map((c) =>
      prisma.upsellProposal.create({
        data: { customerId, category: c.category, rationale: c.rationale },
      }),
    ),
  );

  await logDecision({
    agentName: AGENT_NAME,
    targetType: "customer",
    targetId: customerId,
    input: { publishedCount, plan: customer.contracts[0]?.plan },
    decision:
      created.length > 0
        ? `${created.length}件のアップセル候補を抽出し、人間承認待ちとした`
        : "明確なメリットが見当たらないため、アップセル候補なしと判断",
    reason: candidates.map((c) => c.rationale).join(" / ") || "追加提案の根拠が不十分",
    output: candidates,
    llm,
  });

  return created;
}

export async function approveUpsell(upsellId: string, approvedById: string) {
  return prisma.upsellProposal.update({
    where: { id: upsellId },
    data: { status: UpsellStatus.APPROVED, approvedById },
  });
}

export async function rejectUpsell(upsellId: string, approvedById: string) {
  return prisma.upsellProposal.update({
    where: { id: upsellId },
    data: { status: UpsellStatus.REJECTED, approvedById },
  });
}

export async function markUpsellPresented(upsellId: string) {
  return prisma.upsellProposal.update({
    where: { id: upsellId },
    data: { status: UpsellStatus.PRESENTED },
  });
}
