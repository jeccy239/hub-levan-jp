import { prisma } from "@/lib/prisma";
import { callLlm } from "./llm";
import { logDecision } from "./decisionLog";
import { LeadStatus } from "@/generated/prisma/client";

const AGENT_NAME = "sales_research_agent";

type Briefing = {
  companySummary: string;
  competitors: string[];
  currentIssues: string[];
  assumedNeeds: string[];
  proposedApproach: string;
};

function parseBriefing(text: string): Briefing {
  try {
    const parsed = JSON.parse(text);
    return {
      companySummary: String(parsed.companySummary ?? ""),
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
      currentIssues: Array.isArray(parsed.currentIssues) ? parsed.currentIssues : [],
      assumedNeeds: Array.isArray(parsed.assumedNeeds) ? parsed.assumedNeeds : [],
      proposedApproach: String(parsed.proposedApproach ?? ""),
    };
  } catch {
    return {
      companySummary: "解析失敗",
      competitors: [],
      currentIssues: [],
      assumedNeeds: [],
      proposedApproach: "",
    };
  }
}

/**
 * Level 2 — runs automatically once a lead is INTERESTED, but its only
 * output is a briefing document for the human sales rep to read before the
 * actual meeting. It never books the meeting or contacts the customer.
 */
export async function generateMeetingBriefing(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { company: true },
  });

  const system =
    "あなたはLEVANのSales Research Agentです。商談前に営業担当が確認するブリーフィング資料を作成してください。" +
    '必ず次のJSON形式のみで応答してください: {"companySummary": "...", "competitors": ["...", "..."], ' +
    '"currentIssues": ["...", "..."], "assumedNeeds": ["...", "..."], "proposedApproach": "..."}';

  const prompt = `会社名: ${lead.company.name}\n業種: ${lead.company.industry ?? "不明"}\nSEO課題: ${
    Array.isArray(lead.seoOpportunities) ? JSON.stringify(lead.seoOpportunities) : "不明"
  }\n見込み理由: ${lead.reasonToContact ?? "不明"}`;

  const stubResponse = JSON.stringify({
    companySummary: `${lead.company.name}は${lead.company.industry ?? "業種不明"}の企業。自社サイトのSEO対策が手薄で、継続的なコンテンツ更新体制を持たない。`,
    competitors: ["業界大手A社", "地域競合B社"],
    currentIssues: ["自社更新のリソース不足", "検索順位の伸び悩み"],
    assumedNeeds: ["月次で安定した記事供給", "成果の可視化"],
    proposedApproach:
      "基本プラン(月10本・月次レポート付き)を軸に、まずは3ヶ月の効果測定期間を提案する。",
  });

  const llm = await callLlm({ system, prompt, stubResponse, maxTokens: 700 });
  const briefing = parseBriefing(llm.text);

  const meeting = await prisma.meeting.create({
    data: { leadId, briefing },
  });

  await prisma.lead.update({ where: { id: leadId }, data: { status: LeadStatus.MEETING } });

  await logDecision({
    agentName: AGENT_NAME,
    targetType: "meeting",
    targetId: meeting.id,
    leadId,
    input: { company: lead.company, seoOpportunities: lead.seoOpportunities },
    decision: "商談前ブリーフィングを生成し、リード状態をMEETINGに更新",
    reason: briefing.proposedApproach,
    output: briefing,
    llm,
  });

  return meeting;
}
