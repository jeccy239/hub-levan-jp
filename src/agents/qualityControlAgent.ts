import { prisma } from "@/lib/prisma";
import { callLlm } from "./llm";
import { logDecision } from "./decisionLog";
import { ContentStatus } from "@/generated/prisma/client";

const AGENT_NAME = "quality_control_agent";
const HUMAN_REVIEW_THRESHOLD = 80;

// YMYL (Your Money or Your Life) topics always force human review regardless
// of QC score — medical/financial/legal advice carries real-world harm if
// AI gets it wrong.
const YMYL_KEYWORDS = ["医療", "健康", "薬", "投資", "資産運用", "保険", "税金", "法律", "融資"];

type QcResult = {
  qcScore: number;
  issues: string[];
  ymyl: boolean;
};

function parseQcResult(text: string, keyword: string): QcResult {
  try {
    const parsed = JSON.parse(text);
    return {
      qcScore: Number(parsed.qcScore) || 0,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      ymyl: Boolean(parsed.ymyl) || YMYL_KEYWORDS.some((k) => keyword.includes(k)),
    };
  } catch {
    return { qcScore: 0, issues: ["解析失敗のため要確認"], ymyl: true };
  }
}

/**
 * Level 2 — checks SEO/日本語品質/事実関係/重複/検索意図一致/YMYL. Runs
 * automatically after Content Agent drafts an article, but never approves
 * or publishes anything itself: a low score or a YMYL topic routes to
 * HUMAN_REVIEW, and even a passing score still waits at QC_REVIEWED for a
 * human to move it to APPROVED.
 */
export async function runQualityControl(contentItemId: string) {
  const item = await prisma.contentItem.findUniqueOrThrow({ where: { id: contentItemId } });

  const system =
    "あなたはLEVANのQuality Control Agentです。SEO記事について、SEO品質・日本語品質・検索意図との一致・" +
    "キーワード過剰使用・不自然な表現・YMYL（医療/金融/法律等の高リスク領域）該当有無をチェックしてください。" +
    '必ず次のJSON形式のみで応答してください: {"qcScore": 0-100, "issues": ["...", "..."], "ymyl": true/false}';

  const prompt = `キーワード: ${item.keyword}\n検索意図: ${item.searchIntent ?? "不明"}\n本文:\n${
    item.draftBody ?? ""
  }`;

  const stubResponse = JSON.stringify({
    qcScore: 88,
    issues: [],
    ymyl: YMYL_KEYWORDS.some((k) => item.keyword.includes(k)),
  });

  const llm = await callLlm({ system, prompt, stubResponse, maxTokens: 500 });
  const result = parseQcResult(llm.text, item.keyword);

  const needsHumanReview = result.ymyl || result.qcScore < HUMAN_REVIEW_THRESHOLD;

  const updated = await prisma.contentItem.update({
    where: { id: contentItemId },
    data: {
      status: needsHumanReview ? ContentStatus.HUMAN_REVIEW : ContentStatus.QC_REVIEWED,
      qcScore: result.qcScore,
      qcIssues: result.issues,
      ymylFlag: result.ymyl,
    },
  });

  await logDecision({
    agentName: AGENT_NAME,
    targetType: "content_item",
    targetId: contentItemId,
    input: { keyword: item.keyword },
    decision: needsHumanReview
      ? `QCスコア${result.qcScore}点${result.ymyl ? "・YMYL該当" : ""}のため人間レビュー必須とした`
      : `QCスコア${result.qcScore}点で基準を満たしたため通常レビュー待ちとした`,
    reason: result.issues.length > 0 ? result.issues.join(" / ") : "重大な指摘なし",
    output: result,
    llm,
  });

  return updated;
}

export async function approveContentItem(contentItemId: string) {
  return prisma.contentItem.update({
    where: { id: contentItemId },
    data: { status: ContentStatus.APPROVED },
  });
}

export async function sendContentItemBackToDraft(contentItemId: string) {
  return prisma.contentItem.update({
    where: { id: contentItemId },
    data: { status: ContentStatus.DRAFTED },
  });
}

/**
 * Publishing is always an explicit human action — never automatic, even
 * for a high-scoring, non-YMYL article. This only simulates a CMS URL;
 * a real CMS integration would replace this with an actual API call.
 */
export async function publishContentItem(contentItemId: string) {
  const item = await prisma.contentItem.findUniqueOrThrow({ where: { id: contentItemId } });
  const slug = item.keyword.replace(/\s+/g, "-");
  return prisma.contentItem.update({
    where: { id: contentItemId },
    data: {
      status: ContentStatus.PUBLISHED,
      publishedUrl: `https://client-site.example.com/blog/${slug}`,
      publishedAt: new Date(),
    },
  });
}
