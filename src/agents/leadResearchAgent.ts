import { prisma } from "@/lib/prisma";
import { callLlm } from "./llm";
import { logDecision } from "./decisionLog";
import { LeadStatus } from "@/generated/prisma/client";

const AGENT_NAME = "lead_research_agent";
const QUALIFY_THRESHOLD = 70;

type ResearchOutput = {
  seoScore: number;
  potentialScore: number;
  seoOpportunities: string[];
  reasonToContact: string;
};

function parseResearchOutput(text: string): ResearchOutput {
  try {
    const parsed = JSON.parse(text);
    return {
      seoScore: Number(parsed.seoScore) || 0,
      potentialScore: Number(parsed.potentialScore) || 0,
      seoOpportunities: Array.isArray(parsed.seoOpportunities) ? parsed.seoOpportunities : [],
      reasonToContact: String(parsed.reasonToContact ?? ""),
    };
  } catch {
    return {
      seoScore: 40,
      potentialScore: 40,
      seoOpportunities: ["解析に失敗したため要目視確認"],
      reasonToContact: "自動解析失敗。手動でのサイト確認を推奨。",
    };
  }
}

/**
 * Level 3 — fully automatic. Runs immediately when a lead is registered.
 * Scores the company's SEO maturity and outbound potential so Sales Agent
 * (Level 1, human-approved) has something concrete to work from.
 */
export async function runLeadResearchAgent(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { company: true },
  });

  const system =
    "あなたはLEVANのLead Research Agentです。企業のWebサイト情報からSEO成熟度と営業見込み度を推定し、" +
    "必ず次のJSON形式のみで応答してください: " +
    '{"seoScore": 0-100, "potentialScore": 0-100, "seoOpportunities": ["...", "..."], "reasonToContact": "..."}';

  const prompt = `会社名: ${lead.company.name}\nURL: ${lead.company.website}\n業種: ${
    lead.company.industry ?? "不明"
  }\n所在地: ${lead.company.location ?? "不明"}\n従業員規模: ${
    lead.company.employeeRange ?? "不明"
  }`;

  const stubResponse = JSON.stringify({
    seoScore: 42,
    potentialScore: 76,
    seoOpportunities: [
      "titleタグにキーワードが含まれていない",
      "ブログ更新が6ヶ月以上停止",
      "内部リンク構造が薄い",
    ],
    reasonToContact: "業種平均よりSEO順位が低く、コンテンツ更新も停滞しているため改善余地が大きい。",
  });

  const llm = await callLlm({ system, prompt, stubResponse, maxTokens: 512 });
  const result = parseResearchOutput(llm.text);
  const qualifies = result.potentialScore >= QUALIFY_THRESHOLD;

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      seoScore: result.seoScore,
      potentialScore: result.potentialScore,
      seoOpportunities: result.seoOpportunities,
      reasonToContact: result.reasonToContact,
      status: qualifies ? LeadStatus.QUALIFIED : LeadStatus.RESEARCHED,
    },
  });

  await logDecision({
    agentName: AGENT_NAME,
    targetType: "lead",
    targetId: lead.id,
    leadId: lead.id,
    input: { company: lead.company },
    decision: qualifies
      ? `見込み度${result.potentialScore}点で営業対象に選定（営業対象）`
      : `見込み度${result.potentialScore}点は基準未満のため保留（調査済み）`,
    reason: result.reasonToContact,
    output: result,
    llm,
  });

  return updated;
}
