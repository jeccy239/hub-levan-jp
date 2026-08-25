import { prisma } from "@/lib/prisma";
import { callLlm } from "./llm";
import { logDecision } from "./decisionLog";

const AGENT_NAME = "seo_strategy_agent";

type KeywordPlan = {
  keyword: string;
  searchIntent: string;
  priority: number;
}[];

function parseKeywordPlan(text: string): KeywordPlan {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((k) => ({
        keyword: String(k.keyword ?? ""),
        searchIntent: String(k.searchIntent ?? ""),
        priority: Number(k.priority) || 99,
      }))
      .filter((k) => k.keyword);
  } catch {
    return [];
  }
}

/**
 * Level 2 — runs automatically once a Project exists, but its output (a
 * keyword plan) only creates ContentItem rows in the KEYWORD stage. Nothing
 * gets written or published until Content Agent and QC Agent run, and a
 * human still approves before publish.
 */
export async function generateKeywordPlan(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { customer: { include: { company: true } } },
  });

  const system =
    "あなたはLEVANのSEO Strategy Agentです。顧客企業のSEOコンテンツ計画として、優先順位付きのキーワードリストを作成してください。" +
    "月10本のコンテンツ制作を想定し、10件のキーワードを提案してください。" +
    '必ず次のJSON配列形式のみで応答してください: [{"keyword": "...", "searchIntent": "...", "priority": 1}, ...]';

  const prompt = `会社名: ${project.customer.company.name}\n業種: ${
    project.customer.company.industry ?? "不明"
  }`;

  const stubResponse = JSON.stringify([
    { keyword: "SEO コンテンツ制作 代行", searchIntent: "比較検討", priority: 1 },
    { keyword: "SEO対策 費用 相場", searchIntent: "情報収集", priority: 2 },
    { keyword: "オウンドメディア 運用 コツ", searchIntent: "情報収集", priority: 3 },
    { keyword: "検索順位 上がらない 原因", searchIntent: "問題解決", priority: 4 },
    { keyword: "SEO記事 書き方", searchIntent: "情報収集", priority: 5 },
    { keyword: "内部リンク 最適化 方法", searchIntent: "問題解決", priority: 6 },
    { keyword: "キーワード選定 ツール 無料", searchIntent: "情報収集", priority: 7 },
    { keyword: "コンテンツマーケティング 事例", searchIntent: "情報収集", priority: 8 },
    { keyword: "SEO 効果測定 指標", searchIntent: "情報収集", priority: 9 },
    { keyword: "検索意図 分析 やり方", searchIntent: "情報収集", priority: 10 },
  ]);

  const llm = await callLlm({ system, prompt, stubResponse, maxTokens: 1200 });
  const plan = parseKeywordPlan(llm.text);

  const items = await prisma.$transaction(
    plan.map((k) =>
      prisma.contentItem.create({
        data: {
          projectId,
          keyword: k.keyword,
          searchIntent: k.searchIntent,
          priority: k.priority,
        },
      }),
    ),
  );

  await logDecision({
    agentName: AGENT_NAME,
    targetType: "project",
    targetId: projectId,
    input: { company: project.customer.company },
    decision: `${items.length}件のキーワードを優先順位付きで計画に追加`,
    reason: "月次コンテンツ計画の初期キーワードセット",
    output: plan,
    llm,
  });

  return items;
}
