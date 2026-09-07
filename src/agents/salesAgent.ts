import { prisma } from "@/lib/prisma";
import { callLlm } from "./llm";
import { logDecision } from "./decisionLog";
import { ApprovalStatus, LeadStatus, OutreachDirection, ReplyCategory } from "@/generated/prisma/client";
import { LEAD_STATUS_LABEL, REPLY_CATEGORY_LABEL } from "@/lib/labels";

const AGENT_NAME = "sales_agent";

type DraftOutput = { subject: string; body: string };

function parseDraft(text: string): DraftOutput {
  try {
    const parsed = JSON.parse(text);
    return { subject: String(parsed.subject ?? ""), body: String(parsed.body ?? "") };
  } catch {
    return { subject: "（生成失敗）", body: text };
  }
}

/**
 * Level 1 — AI drafts, human approves before send. Never sends on its own;
 * this only creates a PENDING OutreachMessage for a human to review in the
 * Lead detail screen.
 */
export async function draftOutreachMessage(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { company: true },
  });

  const system =
    "あなたはLEVANのSales Agentです。SEOコンテンツ運用代行サービスの営業メール下書きを作成してください。" +
    "特定電子メール法を遵守し、送信者情報とオプトアウト方法を必ず本文末尾に含めてください。" +
    '必ず次のJSON形式のみで応答してください: {"subject": "...", "body": "..."}';

  const prompt = `宛先企業: ${lead.company.name}\nSEO課題: ${
    Array.isArray(lead.seoOpportunities) ? JSON.stringify(lead.seoOpportunities) : "不明"
  }\n見込み理由: ${lead.reasonToContact ?? "不明"}`;

  const stubResponse = JSON.stringify({
    subject: `【ご提案】${lead.company.name}様のSEO改善について`,
    body:
      `${lead.company.name} ご担当者様\n\n` +
      "株式会社LEVANの営業担当です。貴社サイトを拝見し、SEO面で改善余地があると感じご連絡いたしました。\n" +
      "弊社では月10本のSEOコンテンツ制作を含む運用代行サービスを提供しております。\n" +
      "もしご興味があれば30分ほどお話させていただけますと幸いです。\n\n" +
      "本メールの配信停止をご希望の場合は、本メールに返信の上その旨をお伝えください。\n\n" +
      "株式会社LEVAN\nhub.levan.jp",
  });

  const llm = await callLlm({ system, prompt, stubResponse, maxTokens: 700 });
  const draft = parseDraft(llm.text);

  const message = await prisma.outreachMessage.create({
    data: {
      leadId,
      direction: OutreachDirection.OUTBOUND,
      subject: draft.subject,
      body: draft.body,
      approvalStatus: ApprovalStatus.PENDING,
    },
  });

  await logDecision({
    agentName: AGENT_NAME,
    targetType: "outreach_message",
    targetId: message.id,
    leadId,
    input: { company: lead.company, seoOpportunities: lead.seoOpportunities },
    decision: "営業メール下書きを生成し、人間承認待ちとした",
    reason: lead.reasonToContact ?? "見込み度スコアに基づく営業対象",
    output: draft,
    llm,
  });

  return message;
}

export async function approveAndSendMessage(messageId: string, approvedById: string) {
  const message = await prisma.outreachMessage.update({
    where: { id: messageId },
    data: {
      approvalStatus: ApprovalStatus.APPROVED,
      approvedById,
      sentAt: new Date(),
    },
  });

  await prisma.lead.update({
    where: { id: message.leadId },
    data: { status: LeadStatus.CONTACTED, lastContactedAt: new Date() },
  });

  return message;
}

function withTracking(body: string, messageId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://hub.levan.jp";
  const trackedLink = `${base}/api/track/click/${messageId}?to=${encodeURIComponent("https://webris.levan.jp")}`;
  return (
    `${body}\n\n詳しくはこちら: ${trackedLink}\n\n` +
    `<img src="${base}/api/track/open/${messageId}" width="1" height="1" alt="" style="display:none" />`
  );
}

function fillTemplate(template: string, companyName: string) {
  return template.replaceAll("{{company}}", companyName);
}

/**
 * WEBRIS SALES AI — 一斉配信。人間が対象企業とテンプレートを選び、明示的に
 * 「送信」を押したときだけ動く（Level 1 の変形：下書きではなく実行そのものを
 * 人間が承認するボタン操作）。承認フローをスキップする代わりに、送信者本人の
 * userId を承認者として記録し、AuditLogにも残す。
 */
export async function sendBulkOutreach(params: {
  leadIds: string[];
  subjectTemplate: string;
  bodyTemplate: string;
  approvedById: string;
}) {
  const leads = await prisma.lead.findMany({
    where: { id: { in: params.leadIds } },
    include: { company: true },
  });

  const sent: string[] = [];
  for (const lead of leads) {
    const subject = fillTemplate(params.subjectTemplate, lead.company.name);
    const bodyDraft = fillTemplate(params.bodyTemplate, lead.company.name);

    const message = await prisma.outreachMessage.create({
      data: {
        leadId: lead.id,
        direction: OutreachDirection.OUTBOUND,
        subject,
        body: bodyDraft,
        approvalStatus: ApprovalStatus.APPROVED,
        approvedById: params.approvedById,
        sentAt: new Date(),
      },
    });

    await prisma.outreachMessage.update({
      where: { id: message.id },
      data: { body: withTracking(bodyDraft, message.id) },
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: lead.status === LeadStatus.NEW || lead.status === LeadStatus.RESEARCHED ? lead.status : LeadStatus.CONTACTED,
        lastContactedAt: new Date(),
      },
    });

    sent.push(message.id);
  }

  return sent;
}

/**
 * テスト送信 — DBには保存せず、実際の配信も行わない（メール配信基盤が
 * 未接続のため）。プレビュー確認用のシミュレーションとして扱う。
 */
export async function sendTestEmail(params: { subjectTemplate: string; bodyTemplate: string; testCompanyName?: string }) {
  const sample = params.testCompanyName || "サンプル株式会社";
  return {
    subject: fillTemplate(params.subjectTemplate, sample),
    body: fillTemplate(params.bodyTemplate, sample),
  };
}

export async function rejectMessage(messageId: string, approvedById: string) {
  return prisma.outreachMessage.update({
    where: { id: messageId },
    data: { approvalStatus: ApprovalStatus.REJECTED, approvedById },
  });
}

type ClassifyOutput = { category: ReplyCategory; nextStatus: LeadStatus; summary: string };

function parseClassification(text: string): ClassifyOutput {
  try {
    const parsed = JSON.parse(text);
    const category = ReplyCategory[parsed.category as keyof typeof ReplyCategory] ?? ReplyCategory.UNCLASSIFIED;
    const nextStatus = LeadStatus[parsed.nextStatus as keyof typeof LeadStatus] ?? LeadStatus.REPLIED;
    return { category, nextStatus, summary: String(parsed.summary ?? "") };
  } catch {
    return { category: ReplyCategory.UNCLASSIFIED, nextStatus: LeadStatus.REPLIED, summary: "分類失敗" };
  }
}

/**
 * Classification of an inbound reply is Level 2 (automatic, human can
 * override by re-reading the message) — it only routes the lead, it never
 * sends anything on its own.
 */
export async function recordAndClassifyReply(leadId: string, body: string) {
  const system =
    "あなたはLEVANのSales Agentです。受信した営業メール返信を分類してください。" +
    'カテゴリは INTERESTED, NOT_INTERESTED, NEEDS_INFO, UNSUBSCRIBE, OUT_OF_OFFICE, UNCLASSIFIED のいずれか。' +
    "リード状態は NEW, RESEARCHED, QUALIFIED, CONTACTED, REPLIED, INTERESTED, MEETING, PROPOSAL, NEGOTIATION, WON, LOST のいずれか。" +
    '必ず次のJSON形式のみで応答してください: {"category": "...", "nextStatus": "...", "summary": "..."}';

  const llm = await callLlm({
    system,
    prompt: `返信本文:\n${body}`,
    stubResponse: JSON.stringify({
      category: "INTERESTED",
      nextStatus: "INTERESTED",
      summary: "興味を示す返信。商談化候補。",
    }),
    maxTokens: 300,
  });

  const classification = parseClassification(llm.text);

  const message = await prisma.outreachMessage.create({
    data: {
      leadId,
      direction: OutreachDirection.INBOUND,
      body,
      replyCategory: classification.category,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: classification.nextStatus },
  });

  await logDecision({
    agentName: AGENT_NAME,
    targetType: "outreach_message",
    targetId: message.id,
    leadId,
    input: { body },
    decision: `返信を「${REPLY_CATEGORY_LABEL[classification.category] ?? classification.category}」に分類し、リード状態を「${LEAD_STATUS_LABEL[classification.nextStatus] ?? classification.nextStatus}」に更新`,
    reason: classification.summary,
    output: classification,
    llm,
  });

  return message;
}
