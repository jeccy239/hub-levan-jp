// Free, no-API-key website audit: fetches a company's public homepage and
// looks for (a) which marketing/analytics tools they already run, and (b)
// obvious SEO gaps. This is what turns a plain company list into a targeted
// prospect list — gBizINFO can tell us a company exists, only the site
// itself can tell us they run Hotjar but have no meta description.
//
// Only ever reads the public homepage, one request per company, with a
// short timeout and a normal identifying User-Agent.

export type ToolCategory = "SEOツール利用企業" | "ヒートマップツール利用企業" | "LLMOツール利用企業" | "広告代理店";

type Signature = { name: string; category: ToolCategory; patterns: RegExp[] };

const SIGNATURES: Signature[] = [
  // --- SEO / analytics ---
  { name: "Google Tag Manager", category: "SEOツール利用企業", patterns: [/googletagmanager\.com\/gtm\.js/i] },
  { name: "Google Analytics", category: "SEOツール利用企業", patterns: [/google-analytics\.com|gtag\/js\?id=G-/i] },
  { name: "Google Search Console", category: "SEOツール利用企業", patterns: [/name=["']google-site-verification["']/i] },
  { name: "Ahrefs", category: "SEOツール利用企業", patterns: [/analytics\.ahrefs\.com/i] },
  { name: "Semrush", category: "SEOツール利用企業", patterns: [/semrush/i] },
  { name: "Juicer", category: "SEOツール利用企業", patterns: [/juicer\.cc/i] },

  // --- ヒートマップ ---
  { name: "Microsoft Clarity", category: "ヒートマップツール利用企業", patterns: [/clarity\.ms/i] },
  { name: "Hotjar", category: "ヒートマップツール利用企業", patterns: [/static\.hotjar\.com|hotjar\.io/i] },
  { name: "Ptengine", category: "ヒートマップツール利用企業", patterns: [/ptengine\.(jp|com)/i] },
  { name: "User Heat", category: "ヒートマップツール利用企業", patterns: [/uh\.nakanohito\.jp/i] },
  { name: "Mouseflow", category: "ヒートマップツール利用企業", patterns: [/mouseflow\.com/i] },
  { name: "SiTest", category: "ヒートマップツール利用企業", patterns: [/sitest\.jp/i] },
  { name: "Contentsquare", category: "ヒートマップツール利用企業", patterns: [/contentsquare\.net/i] },

  // --- LLMO / 生成AI検索最適化 ---
  { name: "llms.txt", category: "LLMOツール利用企業", patterns: [/href=["'][^"']*llms\.txt/i] },
  { name: "構造化データ(JSON-LD)", category: "LLMOツール利用企業", patterns: [/application\/ld\+json/i] },

  // --- 広告代理店シグナル（サイト内の自己紹介文言） ---
  { name: "広告代理店", category: "広告代理店", patterns: [/広告代理店|デジタルマーケティング支援|Web制作会社|SEO対策サービス/] },
];

export type SiteAudit = {
  url: string;
  reachable: boolean;
  detectedTools: string[];
  categories: ToolCategory[];
  publicEmail: string | null;
  seoGaps: string[];
  title: string | null;
};

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 600_000;
// HTTPヘッダはASCII(ByteString)のみ。日本語を入れるとfetchが例外を投げ、
// 全社が「接続不可」になるため、必ずASCIIで書くこと。
const USER_AGENT = "LEVAN-HUB-SalesAI/1.0 (+https://hub.levan.jp; sales research, public pages only)";

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) return null;
    const text = await res.text();
    return text.slice(0, MAX_BYTES);
  } catch {
    return null; // unreachable, TLS failure, timeout, blocked — all "no data"
  } finally {
    clearTimeout(timer);
  }
}

// 法人がサイト上に公開している問い合わせ用アドレスのみを拾う。個人名義に
// 見えるものや画像・ノイズは除外する。特定電子メール法上、広告メールを
// 送れるのは「サイトで公開されている法人のアドレス」に限られるため。
const GENERIC_LOCAL_PARTS = /^(info|contact|inquiry|support|sales|office|mail|desk|toiawase|otoiawase|hello|marketing|pr)$/i;

function extractPublicEmail(html: string, host: string): string | null {
  const candidates = new Set<string>();
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) candidates.add(m[1]);
  for (const m of html.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)) candidates.add(m[0]);

  const rootDomain = host.replace(/^www\./, "");
  let fallback: string | null = null;

  for (const raw of candidates) {
    const email = raw.trim().toLowerCase().replace(/[.,;]$/, "");
    if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) continue;
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(email)) continue;
    if (/(example|sentry|wixpress|no-?reply)/i.test(email)) continue;

    const [local, domain] = email.split("@");
    const sameOrg = domain === rootDomain || domain.endsWith(`.${rootDomain}`);
    if (sameOrg && GENERIC_LOCAL_PARTS.test(local)) return email; // best case
    if (!fallback && sameOrg) fallback = email;
  }
  return fallback;
}

function findSeoGaps(html: string): string[] {
  const gaps: string[] = [];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  if (!title) gaps.push("titleタグが無い");
  else if (title.length < 15) gaps.push("titleタグが短い（15文字未満）");

  if (!/name=["']description["']/i.test(html)) gaps.push("meta descriptionが無い");
  if (!/<h1[\s>]/i.test(html)) gaps.push("h1見出しが無い");
  if (!/application\/ld\+json/i.test(html)) gaps.push("構造化データ(JSON-LD)が無い");
  if (!/(ブログ|blog|コラム|column|お役立ち|news)/i.test(html)) gaps.push("オウンドメディア/ブログ導線が見当たらない");
  if (!/rel=["']canonical["']/i.test(html)) gaps.push("canonicalタグが無い");
  if (!/property=["']og:/i.test(html)) gaps.push("OGP設定が無い");
  return gaps;
}

/** gBizINFOのcompany_urlは「会社概要」「採用福利厚生」等の下層ページを指して
 *  いることが多い（実測: ぐるなび→/profile/sustainability/diversity/）。
 *  下層ページのtitleやmeta有無を見てもSEO成熟度は測れないため、必ず
 *  オリジン（トップページ）に正規化してから解析する。 */
export function toHomepage(rawUrl: string): string {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

export async function auditWebsite(rawUrl: string): Promise<SiteAudit> {
  const url = toHomepage(rawUrl);

  const empty: SiteAudit = {
    url,
    reachable: false,
    detectedTools: [],
    categories: [],
    publicEmail: null,
    seoGaps: [],
    title: null,
  };

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return empty;
  }

  const html = await fetchHtml(url);
  if (!html) return empty;

  // トップページにアドレスが無い場合のみ、トップから辿れる問い合わせページを
  // 1枚だけ追加で見る（多くの日本企業はフォーム設置でトップには載せないため）。
  let publicEmail = extractPublicEmail(html, host);
  if (!publicEmail) {
    const contactHref = html.match(
      /href=["']([^"']*(?:contact|inquiry|toiawase|otoiawase|お問い合わせ|問合)[^"']*)["']/i,
    )?.[1];
    if (contactHref) {
      try {
        const contactUrl = new URL(contactHref, url).toString();
        if (new URL(contactUrl).hostname === host) {
          const contactHtml = await fetchHtml(contactUrl);
          if (contactHtml) publicEmail = extractPublicEmail(contactHtml, host);
        }
      } catch {
        // 不正なhrefは無視
      }
    }
  }

  const detectedTools: string[] = [];
  const categories = new Set<ToolCategory>();
  for (const sig of SIGNATURES) {
    if (sig.patterns.some((p) => p.test(html))) {
      detectedTools.push(sig.name);
      categories.add(sig.category);
    }
  }

  return {
    url,
    reachable: true,
    detectedTools,
    categories: [...categories],
    publicEmail,
    seoGaps: findSeoGaps(html),
    title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().slice(0, 200) ?? null,
  };
}

/** Audits many sites with a small concurrency cap, so we stay polite and
 *  stay inside the serverless function's time budget. */
export async function auditWebsites(urls: string[], concurrency = 5): Promise<SiteAudit[]> {
  const results: SiteAudit[] = [];
  const queue = [...urls];

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        results.push(await auditWebsite(next));
      }
    }),
  );

  return results;
}
