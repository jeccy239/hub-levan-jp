// メール管理の宛先は4系統ある。営業リード、CRM上の企業（既存顧客を含む）、
// WEBRISの契約者、そして手入力。どこから来た宛先かで差し込めるデータが
// 違うので、種別を落とさずに1つの型へ寄せる。
//
// 特に「WEBRIS契約者に WEBRIS の新規登録を勧める」ような取り違えは実害が
// あるため、種別と契約プランは常に画面まで持っていく。

import { prisma } from "./prisma";
import { fetchWebrisOrganizations } from "./webris";
import { LeadStatus } from "@/generated/prisma/client";

export { isValidEmail, parseManualEmails } from "./parseEmails";

export type RecipientKind = "lead" | "company" | "webris" | "manual";

export type Recipient = {
  /** "lead:xxx" / "company:xxx" / "webris:xxx" / "manual:foo@example.com" */
  id: string;
  kind: RecipientKind;
  name: string;
  email: string;
  /** 画面に出す補足（プラン名・見込み度・部署など） */
  meta: string | null;
  website: string;
  tools: string[];
  seoGaps: string[];
  /** 既に営業メールを送ったことがある相手か */
  alreadyContacted: boolean;
};

export const RECIPIENT_KIND_LABEL: Record<RecipientKind, string> = {
  lead: "見込み客",
  company: "既存顧客・CRM",
  webris: "WEBRIS契約者",
  manual: "手入力",
};

export function parseRecipientId(id: string): { kind: RecipientKind; key: string } | null {
  const idx = id.indexOf(":");
  if (idx < 0) return null;
  const kind = id.slice(0, idx) as RecipientKind;
  if (!["lead", "company", "webris", "manual"].includes(kind)) return null;
  return { kind, key: id.slice(idx + 1) };
}

function toolsOf(company: { detectedTools: unknown; seoGaps: unknown }) {
  return {
    tools: Array.isArray(company.detectedTools) ? (company.detectedTools as string[]) : [],
    seoGaps: Array.isArray(company.seoGaps) ? (company.seoGaps as string[]) : [],
  };
}

/**
 * 送信可能な宛先を全系統から集める。アドレスが無い相手は返さない
 * （画面には「なぜ送れないか」を別途出す）。
 */
export async function collectRecipients(): Promise<{
  recipients: Recipient[];
  /** アドレスが取れず送信対象にできなかった企業数 */
  unreachableCount: number;
  webrisError: string | null;
}> {
  const [leads, companies, webrisResult] = await Promise.all([
    prisma.lead.findMany({
      where: { status: { in: [LeadStatus.RESEARCHED, LeadStatus.QUALIFIED, LeadStatus.CONTACTED] } },
      include: { company: { include: { contacts: { where: { email: { not: null } }, take: 1 } } } },
      orderBy: [{ potentialScore: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
    // リードが付いていない企業＝CRMだけに存在する既存顧客・取引先
    prisma.company.findMany({
      where: { lead: null },
      include: {
        contacts: { where: { email: { not: null } }, take: 1 },
        customer: { select: { id: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    fetchWebrisOrganizations()
      .then((orgs) => ({ orgs, error: null as string | null }))
      .catch((e: unknown) => ({ orgs: [], error: e instanceof Error ? e.message : "WEBRIS顧客を取得できませんでした" })),
  ]);

  const recipients: Recipient[] = [];
  let unreachableCount = 0;
  const seenEmails = new Set<string>();

  const push = (r: Recipient) => {
    const key = r.email.toLowerCase();
    if (seenEmails.has(key)) return; // 同一アドレスへの二重送信を防ぐ
    seenEmails.add(key);
    recipients.push(r);
  };

  for (const lead of leads) {
    const email = lead.company.publicEmail ?? lead.company.contacts[0]?.email ?? null;
    if (!email) {
      unreachableCount++;
      continue;
    }
    push({
      id: `lead:${lead.id}`,
      kind: "lead",
      name: lead.company.name,
      email,
      meta: lead.potentialScore != null ? `見込み度 ${lead.potentialScore}` : null,
      website: lead.company.website,
      ...toolsOf(lead.company),
      alreadyContacted: lead.status === LeadStatus.CONTACTED,
    });
  }

  for (const c of companies) {
    const email = c.publicEmail ?? c.contacts[0]?.email ?? null;
    if (!email) {
      unreachableCount++;
      continue;
    }
    push({
      id: `company:${c.id}`,
      kind: "company",
      name: c.name,
      email,
      meta: c.customer ? "契約中" : (c.industry ?? null),
      website: c.website,
      ...toolsOf(c),
      alreadyContacted: false,
    });
  }

  for (const org of webrisResult.orgs) {
    if (!org.ownerEmail) {
      unreachableCount++;
      continue;
    }
    push({
      id: `webris:${org.id}`,
      kind: "webris",
      name: org.name,
      email: org.ownerEmail,
      meta: `${org.planName}プラン`,
      website: org.websiteUrl ?? "",
      // WEBRIS契約者にはサイト解析をかけていないため、ツール/課題データは無い
      tools: [],
      seoGaps: [],
      alreadyContacted: false,
    });
  }

  return { recipients, unreachableCount, webrisError: webrisResult.error };
}
