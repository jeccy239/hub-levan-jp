import { prisma } from "@/lib/prisma";
import { callLlm } from "./llm";
import { logDecision } from "./decisionLog";
import { ContentStatus } from "@/generated/prisma/client";

const AGENT_NAME = "content_agent";

type Draft = {
  title: string;
  outline: string[];
  body: string;
  metaTitle: string;
  metaDescription: string;
  internalLinkCandidates: string[];
  cta: string;
};

function parseDraft(text: string): Draft {
  try {
    const parsed = JSON.parse(text);
    return {
      title: String(parsed.title ?? ""),
      outline: Array.isArray(parsed.outline) ? parsed.outline : [],
      body: String(parsed.body ?? ""),
      metaTitle: String(parsed.metaTitle ?? ""),
      metaDescription: String(parsed.metaDescription ?? ""),
      internalLinkCandidates: Array.isArray(parsed.internalLinkCandidates)
        ? parsed.internalLinkCandidates
        : [],
      cta: String(parsed.cta ?? ""),
    };
  } catch {
    return {
      title: "（生成失敗）",
      outline: [],
      body: text,
      metaTitle: "",
      metaDescription: "",
      internalLinkCandidates: [],
      cta: "",
    };
  }
}

/**
 * Level 1 in spirit — generates a full draft, but writing it never publishes
 * anything. Quality Control Agent and a human review both sit between this
 * and PUBLISHED.
 */
export async function generateContentDraft(contentItemId: string) {
  const item = await prisma.contentItem.findUniqueOrThrow({
    where: { id: contentItemId },
    include: { project: { include: { customer: { include: { company: true } } } } },
  });

  const system =
    "あなたはLEVANのContent Agentです。SEO記事のタイトル・構成・本文・メタ情報・内部リンク候補・CTAを生成してください。" +
    "本文は日本語で800〜1200字程度、検索意図に沿った内容にしてください。事実の断定は避け、一般論として書いてください。" +
    '必ず次のJSON形式のみで応答してください: {"title": "...", "outline": ["...", "..."], "body": "...", ' +
    '"metaTitle": "...", "metaDescription": "...", "internalLinkCandidates": ["...", "..."], "cta": "..."}';

  const prompt = `会社名: ${item.project.customer.company.name}\nキーワード: ${item.keyword}\n検索意図: ${
    item.searchIntent ?? "不明"
  }`;

  const stubResponse = JSON.stringify({
    title: `${item.keyword}を成功させるための基本ガイド`,
    outline: ["導入：課題の整理", `${item.keyword}の基本`, "実践のポイント", "まとめ"],
    body:
      `${item.keyword}に取り組む際は、まず現状の課題を整理することが重要です。` +
      "多くの場合、目的が曖昧なまま施策を始めてしまい、効果検証ができないという問題が発生します。" +
      "まずは目標とする指標を明確にし、優先順位をつけて取り組むことをおすすめします。" +
      "（本文はスタブ応答のため簡略化されています）",
    metaTitle: `${item.keyword}｜基本ガイド`,
    metaDescription: `${item.keyword}について、基本から実践のポイントまで解説します。`,
    internalLinkCandidates: ["SEO運用代行サービス紹介ページ", "導入事例ページ"],
    cta: "サービス詳細はこちら",
  });

  const llm = await callLlm({ system, prompt, stubResponse, maxTokens: 2000 });
  const draft = parseDraft(llm.text);

  const updated = await prisma.contentItem.update({
    where: { id: contentItemId },
    data: {
      status: ContentStatus.DRAFTED,
      title: draft.title,
      outlineJson: draft.outline,
      draftBody: draft.body,
      metaTitle: draft.metaTitle,
      metaDescription: draft.metaDescription,
      internalLinkCandidates: draft.internalLinkCandidates,
      cta: draft.cta,
    },
  });

  await logDecision({
    agentName: AGENT_NAME,
    targetType: "content_item",
    targetId: contentItemId,
    input: { keyword: item.keyword, searchIntent: item.searchIntent },
    decision: `記事ドラフト「${draft.title}」を生成`,
    reason: `キーワード「${item.keyword}」の検索意図に沿って構成`,
    output: draft,
    llm,
  });

  return updated;
}
