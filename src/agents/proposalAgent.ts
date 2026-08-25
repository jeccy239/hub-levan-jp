import { prisma } from "@/lib/prisma";
import { callLlm } from "./llm";
import { logDecision } from "./decisionLog";
import { LeadStatus, MeetingStatus, ProposalStatus } from "@/generated/prisma/client";
import { createProjectForCustomer } from "./projectManagerAgent";

const AGENT_NAME = "proposal_agent";

type ProposalDraft = {
  minutesSummary: string;
  scope: string[];
  amountJpy: number;
  rationale: string;
};

function parseProposalDraft(text: string): ProposalDraft {
  try {
    const parsed = JSON.parse(text);
    return {
      minutesSummary: String(parsed.minutesSummary ?? ""),
      scope: Array.isArray(parsed.scope) ? parsed.scope : [],
      amountJpy: Number(parsed.amountJpy) || 100000,
      rationale: String(parsed.rationale ?? ""),
    };
  } catch {
    return { minutesSummary: "解析失敗", scope: [], amountJpy: 100000, rationale: "" };
  }
}

/**
 * Level 1 — summarizes the meeting transcript into minutes, then drafts a
 * proposal (scope + quote). The proposal always lands as PENDING; a human
 * must approve it before it's ever shown to the customer, since it carries
 * a price.
 */
export async function recordMeetingAndDraftProposal(meetingId: string, transcript: string) {
  const meeting = await prisma.meeting.findUniqueOrThrow({
    where: { id: meetingId },
    include: { lead: { include: { company: true } } },
  });

  const system =
    "あなたはLEVANのProposal Agentです。商談の書き起こしから議事録を要約し、提案内容と見積金額(月額・日本円)の下書きを作成してください。" +
    '必ず次のJSON形式のみで応答してください: {"minutesSummary": "...", "scope": ["...", "..."], ' +
    '"amountJpy": 100000, "rationale": "..."}';

  const prompt = `会社名: ${meeting.lead.company.name}\n商談書き起こし:\n${transcript}`;

  const stubResponse = JSON.stringify({
    minutesSummary: "月10本のSEOコンテンツ制作と月次レポートに関心。予算感は月10〜15万円程度。3ヶ月での効果確認を希望。",
    scope: ["キーワード選定", "SEO構成", "AI記事制作(月10本)", "月次レポート", "改善提案"],
    amountJpy: 100000,
    rationale: "基本プラン相当。予算感・希望内容と一致するため標準プランを提示。",
  });

  const llm = await callLlm({ system, prompt, stubResponse, maxTokens: 800 });
  const draft = parseProposalDraft(llm.text);

  const [, proposal] = await prisma.$transaction([
    prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: MeetingStatus.HELD,
        transcript,
        minutesSummary: draft.minutesSummary,
        heldAt: new Date(),
      },
    }),
    prisma.proposal.create({
      data: {
        leadId: meeting.leadId,
        meetingId,
        scopeJson: draft.scope,
        amountJpy: draft.amountJpy,
        status: ProposalStatus.PENDING,
      },
    }),
    prisma.lead.update({ where: { id: meeting.leadId }, data: { status: LeadStatus.PROPOSAL } }),
  ]);

  await logDecision({
    agentName: AGENT_NAME,
    targetType: "proposal",
    targetId: proposal.id,
    leadId: meeting.leadId,
    input: { transcript },
    decision: `見積 月額¥${draft.amountJpy.toLocaleString("ja-JP")} の提案を生成し、人間承認待ちとした`,
    reason: draft.rationale,
    output: draft,
    llm,
  });

  return proposal;
}

export async function approveProposal(proposalId: string, approvedById: string) {
  const proposal = await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: ProposalStatus.APPROVED, approvedById },
  });
  await prisma.lead.update({
    where: { id: proposal.leadId },
    data: { status: LeadStatus.NEGOTIATION },
  });
  return proposal;
}

export async function rejectProposal(proposalId: string, approvedById: string) {
  return prisma.proposal.update({
    where: { id: proposalId },
    data: { status: ProposalStatus.REJECTED, approvedById },
  });
}

/**
 * Closing a deal is never automatic — a human explicitly records the signed
 * contract. This creates the Customer if it doesn't exist yet and links a
 * Contract back to both the originating lead and the approved proposal.
 */
export async function signContract(params: {
  proposalId: string;
  plan: string;
  monthlyFeeJpy: number;
}) {
  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { id: params.proposalId },
    include: { lead: { include: { company: true } } },
  });

  const startDate = new Date();
  const renewalDate = new Date(startDate);
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);

  const customer = await prisma.customer.upsert({
    where: { companyId: proposal.lead.companyId },
    update: {},
    create: { companyId: proposal.lead.companyId },
  });

  const contract = await prisma.contract.create({
    data: {
      customerId: customer.id,
      leadId: proposal.leadId,
      proposalId: proposal.id,
      plan: params.plan,
      monthlyFeeJpy: params.monthlyFeeJpy,
      startDate,
      renewalDate,
    },
  });

  await prisma.lead.update({ where: { id: proposal.leadId }, data: { status: LeadStatus.WON } });
  await createProjectForCustomer(customer.id);

  return contract;
}
