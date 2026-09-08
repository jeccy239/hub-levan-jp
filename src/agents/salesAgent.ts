import { prisma } from "@/lib/prisma";
import { callLlm } from "./llm";
import { logDecision } from "./decisionLog";
import { ApprovalStatus, LeadStatus, OutreachDirection, ReplyCategory } from "@/generated/prisma/client";
import { LEAD_STATUS_LABEL, REPLY_CATEGORY_LABEL } from "@/lib/labels";
import { isEmailConfigured, sendEmail, textToHtml } from "@/lib/email";
import { fillTemplateStrict, type TemplateContext } from "@/lib/mailTemplate";

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

function trackingParts(messageId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://hub.levan.jp";
  return {
    link: `${base}/api/track/click/${messageId}?to=${encodeURIComponent("https://webris.levan.jp")}`,
    pixel: `<img src="${base}/api/track/open/${messageId}" width="1" height="1" alt="" style="display:none">`,
  };
}

function contextOf(
  company: { name: string; website: string; detectedTools: unknown; seoGaps: unknown },
  sender: string,
  webrisUrl?: string,
): TemplateContext {
  return {
    company: company.name,
    website: company.website,
    tools: Array.isArray(company.detectedTools) ? (company.detectedTools as string[]) : [],
    seoGaps: Array.isArray(company.seoGaps) ? (company.seoGaps as string[]) : [],
    sender,
    webrisUrl,
  };
}

export type BulkSendOutcome = {
  total: number;
  delivered: number;
  recorded: number;
  skippedNoAddress: { company: string }[];
  failed: { company: string; reason: string }[];
  emailConfigured: boolean;
};

/**
 * WEBRIS SALES AI — 一斉配信。人間が対象企業とテンプレートを選び、明示的に
 * 「送信」を押したときだけ動く（Level 1 の変形：下書きではなく実行そのものを
 * 人間が承認するボタン操作）。承認フローをスキップする代わりに、送信者本人の
 * userId を承認者として記録し、AuditLogにも残す。
 *
 * 宛先は Company.publicEmail（サイト上で公開されている法人の問い合わせ先）
 * または登録済み Contact のアドレスのみ。アドレスが無い企業はスキップし、
 * 呼び出し元にその旨を返す（黙って送信済み扱いにはしない）。
 */
export async function sendBulkOutreach(params: {
  leadIds: string[];
  subjectTemplate: string;
  bodyTemplate: string;
  approvedById: string;
  /** 差出人名。{{sender}} に差し込まれる。 */
  senderName: string;
}): Promise<BulkSendOutcome> {
  const leads = await prisma.lead.findMany({
    where: { id: { in: params.leadIds } },
    include: { company: { include: { contacts: { where: { email: { not: null } }, take: 1 } } } },
  });

  const outcome: BulkSendOutcome = {
    total: leads.length,
    delivered: 0,
    recorded: 0,
    skippedNoAddress: [],
    failed: [],
    emailConfigured: isEmailConfigured(),
  };

  for (const lead of leads) {
    const recipient = lead.company.publicEmail ?? lead.company.contacts[0]?.email ?? null;
    if (!recipient) {
      outcome.skippedNoAddress.push({ company: lead.company.name });
      continue;
    }

    // 先にメッセージIDを採番する。{{webris_url}} を計測リンクにするには
    // IDが必要で、そのIDは行を作らないと決まらないため。
    const message = await prisma.outreachMessage.create({
      data: {
        leadId: lead.id,
        direction: OutreachDirection.OUTBOUND,
        subject: params.subjectTemplate,
        body: params.bodyTemplate,
        approvalStatus: ApprovalStatus.APPROVED,
        approvedById: params.approvedById,
      },
    });

    const { link, pixel } = trackingParts(message.id);
    const ctx = contextOf(lead.company, params.senderName, link);

    let subject: string;
    let bodyDraft: string;
    try {
      subject = fillTemplateStrict(params.subjectTemplate, ctx);
      bodyDraft = fillTemplateStrict(params.bodyTemplate, ctx);
    } catch (e) {
      // 未対応の差込変数が残っている = そのまま送ると相手に {{...}} が届く。
      // 送らずに行を消し、理由を呼び出し元へ返す。
      await prisma.outreachMessage.delete({ where: { id: message.id } });
      outcome.failed.push({
        company: lead.company.name,
        reason: e instanceof Error ? e.message : "テンプレートの差込に失敗しました",
      });
      continue;
    }

    // テンプレートが {{webris_url}} を含まない場合だけ、計測リンクを末尾に足す
    const text = bodyDraft.includes(link) ? bodyDraft : `${bodyDraft}\n\n詳しくはこちら: ${link}`;
    const html = `${textToHtml(text)}${pixel}`;

    const result = await sendEmail({ to: recipient, subject, text, html });

    if (result.delivered) {
      outcome.delivered++;
    } else if (outcome.emailConfigured) {
      // 配信基盤は設定済みなのに失敗した = 本物のエラー。送信済みにしない。
      outcome.failed.push({ company: lead.company.name, reason: result.reason });
      await prisma.outreachMessage.delete({ where: { id: message.id } });
      continue;
    }

    await prisma.outreachMessage.update({
      where: { id: message.id },
      data: { subject, body: text, sentAt: new Date() },
    });
    outcome.recorded++;

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: LeadStatus.CONTACTED, lastContactedAt: new Date() },
    });
  }

  return outcome;
}

/**
 * テスト送信 — TEST_EMAIL_TO（未設定なら操作者本人）宛に1通だけ実送信する。
 * 実配信が未設定の場合はプレビュー内容だけを返す。
 */
export async function sendTestEmail(params: {
  subjectTemplate: string;
  bodyTemplate: string;
  to: string;
  senderName: string;
  /** 指定するとその企業の実データで差込む。未指定ならサンプル値。 */
  sampleLeadId?: string;
}) {
  let ctx: TemplateContext = {
    company: "サンプル株式会社",
    website: "https://example.co.jp",
    tools: ["Google Tag Manager", "Microsoft Clarity"],
    seoGaps: ["meta descriptionが無い", "構造化データ(JSON-LD)が無い"],
    sender: params.senderName,
  };

  if (params.sampleLeadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: params.sampleLeadId },
      include: { company: true },
    });
    if (lead) ctx = contextOf(lead.company, params.senderName);
  }

  // テスト送信でも本番と同じ検査を通す。ここで弾かれる文面は本番でも送れない。
  const subject = `[テスト] ${fillTemplateStrict(params.subjectTemplate, ctx)}`;
  const text = fillTemplateStrict(params.bodyTemplate, ctx);

  const result = await sendEmail({ to: params.to, subject, text });
  return { subject, body: text, to: params.to, ...result };
}

/** テンプレート下書きをAIに作らせる。APIキー未設定時は、実データ差込を
 *  前提にした既定テンプレートをそのまま返す（作り話をしない）。 */
export async function draftTemplate(instruction: string) {
  const system =
    "あなたはLEVANのSales Agentです。SEOコンテンツ運用代行サービスのBtoB営業メールのテンプレートを作成してください。" +
    "テンプレートには {{company}}（会社名）、{{tools}}（相手が導入済みのツール名）、{{seoGap}}（相手サイトのSEO上の不足）が差込変数として使えます。" +
    "{{seoGap}}は「meta descriptionが無い」のような文になるため、件名には入れず本文中で自然につながる位置に置いてください。" +
    "特定電子メール法を遵守し、送信者情報と配信停止方法を必ず本文末尾に含めてください。営業色が強すぎない、簡潔で丁寧な日本語で。" +
    '必ず次のJSON形式のみで応答してください: {"subject": "...", "body": "..."}';

  const stubResponse = JSON.stringify({
    subject: "【{{company}}様】サイト改善についてのご提案",
    body:
      "{{company}} ご担当者様\n\n" +
      "突然のご連絡失礼いたします。株式会社LEVANの営業担当です。\n" +
      "貴社サイトを拝見したところ、{{tools}}を活用されており、計測環境をしっかり整えていらっしゃると感じました。\n\n" +
      "一方で、{{seoGap}}といった点に改善余地があるようにお見受けしました。\n" +
      "弊社はSEOコンテンツ制作の運用代行を提供しており、こうした基盤が整っている企業様ほど成果が出やすい傾向があります。\n\n" +
      "もしご興味がありましたら、30分ほどオンラインでお話しさせていただけないでしょうか。\n\n" +
      "――――――――――\n株式会社LEVAN\nhttps://hub.levan.jp\n" +
      "配信停止をご希望の場合は、本メールにご返信いただければ以後お送りいたしません。",
  });

  const llm = await callLlm({ system, prompt: instruction, stubResponse, maxTokens: 900 });
  return parseDraft(llm.text);
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
