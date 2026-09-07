import { prisma } from "@/lib/prisma";
import { callLlm } from "./llm";
import { logDecision } from "./decisionLog";
import { LeadStatus } from "@/generated/prisma/client";
import { searchGbizCompanies, type GbizCompany } from "@/lib/gbizinfo";
import { auditWebsites, type SiteAudit, type ToolCategory } from "@/lib/siteAudit";

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

  // サイト実解析の結果（siteAudit）があればそれを渡す。これが無いと
  // モデルは推測でしか答えられない。
  const detectedTools = Array.isArray(lead.company.detectedTools) ? (lead.company.detectedTools as string[]) : [];
  const seoGaps = Array.isArray(lead.company.seoGaps) ? (lead.company.seoGaps as string[]) : [];

  const prompt = `会社名: ${lead.company.name}\nURL: ${lead.company.website}\n業種: ${
    lead.company.industry ?? "不明"
  }\n所在地: ${lead.company.location ?? "不明"}\n従業員規模: ${
    lead.company.employeeRange ?? "不明"
  }\n事業概要: ${lead.company.note ?? "不明"}\n検出済みツール: ${
    detectedTools.length > 0 ? detectedTools.join("、") : "なし"
  }\nサイト解析で判明したSEO上の不足: ${seoGaps.length > 0 ? seoGaps.join("、") : "特になし"}`;

  // スタブ（APIキー未設定時）でも作り話をしないよう、実解析データから
  // 機械的にスコアを算出する。不足が多いほど伸びしろ＝見込み度が高い。
  const seoScore = Math.max(0, 100 - seoGaps.length * 14);
  const potentialScore = Math.min(
    100,
    (seoGaps.length > 0 ? 40 + seoGaps.length * 10 : 20) + detectedTools.length * 6,
  );
  const stubResponse = JSON.stringify({
    seoScore,
    potentialScore,
    seoOpportunities: seoGaps,
    reasonToContact: lead.reasonToContact ?? "サイト解析データが無いため要目視確認。",
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


// ---------------------------------------------------------------------------
// WEBRIS SALES AI — 実在企業のプロスペクティング。Level 3（全自動）だが、
// 調査と保存しか行わない。連絡は salesAgent.ts 側の人間操作でのみ発生する。
//
// 企業リストは gBizINFO（経済産業省・無料）から取得し、各社の公開サイトを
// 実際に解析して「どのツールを使っているか」「SEO上どこが弱いか」を判定する。
// LLMに企業名を考えさせる方式は、Web検索を持たないモデルが実在しない企業名を
// 生成してしまうため廃止した。
// ---------------------------------------------------------------------------

export const TOOL_INTEREST_CATEGORIES = [
  "SEOツール利用企業",
  "ヒートマップツール利用企業",
  "LLMOツール利用企業",
  "広告代理店",
] as const;

export type ProspectingResult = {
  examined: number;
  created: number;
  skippedNoSite: number;
  skippedUnreachable: number;
  skippedExisting: number;
  withEmail: number;
};

/** 見つけたシグナルから、人間が読んで納得できる「連絡すべき理由」を組み立てる */
function buildReason(audit: SiteAudit, company: GbizCompany): string {
  const parts: string[] = [];
  if (audit.detectedTools.length > 0) {
    parts.push(`${audit.detectedTools.join("・")}を導入済みで、計測環境が既にある`);
  }
  if (audit.seoGaps.length > 0) {
    parts.push(`一方でサイトには${audit.seoGaps.slice(0, 3).join("・")}といった改善余地がある`);
  }
  if (company.employeeNumber) parts.push(`従業員${company.employeeNumber}名規模`);
  return parts.length > 0
    ? `${parts.join("。")}。SEOコンテンツ運用代行の提案余地が大きい。`
    : "公開情報からは判断材料が少ないため、要目視確認。";
}

function pickCategory(audit: SiteAudit): string | null {
  // ヒートマップ > LLMO > SEO の順に、より具体性の高いシグナルを優先する
  const priority: ToolCategory[] = [
    "ヒートマップツール利用企業",
    "LLMOツール利用企業",
    "広告代理店",
    "SEOツール利用企業",
  ];
  return priority.find((c) => audit.categories.includes(c)) ?? null;
}

/**
 * gBizINFOから実在企業を取得し、各社の公開サイトを解析して見込み客として
 * 登録する。ツールを1つも検出できず、SEO上の課題も見つからない企業は
 * 「営業する理由がない」ので登録しない。
 */
export async function discoverProspectCompanies(params?: {
  prefecture?: string;
  employeeFrom?: number;
  employeeTo?: number;
  page?: number;
  limit?: number;
}): Promise<ProspectingResult> {
  const limit = params?.limit ?? 10;

  const candidates = await searchGbizCompanies({
    prefecture: params?.prefecture ?? "13", // 既定は東京都
    employeeFrom: params?.employeeFrom ?? 10,
    employeeTo: params?.employeeTo,
    page: params?.page ?? 1,
  });

  const result: ProspectingResult = {
    examined: candidates.length,
    created: 0,
    skippedNoSite: 0,
    skippedUnreachable: 0,
    skippedExisting: 0,
    withEmail: 0,
  };

  // 既知の法人・既知のURLは除外してから、サイト解析にかける
  const fresh: GbizCompany[] = [];
  for (const c of candidates) {
    if (!c.companyUrl) {
      result.skippedNoSite++;
      continue;
    }
    const existing = await prisma.company.findFirst({
      where: { OR: [{ corporateNumber: c.corporateNumber }, { website: c.companyUrl }] },
      select: { id: true },
    });
    if (existing) {
      result.skippedExisting++;
      continue;
    }
    fresh.push(c);
    if (fresh.length >= limit) break;
  }

  const audits = await auditWebsites(fresh.map((c) => c.companyUrl as string));
  const auditByUrl = new Map(audits.map((a) => [a.url, a]));

  const createdLeadIds: string[] = [];
  for (const c of fresh) {
    const audit =
      auditByUrl.get(c.companyUrl as string) ??
      auditByUrl.get(`https://${(c.companyUrl as string).replace(/^https?:\/\//, "")}`);

    if (!audit || !audit.reachable) {
      result.skippedUnreachable++;
      continue;
    }
    // 営業する理由が何も無い企業は登録しない（リストを汚さない）
    if (audit.detectedTools.length === 0 && audit.seoGaps.length === 0) continue;

    const company = await prisma.company.create({
      data: {
        name: c.name,
        website: audit.url,
        corporateNumber: c.corporateNumber,
        industry: c.businessItems[0] ?? null,
        location: c.prefectureName,
        address: c.location,
        employeeRange: c.employeeNumber ? `${c.employeeNumber}名` : null,
        toolInterest: pickCategory(audit),
        publicEmail: audit.publicEmail,
        detectedTools: audit.detectedTools,
        seoGaps: audit.seoGaps,
        lastAuditedAt: new Date(),
        note: c.businessSummary,
      },
    });

    const lead = await prisma.lead.create({
      data: { companyId: company.id, reasonToContact: buildReason(audit, c) },
    });

    createdLeadIds.push(lead.id);
    result.created++;
    if (audit.publicEmail) result.withEmail++;
  }

  for (const leadId of createdLeadIds) {
    await runLeadResearchAgent(leadId);
  }

  return result;
}
