import { prisma } from "@/lib/prisma";
import { runLeadResearchAgent } from "./leadResearchAgent";
import { auditWebsites, toHomepage } from "@/lib/siteAudit";
import type { ProspectingResult } from "./leadResearchAgent";

// ---------------------------------------------------------------------------
// 個人ECショップ（BASE / Shopify / STORES / 独自EC）のプロスペクティング。
//
// gBizINFOは登記済み法人しか扱えないため、個人事業主が運営するショップは
// 対象にできない。当初はGoogleカスタム検索で自動発掘する案だったが、
// base.shop/myshopify.comはPublic Suffix List登録ドメインのため
// Google Programmable Search Engine側の「ウェブ全体を検索」機能が
// 使えず（新規エンジンでは廃止済み）、自動検索は保留。
// 無料の代替（BASE公式事例ページ、みつかるくん等）も検証したが実用に耐えず
// （前者はカテゴリ不一致・件数僅少、後者は裏側のAPIが死んでいる）、
// 当面は営業担当がInstagram/ハッシュタグ等で見つけたショップURLを手動で
// 貼り付ける方式にする。SEO解析・公開連絡先（特定商取引法ページ含む）の
// 収集は既存のsiteAuditをそのまま流用する。
// ---------------------------------------------------------------------------

// 狙うべきカテゴリ。個人作家・ブランドが多いジャンルに絞る。
export const EC_CATEGORIES = [
  "アクセサリー",
  "ピアス",
  "イヤリング",
  "ネックレス",
  "指輪",
  "ブレスレット",
  "シルバーアクセサリー",
  "天然石アクセサリー",
  "ハンドメイド",
  "レディースファッション",
  "セレクトショップ",
  "革製品",
  "財布",
  "バッグ",
  "キャンドル",
  "インテリア雑貨",
] as const;

// 一度の登録で解析するURLの上限。サイトごとにトップページ＋問い合わせ/特定商取引法
// ページの最大2回フェッチするため、件数が多いと実行時間の上限を超える。
export const EC_MAX_URLS_PER_RUN = 15;

const EC_LEAD_SOURCE_NAME = "個人ECショップ（手動登録）";
const EC_CATEGORY_LABEL = "個人ECショップ";

function detectPlatformLabel(hostname: string): string {
  if (hostname.endsWith(".base.shop")) return "BASE";
  if (hostname.endsWith(".myshopify.com")) return "Shopify";
  if (hostname.endsWith(".stores.jp")) return "STORES";
  return "独自EC";
}

async function getEcLeadSourceId(): Promise<string> {
  const source = await prisma.leadSource.upsert({
    where: { name: EC_LEAD_SOURCE_NAME },
    update: {},
    create: { name: EC_LEAD_SOURCE_NAME, order: 100 },
  });
  return source.id;
}

function buildEcReason(params: { category: string; platformLabel: string; seoGaps: string[]; instagramUrl: string | null }): string {
  const parts = [`${params.platformLabel}の「${params.category}」ショップとして手動登録`];
  if (params.instagramUrl) {
    parts.push(`Instagram(${params.instagramUrl})はあるがGoogle検索からの導線は弱い可能性が高い`);
  }
  if (params.seoGaps.length > 0) {
    parts.push(`サイトには${params.seoGaps.slice(0, 3).join("・")}といった改善余地がある`);
  }
  parts.push("「Googleから何人来ているか」の無料診断から入れる見込み客");
  return parts.join("。") + "。";
}

/** 改行・カンマ・空白区切りのテキストから有効なURLだけを取り出す（重複除去込み）。 */
export function parseShopUrls(raw: string): string[] {
  const candidates = raw
    .split(/[\s,、]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const c of candidates) {
    const withScheme = /^https?:\/\//i.test(c) ? c : `https://${c}`;
    try {
      const url = new URL(withScheme);
      if (seen.has(url.origin)) continue;
      seen.add(url.origin);
      urls.push(withScheme);
    } catch {
      // URLとして解釈できない断片は無視
    }
  }
  return urls;
}

/**
 * 手動で貼り付けられたショップURL群を解析し、見込み客として登録する。
 * gBizINFO側の discoverProspectCompanies と同じ形の結果を返し、画面側を共用する。
 */
export async function registerEcShopProspects(params: {
  urls: string[];
  category: string;
}): Promise<ProspectingResult> {
  if (!EC_CATEGORIES.includes(params.category as (typeof EC_CATEGORIES)[number])) {
    throw new Error(`不明なカテゴリです: ${params.category}`);
  }
  if (params.urls.length === 0) {
    throw new Error("有効なURLが1件もありません。");
  }

  const result: ProspectingResult = {
    examined: params.urls.length,
    created: 0,
    skippedNoSite: 0,
    skippedUnreachable: 0,
    skippedExisting: 0,
    withEmail: 0,
  };

  // 同一ショップの重複と登録済みショップを除外してから解析する（無駄なfetchを避ける）。
  const seen = new Set<string>();
  const origins: string[] = [];
  for (const raw of params.urls.slice(0, EC_MAX_URLS_PER_RUN)) {
    const origin = toHomepage(raw);
    if (seen.has(origin)) continue;
    seen.add(origin);

    const dup = await prisma.company.findFirst({ where: { website: origin }, select: { id: true } });
    if (dup) {
      result.skippedExisting++;
      continue;
    }
    origins.push(origin);
  }

  const audits = await auditWebsites(origins);
  const leadSourceId = await getEcLeadSourceId();
  const createdLeadIds: string[] = [];

  for (const audit of audits) {
    if (!audit.reachable) {
      result.skippedUnreachable++;
      continue;
    }

    let host: string;
    try {
      host = new URL(audit.url).hostname;
    } catch {
      result.skippedUnreachable++;
      continue;
    }
    const platformLabel = detectPlatformLabel(host);
    // ショップ名が取れないと一覧が読みにくいので、titleかホスト名を使う
    const name = audit.title?.replace(/\s*[|｜\-–—].*$/, "").trim() || host;

    const company = await prisma.company.create({
      data: {
        name,
        website: audit.url,
        industry: params.category,
        toolInterest: EC_CATEGORY_LABEL,
        publicEmail: audit.publicEmail,
        detectedTools: audit.detectedTools,
        seoGaps: audit.seoGaps,
        lastAuditedAt: new Date(),
        leadSourceId,
        note: [`${platformLabel}の個人ECショップ（手動登録）`, audit.instagramUrl ? `Instagram: ${audit.instagramUrl}` : null]
          .filter(Boolean)
          .join(" / "),
      },
    });

    const lead = await prisma.lead.create({
      data: {
        companyId: company.id,
        reasonToContact: buildEcReason({
          category: params.category,
          platformLabel,
          seoGaps: audit.seoGaps,
          instagramUrl: audit.instagramUrl,
        }),
      },
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
