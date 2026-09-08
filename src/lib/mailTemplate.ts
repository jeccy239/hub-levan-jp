// 営業メールのテンプレート差込。差込値はすべて実データ（サイト解析結果・
// gBizINFO・送信者情報）に由来し、推測値は使わない。
//
// {{keyword}} や検索順位の類は意図的に用意していない。それらは相手企業の
// Search Console の中にあるデータで、外部から取得する手段が無いため、
// 変数として提供すると空欄か作り話にしかならない。

import { SENDER_COMPANY_ADDRESS, SENDER_COMPANY_NAME, WEBRIS_PUBLIC_URL } from "./senderIdentity";

export type TemplateContext = {
  company: string;
  website: string;
  tools: string[];
  seoGaps: string[];
  sender: string;
  /** 計測用リダイレクトを通したWEBRISのURL。未指定なら素のURL。 */
  webrisUrl?: string;
};

export const TEMPLATE_VARIABLES = [
  { token: "{{company}}", label: "会社名", source: "gBizINFO" },
  { token: "{{website}}", label: "相手サイトURL", source: "サイト解析" },
  { token: "{{tools}}", label: "導入済みツール", source: "サイト解析" },
  { token: "{{seoGap}}", label: "SEO上の不足", source: "サイト解析" },
  { token: "{{seoOpportunity}}", label: "改善提案文", source: "サイト解析" },
  { token: "{{sender}}", label: "差出人名", source: "ログイン中の担当者" },
  { token: "{{webris_url}}", label: "WEBRIS計測リンク", source: "クリック計測" },
  { token: "{{company_address}}", label: "LEVANの住所", source: "法定表示" },
] as const;

// 検出した不足ごとに「なぜ問題か」を一文で言える形にする。箇条書きの用語を
// そのまま貼るより、相手にとって意味のある指摘になる。
const OPPORTUNITY_BY_GAP: Record<string, string> = {
  "meta descriptionが無い":
    "検索結果に出る説明文が自動生成に任されている状態で、クリック率を取りこぼしている可能性があります。",
  "構造化データ(JSON-LD)が無い":
    "検索エンジンや生成AIにページの内容が構造として伝わっておらず、リッチリザルトやAI検索での引用機会を逃している可能性があります。",
  "h1見出しが無い": "ページの主題が検索エンジンに伝わりにくく、評価が分散している可能性があります。",
  "titleタグが短い（15文字未満）":
    "titleに検索キーワードを含める余地が残っており、上位表示の機会を活かしきれていない可能性があります。",
  "titleタグが無い": "titleが未設定のため、検索結果での表示が不安定になっている可能性があります。",
  "canonicalタグが無い": "URLの重複がある場合に評価が分散し、本来の評価を受け取れていない可能性があります。",
  "OGP設定が無い": "SNSでシェアされた際に情報が正しく表示されず、流入機会を損ねている可能性があります。",
  "オウンドメディア/ブログ導線が見当たらない":
    "継続的に検索流入を集める入り口が不足しており、指名検索以外の接点が限られている可能性があります。",
};

function buildOpportunity(seoGaps: string[]): string {
  const primary = seoGaps.find((g) => OPPORTUNITY_BY_GAP[g]);
  if (primary) return OPPORTUNITY_BY_GAP[primary];
  if (seoGaps.length > 0) return `${seoGaps[0]}という点で改善の余地がありそうです。`;
  return "サイト全体の構成を見直すことで、検索流入を伸ばせる可能性があります。";
}

export function fillTemplate(template: string, ctx: TemplateContext): string {
  const tools = ctx.tools.length > 0 ? ctx.tools.join("・") : "アクセス解析ツール";
  const seoGap = ctx.seoGaps.length > 0 ? ctx.seoGaps.slice(0, 2).join("・") : "コンテンツ更新頻度";

  return template
    .replaceAll("{{company}}", ctx.company)
    .replaceAll("{{website}}", ctx.website)
    .replaceAll("{{tools}}", tools)
    .replaceAll("{{seoGap}}", seoGap)
    .replaceAll("{{seoOpportunity}}", buildOpportunity(ctx.seoGaps))
    .replaceAll("{{sender}}", ctx.sender)
    .replaceAll("{{webris_url}}", ctx.webrisUrl ?? WEBRIS_PUBLIC_URL)
    .replaceAll("{{company_address}}", `${SENDER_COMPANY_NAME}\n${SENDER_COMPANY_ADDRESS}`);
}

/**
 * 差込後に未解決の {{...}} が残っていないか検査する。実送信が有効になった今、
 * 未定義の変数がそのまま実在企業に届くのを防ぐ最後の砦。送信経路は必ず
 * これを通すこと。
 */
export function findUnresolvedVariables(filled: string): string[] {
  return [...new Set(filled.match(/\{\{[^}\n]{1,40}\}\}/g) ?? [])];
}

export class UnresolvedTemplateVariableError extends Error {
  constructor(public variables: string[]) {
    super(
      `テンプレートに未対応の差込変数が残っています: ${variables.join("、")}。` +
        `使用できるのは ${TEMPLATE_VARIABLES.map((v) => v.token).join("、")} です。`,
    );
  }
}

/** 差込 + 検査をまとめて行う。未解決変数があれば例外を投げる。 */
export function fillTemplateStrict(template: string, ctx: TemplateContext): string {
  const filled = fillTemplate(template, ctx);
  const unresolved = findUnresolvedVariables(filled);
  if (unresolved.length > 0) throw new UnresolvedTemplateVariableError(unresolved);
  return filled;
}
