import type { AdSpendSummary } from "./adsService";
import type {
  Ga4Data,
  GscData,
  GscQuery,
  Metric,
  ProductData,
  RevenueData,
  Section,
  WebrisAnalyticsPayload,
} from "./types";

/**
 * 画面に出す指標の組み立て。すべて純関数で、WEBRIS の応答と広告費から計算する。
 * 取れていない値は Metric の unmeasured / error で表し、推測値で埋めない。
 */

// ---------------------------------------------------------------------------
// 共通
// ---------------------------------------------------------------------------

export function sectionData<T>(s: Section<T> | undefined): T | null {
  return s && s.status === "ok" ? s.data : null;
}

/** セクションが使えないときの Metric（未連携と取得エラーを区別する） */
export function unavailable(s: Section<unknown> | undefined, fallback: string): Metric {
  if (!s) return { kind: "error", reason: fallback };
  if (s.status === "ok") return { kind: "unmeasured", reason: fallback };
  if (s.status === "error") return { kind: "error", reason: s.message };
  return { kind: "unmeasured", reason: s.message };
}

const value = (v: number, prev: number | null, series?: number[]): Metric => ({ kind: "value", value: v, prev, series });

export function ratio(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

export function change(cur: number, prev: number | null): { diff: number; pct: number | null } | null {
  if (prev === null) return null;
  return { diff: cur - prev, pct: prev !== 0 ? (cur - prev) / prev : null };
}

/** これ未満の母数では「傾向」と言わない */
export const SMALL_SAMPLE = 30;

// ---------------------------------------------------------------------------
// KPI
// ---------------------------------------------------------------------------

export type KpiFormat = "int" | "jpy" | "pct" | "duration" | "position";
export type Kpi = {
  key: string;
  label: string;
  metric: Metric;
  format: KpiFormat;
  source: string;
  hint: string;
  /** 低いほど良い指標（CAC など）。増減の色を反転する */
  lowerIsBetter?: boolean;
  note?: string;
};

export function buildKpis(p: WebrisAnalyticsPayload, ads: AdSpendSummary, adsPrev: AdSpendSummary): Kpi[] {
  const ga4 = sectionData(p.ga4);
  const product = sectionData(p.product);
  const revenue = sectionData(p.revenue);
  const ga = (pick: (d: Ga4Data) => { cur: number; prev: number; series?: number[] }, reason = "GA4未連携"): Metric => {
    if (!ga4) return unavailable(p.ga4, reason);
    const r = pick(ga4);
    return value(r.cur, r.prev, r.series);
  };
  const pr = (pick: (d: ProductData) => { cur: number; prev: number | null; series?: number[] }): Metric => {
    if (!product) return unavailable(p.product, "WEBRIS DB未取得");
    const r = pick(product);
    return value(r.cur, r.prev, r.series);
  };
  const daily = <K extends keyof Ga4Data["daily"][number]>(d: Ga4Data, k: K) => d.daily.map((x) => Number(x[k]));
  const pDaily = <K extends keyof ProductData["daily"][number]>(d: ProductData, k: K) => d.daily.map((x) => Number(x[k]));

  const returning: Metric = !ga4
    ? unavailable(p.ga4, "GA4未連携")
    : ga4.returning.current === null
      ? { kind: "error", reason: "GA4の新規/リピーター内訳の取得に失敗しました" }
      : value(ga4.returning.current, ga4.returning.previous);

  const paying: Metric = product
    ? { kind: "value", value: product.totals.paying, prev: null }
    : unavailable(p.product, "WEBRIS DB未取得");

  const revenueMetric: Metric = revenue
    ? value(revenue.current.revenueJpy, revenue.previous.revenueJpy, revenue.daily.map((d) => d.revenueJpy))
    : unavailable(p.revenue, "Stripe未設定");

  let arpu: Metric;
  if (!revenue) arpu = unavailable(p.revenue, "Stripe未設定");
  else if (revenue.current.customers === 0) arpu = { kind: "unmeasured", reason: "期間内に支払いのある顧客がいません" };
  else
    arpu = value(
      Math.round(revenue.current.revenueJpy / revenue.current.customers),
      revenue.previous.customers > 0 ? Math.round(revenue.previous.revenueJpy / revenue.previous.customers) : null,
    );

  let cac: Metric;
  if (!ads.hasData) cac = { kind: "unmeasured", reason: "広告費が未入力です（流入元タブから入力）" };
  else if (!product) cac = unavailable(p.product, "WEBRIS DB未取得");
  else if (product.current.paidStarts === 0) cac = { kind: "unmeasured", reason: `期間内の新規有料化が0件（広告費 ¥${ads.totalJpy.toLocaleString("ja-JP")}）` };
  else
    cac = value(
      Math.round(ads.totalJpy / product.current.paidStarts),
      adsPrev.hasData && product.previous.paidStarts > 0 ? Math.round(adsPrev.totalJpy / product.previous.paidStarts) : null,
    );

  let cvr: Metric;
  if (!ga4) cvr = unavailable(p.ga4, "GA4未連携（分母のセッションが取れません）");
  else if (!product) cvr = unavailable(p.product, "WEBRIS DB未取得");
  else if (ga4.current.sessions === 0) cvr = { kind: "unmeasured", reason: "期間内のセッションが0件" };
  else
    cvr = value(
      product.current.signups / ga4.current.sessions,
      ga4.previous.sessions > 0 ? product.previous.signups / ga4.previous.sessions : null,
    );

  return [
    { key: "activeUsers", label: "アクティブユーザー", format: "int", source: "GA4", hint: "期間内にサイトを利用したユーザー数", metric: ga((d) => ({ cur: d.current.activeUsers, prev: d.previous.activeUsers, series: daily(d, "activeUsers") })) },
    { key: "newUsers", label: "新規ユーザー", format: "int", source: "GA4", hint: "期間内に初めて訪問したユーザー数", metric: ga((d) => ({ cur: d.current.newUsers, prev: d.previous.newUsers, series: daily(d, "newUsers") })) },
    { key: "returning", label: "リピーター", format: "int", source: "GA4", hint: "GA4の「リピーター」に分類されたアクティブユーザー", metric: returning },
    { key: "sessions", label: "セッション", format: "int", source: "GA4", hint: "訪問回数", metric: ga((d) => ({ cur: d.current.sessions, prev: d.previous.sessions, series: daily(d, "sessions") })) },
    { key: "pageViews", label: "ページビュー", format: "int", source: "GA4", hint: "表示されたページの延べ数", metric: ga((d) => ({ cur: d.current.pageViews, prev: d.previous.pageViews, series: daily(d, "pageViews") })) },
    { key: "engagement", label: "平均エンゲージメント時間", format: "duration", source: "GA4", hint: "ユーザー1人あたりの、ページが前面に表示されていた時間", metric: ga((d) => ({ cur: d.current.avgEngagementSec, prev: d.previous.avgEngagementSec })) },
    { key: "signups", label: "無料登録数", format: "int", source: "WEBRIS DB", hint: "作成された企業アカウント数（WEBRIS自身のアカウントは除外）", metric: pr((d) => ({ cur: d.current.signups, prev: d.previous.signups, series: pDaily(d, "signups") })) },
    { key: "urlAdds", label: "URL登録数", format: "int", source: "WEBRIS DB", hint: "登録されたサイトURLの数", metric: pr((d) => ({ cur: d.current.urlAdds, prev: d.previous.urlAdds, series: pDaily(d, "urlAdds") })) },
    { key: "aiRuns", label: "AI分析実行数", format: "int", source: "WEBRIS DB", hint: "AIインサイト・記事生成・改善提案・AIO/ブランド診断の実行回数の合計", metric: pr((d) => ({ cur: d.current.aiRuns, prev: d.previous.aiRuns, series: pDaily(d, "aiRuns") })) },
    {
      key: "paying",
      label: "有料ユーザー",
      format: "int",
      source: "WEBRIS DB",
      hint: "現在、有料プランで課金中（active / trialing / past_due）のアカウント数。期間ではなく現時点の値",
      metric: paying,
      note: product ? `期間中 +${product.current.paidStarts} / −${product.current.cancels}` : undefined,
    },
    { key: "revenue", label: "売上", format: "jpy", source: "Stripe", hint: "期間内に支払い済みになった請求書の合計（税込・JPYのみ）", metric: revenueMetric },
    { key: "arpu", label: "ARPU", format: "jpy", source: "Stripe", hint: "売上 ÷ 期間内に支払いのあった顧客数", metric: arpu },
    { key: "cac", label: "CAC", format: "jpy", source: "広告費(手入力) / WEBRIS DB", hint: "広告費 ÷ 期間内の新規有料化数（全チャネル合算のブレンドCAC）", metric: cac, lowerIsBetter: true },
    { key: "cvr", label: "CVR", format: "pct", source: "GA4 + WEBRIS DB", hint: "無料登録数 ÷ セッション", metric: cvr },
  ];
}

// ---------------------------------------------------------------------------
// 流入元
// ---------------------------------------------------------------------------

export const CHANNELS = [
  { key: "google_organic", label: "Google Organic" },
  { key: "instagram_paid", label: "Instagram Paid" },
  { key: "instagram_organic", label: "Instagram Organic" },
  { key: "direct", label: "Direct" },
  { key: "referral", label: "Referral" },
  { key: "other", label: "Other" },
] as const;
export type ChannelKey = (typeof CHANNELS)[number]["key"];

export function classifyChannel(source: string, medium: string, group: string): ChannelKey {
  const s = source.trim().toLowerCase();
  const m = medium.trim().toLowerCase();
  const g = group.trim().toLowerCase();
  const isInstagram = s.includes("instagram") || s === "ig" || s.startsWith("ig_") || s.startsWith("ig.");
  const isPaid = g.startsWith("paid") || /(^|_|-)(paid|cpc|ppc|cpm|cpv|ads?)($|_|-)/.test(m) || m === "paid_social";
  if (isInstagram) return isPaid ? "instagram_paid" : "instagram_organic";
  if (s === "(direct)" || g === "direct") return "direct";
  if (s.includes("google") && (m === "organic" || g === "organic search")) return "google_organic";
  if (m === "referral" || g === "referral") return "referral";
  return "other";
}

/** GA4 に送られていれば流入元別に数えられるイベント（名前の揺れを吸収） */
export const CONVERSION_EVENTS = {
  signup: ["signup_complete", "sign_up"],
  urlAdd: ["url_add"],
  ai: ["ai_analysis_complete", "ai_analysis_start"],
  purchase: ["purchase", "subscription_start"],
} as const;

export type ChannelRow = {
  key: ChannelKey;
  label: string;
  users: number;
  newUsers: number;
  sessions: number;
  prevUsers: number;
  prevSessions: number;
  keyEvents: number;
  firstUsers: number;
  /** null = GA4 にそのイベントが1件も無い（未計測） */
  signups: number | null;
  urlAdds: number | null;
  aiRuns: number | null;
  purchases: number | null;
  revenue: number | null;
  cvr: number | null;
  adSpend: number | null;
  cac: number | null;
  roas: number | null;
};

export function buildChannels(ga4: Ga4Data, ads: AdSpendSummary): { rows: ChannelRow[]; trackedEvents: Record<keyof typeof CONVERSION_EVENTS, boolean>; unmatched: { source: string; medium: string; sessions: number }[] } {
  const rows = new Map<ChannelKey, ChannelRow>(
    CHANNELS.map((c) => [
      c.key,
      { key: c.key, label: c.label, users: 0, newUsers: 0, sessions: 0, prevUsers: 0, prevSessions: 0, keyEvents: 0, firstUsers: 0, signups: null, urlAdds: null, aiRuns: null, purchases: null, revenue: null, cvr: null, adSpend: null, cac: null, roas: null },
    ]),
  );
  const unmatched: { source: string; medium: string; sessions: number }[] = [];
  for (const c of ga4.channels) {
    const key = classifyChannel(c.source, c.medium, c.channelGroup);
    const r = rows.get(key)!;
    r.users += c.users;
    r.newUsers += c.newUsers;
    r.sessions += c.sessions;
    r.prevUsers += c.prevUsers;
    r.prevSessions += c.prevSessions;
    r.keyEvents += c.keyEvents;
    if (key === "other") unmatched.push({ source: c.source, medium: c.medium, sessions: c.sessions });
  }
  for (const c of ga4.firstUserChannels) rows.get(classifyChannel(c.source, c.medium, c.channelGroup))!.firstUsers += c.users;

  const eventNames = new Set(ga4.events.filter((e) => e.count > 0 || e.prevCount > 0).map((e) => e.name));
  const trackedEvents = Object.fromEntries(
    Object.entries(CONVERSION_EVENTS).map(([k, names]) => [k, names.some((n) => eventNames.has(n))]),
  ) as Record<keyof typeof CONVERSION_EVENTS, boolean>;

  const eventCount = (key: ChannelKey, names: readonly string[]) =>
    ga4.channelEvents
      .filter((e) => names.includes(e.eventName) && classifyChannel(e.source, e.medium, e.channelGroup) === key)
      .reduce((a, e) => a + e.count, 0);

  const adByChannel: Partial<Record<ChannelKey, number>> = {
    instagram_paid: ads.byChannel.instagram_paid,
  };
  // Google広告の費用は Google Organic ではないので、ここでは Other の有料分として扱わない（表示のみ全体合計へ）

  for (const r of rows.values()) {
    if (trackedEvents.signup) r.signups = eventCount(r.key, CONVERSION_EVENTS.signup);
    if (trackedEvents.urlAdd) r.urlAdds = eventCount(r.key, CONVERSION_EVENTS.urlAdd);
    if (trackedEvents.ai) r.aiRuns = eventCount(r.key, CONVERSION_EVENTS.ai);
    if (trackedEvents.purchase) r.purchases = eventCount(r.key, CONVERSION_EVENTS.purchase);
    r.cvr = r.signups !== null ? ratio(r.signups, r.sessions) : null;
    const spend = adByChannel[r.key];
    if (ads.hasData && spend !== undefined) {
      r.adSpend = spend;
      r.cac = r.purchases ? Math.round(spend / r.purchases) : null;
    }
  }
  return {
    rows: [...rows.values()],
    trackedEvents,
    unmatched: unmatched.sort((a, b) => b.sessions - a.sessions).slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// ファネル
// ---------------------------------------------------------------------------

export type FunnelStep = {
  key: string;
  label: string;
  source: "GA4" | "WEBRIS DB";
  basis: string;
  metric: Metric;
};

export type FunnelRow = FunnelStep & {
  value: number | null;
  fromPrev: number | null; // 前の「計測済み」ステップからの通過率
  fromTop: number | null;
  dropCount: number | null;
  dropRate: number | null;
  prevLabel: string | null;
};

export const FUNNEL_ADVICE: Record<string, string> = {
  "visit>lp": "広告・検索の着地先がLP以外に分散していないか確認し、主要な流入をLPへ集約する",
  "lp>cta": "ファーストビューの訴求とCTAボタンの位置・文言を見直す（ヒートマップでクリック位置を確認）",
  "cta>signup": "登録フォームの項目数を減らし、Googleログインを目立たせる",
  "lp>signup": "LPのCTAの視認性と、無料で始められることの明示を強化する",
  "visit>signup": "LPのCTAの視認性と、無料で始められることの明示を強化する",
  "signup>login": "登録完了メールからのログイン導線と、初回ログインの案内を見直す",
  "signup>url": "登録直後にURL入力へ自動遷移させ、URL登録フォームを1項目に簡略化する",
  "login>url": "初回ログイン時にURL登録を最初のステップとして案内する",
  "url>analysis": "URL登録後に自動で初回診断を走らせ、診断中の進捗を表示する",
  "analysis>seo": "診断完了をメール/画面で通知し、SEO分析画面へのリンクを置く",
  "analysis>ai": "診断結果の画面に「AIで改善案を出す」ボタンを目立たせる",
  "seo>ai": "SEO分析画面からAI改善提案を1クリックで実行できるようにする",
  "ai>report": "AI分析の結果をレポートとしてまとめて見せる導線を追加する",
  "ai>paid": "AI分析の上限到達時に有料プランの価値を具体的に提示する",
  "report>pricing": "レポート内で有料プランで見られる追加分析を予告する",
  "pricing>checkout": "料金ページのプラン比較を簡潔にし、推奨プランを明示する",
  "checkout>paid": "決済画面の離脱理由を確認し、支払い方法・トライアル条件を見直す",
  "pricing>paid": "料金ページのプラン比較を簡潔にし、推奨プランを明示する",
};

function sumPageUsers(ga4: Ga4Data, match: (path: string) => boolean) {
  return ga4.pages.filter((pg) => match(pg.path)).reduce((a, pg) => a + pg.users, 0);
}

function eventUsers(ga4: Ga4Data, names: string[]): number | null {
  const rows = ga4.events.filter((e) => names.includes(e.name));
  if (rows.length === 0) return null;
  return rows.reduce((a, e) => Math.max(a, e.users), 0);
}

export function buildFunnel(p: WebrisAnalyticsPayload): { rows: FunnelRow[]; worst: FunnelRow | null } {
  const ga4 = sectionData(p.ga4);
  const product = sectionData(p.product);
  const gaMetric = (fn: (d: Ga4Data) => number | null, unmeasuredReason: string): Metric => {
    if (!ga4) return unavailable(p.ga4, "GA4未連携");
    const v = fn(ga4);
    return v === null ? { kind: "unmeasured", reason: unmeasuredReason } : { kind: "value", value: v, prev: null };
  };
  const dbMetric = (fn: (d: ProductData) => number): Metric =>
    product ? { kind: "value", value: fn(product), prev: null } : unavailable(p.product, "WEBRIS DB未取得");
  const isLp = (path: string) => path === "/" || path === "/en" || path === "/en/" || path.startsWith("/lp");

  const steps: FunnelStep[] = [
    { key: "visit", label: "訪問", source: "GA4", basis: "期間のアクティブユーザー", metric: gaMetric((d) => d.current.activeUsers, "") },
    { key: "lp", label: "LP閲覧", source: "GA4", basis: "トップ・LPページのユーザー数（ページ別合計）", metric: gaMetric((d) => sumPageUsers(d, isLp), "") },
    { key: "cta", label: "CTAクリック", source: "GA4", basis: "cta_click イベントのユーザー数", metric: gaMetric((d) => eventUsers(d, ["cta_click"]), "GA4に cta_click イベントが送られていません") },
    { key: "signup", label: "無料登録", source: "WEBRIS DB", basis: "期間内に作成された企業アカウント", metric: dbMetric((d) => d.cohort.signups) },
    { key: "login", label: "ログイン", source: "GA4", basis: "login イベントのユーザー数", metric: gaMetric((d) => eventUsers(d, ["login"]), "GA4に login イベントが送られていません") },
    { key: "url", label: "URL登録", source: "WEBRIS DB", basis: "上記の新規アカウントのうちURL登録済み", metric: dbMetric((d) => d.cohort.urlAdded) },
    { key: "analysis", label: "サイト分析開始", source: "WEBRIS DB", basis: "上記の新規アカウントのうち診断実行済み", metric: dbMetric((d) => d.cohort.analyzed) },
    { key: "seo", label: "SEO分析閲覧", source: "GA4", basis: "/dashboard/seo を見たユーザー数", metric: gaMetric((d) => sumPageUsers(d, (x) => x.startsWith("/dashboard/seo")), "") },
    { key: "ai", label: "AI分析実行", source: "WEBRIS DB", basis: "上記の新規アカウントのうちAI機能を利用", metric: dbMetric((d) => d.cohort.aiUsed) },
    { key: "report", label: "レポート閲覧", source: "GA4", basis: "/dashboard/reports を見たユーザー数", metric: gaMetric((d) => sumPageUsers(d, (x) => x.startsWith("/dashboard/reports")), "") },
    { key: "pricing", label: "有料プランページ閲覧", source: "GA4", basis: "料金・請求ページを見たユーザー数", metric: gaMetric((d) => sumPageUsers(d, (x) => /^\/(pricing|plans?|dashboard\/billing)(\/|$)/.test(x)), "") },
    { key: "checkout", label: "決済開始", source: "GA4", basis: "begin_checkout / checkout_start のユーザー数", metric: gaMetric((d) => eventUsers(d, ["begin_checkout", "checkout_start"]), "GA4に決済開始イベントが送られていません") },
    { key: "paid", label: "有料契約", source: "WEBRIS DB", basis: "上記の新規アカウントのうち現在有料", metric: dbMetric((d) => d.cohort.paid) },
  ];

  const rows: FunnelRow[] = [];
  let top: number | null = null;
  let prevMeasured: FunnelRow | null = null;
  for (const s of steps) {
    const v = s.metric.kind === "value" ? s.metric.value : null;
    if (v !== null && top === null) top = v;
    const prevVal = prevMeasured?.value ?? null;
    const row: FunnelRow = {
      ...s,
      value: v,
      fromPrev: v !== null && prevVal !== null ? ratio(v, prevVal) : null,
      fromTop: v !== null && top !== null ? ratio(v, top) : null,
      dropCount: v !== null && prevVal !== null ? Math.max(prevVal - v, 0) : null,
      dropRate: v !== null && prevVal !== null && prevVal > 0 ? Math.max(1 - v / prevVal, 0) : null,
      prevLabel: v !== null ? (prevMeasured?.label ?? null) : null,
    };
    rows.push(row);
    if (v !== null) prevMeasured = row;
  }

  // 最大離脱：前段が数人しかいないステップの率は1人の差で大きく振れるため、
  // 前段が MIN_BASE 人以上のステップを優先して判定する（該当が無ければ全体から）。
  const MIN_BASE = 3;
  const dropping = rows.filter((r) => r.dropRate !== null && r.dropRate > 0);
  const reliable = dropping.filter((r) => (r.dropCount ?? 0) + (r.value ?? 0) >= MIN_BASE);
  const pool = reliable.length ? reliable : dropping;
  const worst = pool.sort((a, b) => b.dropRate! - a.dropRate! || b.dropCount! - a.dropCount!)[0] ?? null;
  return { rows, worst };
}

export function funnelAdviceKey(rows: FunnelRow[], row: FunnelRow) {
  const prev = rows.find((r) => r.label === row.prevLabel);
  return prev ? `${prev.key}>${row.key}` : row.key;
}

// ---------------------------------------------------------------------------
// ページ
// ---------------------------------------------------------------------------

export type PageRow = {
  path: string;
  title: string;
  views: number;
  users: number | null;
  newUsers: number | null;
  avgEngagementSec: number | null;
  engagementRate: number | null;
  bounceRate: number | null;
  entrances: number | null;
  exits: null; // GA4 Data API に出口数が無いため常に未計測
  conversions: number | null;
  cvr: number | null;
  prevViews: number | null;
  source: "GA4" | "WEBRISタグ";
};

export function buildPages(p: WebrisAnalyticsPayload): { rows: PageRow[]; source: "GA4" | "WEBRISタグ" | null } {
  const ga4 = sectionData(p.ga4);
  if (ga4) {
    const landing = new Map(ga4.landingPages.map((l) => [l.path, l.sessions]));
    return {
      source: "GA4",
      rows: ga4.pages.map((pg) => ({
        path: pg.path,
        title: pg.title,
        views: pg.views,
        users: pg.users,
        newUsers: pg.newUsers,
        avgEngagementSec: pg.avgEngagementSec,
        engagementRate: pg.engagementRate,
        bounceRate: pg.bounceRate,
        entrances: landing.get(pg.path) ?? 0,
        exits: null,
        conversions: pg.keyEvents,
        cvr: ratio(pg.keyEvents, pg.users),
        prevViews: pg.prevViews,
        source: "GA4",
      })),
    };
  }
  const fp = sectionData(p.firstParty);
  if (fp) {
    return {
      source: "WEBRISタグ",
      rows: fp.pages.map((pg) => ({
        path: pg.page,
        title: pg.title,
        views: pg.views,
        users: null,
        newUsers: null,
        avgEngagementSec: null,
        engagementRate: null,
        bounceRate: null,
        entrances: null,
        exits: null,
        conversions: null,
        cvr: null,
        prevViews: null,
        source: "WEBRISタグ",
      })),
    };
  }
  return { source: null, rows: [] };
}

export type NotFoundRow = { path: string; title: string; referrer: string | null; views: number; lastSeen: string | null };

const NOT_FOUND_TITLE = /404|見つかりません|not found/i;

/** 404の表示。GA4 があれば参照元・時刻付き、無ければ WEBRIS タグのページタイトルから検出する。 */
export function buildNotFound(p: WebrisAnalyticsPayload): { rows: NotFoundRow[]; source: "GA4" | "WEBRISタグ" | null } {
  const ga4 = sectionData(p.ga4);
  if (ga4) return { source: "GA4", rows: ga4.notFound };
  const fp = sectionData(p.firstParty);
  if (fp) {
    return {
      source: "WEBRISタグ",
      rows: fp.pages
        .filter((pg) => NOT_FOUND_TITLE.test(pg.title))
        .map((pg) => ({ path: pg.page, title: pg.title, referrer: null, views: pg.views, lastSeen: null })),
    };
  }
  return { source: null, rows: [] };
}

export const PAGE_RANKINGS = [
  { key: "pv", label: "PV TOP" },
  { key: "users", label: "ユーザー数 TOP" },
  { key: "engagement", label: "滞在時間 TOP" },
  { key: "bounce", label: "直帰率が高い" },
  { key: "cv", label: "CV貢献" },
  { key: "revenue", label: "収益貢献" },
] as const;
export type PageRanking = (typeof PAGE_RANKINGS)[number]["key"];

export function rankPages(rows: PageRow[], ranking: PageRanking): { rows: PageRow[]; unavailable?: string } {
  const by = (fn: (r: PageRow) => number | null) =>
    [...rows].filter((r) => fn(r) !== null).sort((a, b) => fn(b)! - fn(a)! || b.views - a.views);
  switch (ranking) {
    case "pv":
      return { rows: by((r) => r.views) };
    case "users":
      return rows.some((r) => r.users !== null) ? { rows: by((r) => r.users) } : { rows: [], unavailable: "ユーザー数はGA4連携時のみ表示できます" };
    case "engagement":
      return rows.some((r) => r.avgEngagementSec !== null) ? { rows: by((r) => r.avgEngagementSec) } : { rows: [], unavailable: "滞在時間はGA4連携時のみ表示できます" };
    case "bounce":
      // PVが極端に少ないページの100%は意味がないので2PV以上に限る
      return rows.some((r) => r.bounceRate !== null)
        ? { rows: by((r) => (r.views >= 2 ? r.bounceRate : null)) }
        : { rows: [], unavailable: "直帰率はGA4連携時のみ表示できます" };
    case "cv":
      return rows.some((r) => r.conversions !== null)
        ? { rows: by((r) => (r.conversions ? r.conversions : null)) }
        : { rows: [], unavailable: "CVはGA4連携時のみ表示できます" };
    case "revenue":
      return {
        rows: [],
        unavailable:
          "ページ別の売上は未計測です。GA4に purchase イベント（value付き）を送るか、登録時の流入ページをWEBRISに保存すると計測できます。",
      };
  }
}

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

export type RankTrend = "up" | "down" | "flat" | "new";
export const RANK_TREND_LABEL: Record<RankTrend, string> = { up: "上昇", down: "下降", flat: "維持", new: "新規" };

export function rankTrend(q: GscQuery): { trend: RankTrend; delta: number | null } {
  if (q.prevPosition === null) return { trend: "new", delta: null };
  const delta = q.prevPosition - q.position; // 正 = 順位が上がった
  if (Math.abs(delta) < 1) return { trend: "flat", delta };
  return { trend: delta > 0 ? "up" : "down", delta };
}

export function buildSeo(gsc: GscData) {
  const withTrend = gsc.queries.map((q) => ({ ...q, ...rankTrend(q) }));
  const counts = { up: 0, down: 0, flat: 0, new: 0 } as Record<RankTrend, number>;
  for (const q of withTrend) counts[q.trend] += 1;
  const bigDrops = withTrend
    .filter((q) => q.delta !== null && q.delta <= -3 && q.impressions + q.prevImpressions >= 3)
    .sort((a, b) => a.delta! - b.delta!)
    .slice(0, 10);
  // 4〜20位で表示回数があるもの：少しの改善でクリックが増える余地
  const opportunities = withTrend
    .filter((q) => q.position > 3 && q.position <= 20 && q.impressions >= 1)
    .sort((a, b) => b.impressions - a.impressions || a.position - b.position)
    .slice(0, 10);
  return {
    queries: withTrend,
    counts,
    keywordCount: gsc.queries.length,
    top10: gsc.queries.filter((q) => q.position <= 10).length,
    top3: gsc.queries.filter((q) => q.position <= 3).length,
    bigDrops,
    opportunities,
  };
}

// ---------------------------------------------------------------------------
// イベント
// ---------------------------------------------------------------------------

/**
 * 追跡対象イベントの定義。新しいイベントはここに1行足すだけで表に出る。
 * ga4: GA4 上のイベント名（別名も可）／db: WEBRIS DB から数えられる場合の対応値
 */
export const EVENT_REGISTRY: { name: string; label: string; ga4: string[]; db?: (d: ProductData) => { cur: number; prev: number } }[] = [
  { name: "page_view", label: "ページ表示", ga4: ["page_view"] },
  { name: "session_start", label: "セッション開始", ga4: ["session_start"] },
  { name: "scroll", label: "スクロール(90%)", ga4: ["scroll"] },
  { name: "click", label: "外部リンククリック", ga4: ["click"] },
  { name: "cta_click", label: "CTAクリック", ga4: ["cta_click"] },
  { name: "signup_start", label: "登録開始", ga4: ["signup_start"] },
  { name: "signup_complete", label: "登録完了", ga4: ["signup_complete", "sign_up"], db: (d) => ({ cur: d.current.signups, prev: d.previous.signups }) },
  { name: "login", label: "ログイン", ga4: ["login"] },
  { name: "url_add", label: "URL登録", ga4: ["url_add"], db: (d) => ({ cur: d.current.urlAdds, prev: d.previous.urlAdds }) },
  { name: "analysis_start", label: "分析開始", ga4: ["analysis_start"] },
  { name: "analysis_complete", label: "分析完了", ga4: ["analysis_complete"], db: (d) => ({ cur: d.current.analyses, prev: d.previous.analyses }) },
  { name: "report_view", label: "レポート閲覧", ga4: ["report_view"] },
  { name: "ai_analysis_start", label: "AI分析開始", ga4: ["ai_analysis_start"] },
  { name: "ai_analysis_complete", label: "AI分析完了", ga4: ["ai_analysis_complete"], db: (d) => ({ cur: d.current.aiRuns, prev: d.previous.aiRuns }) },
  { name: "pricing_view", label: "料金ページ閲覧", ga4: ["pricing_view"] },
  { name: "checkout_start", label: "決済開始", ga4: ["checkout_start", "begin_checkout"] },
  { name: "purchase", label: "購入", ga4: ["purchase"] },
  { name: "subscription_start", label: "サブスク開始", ga4: ["subscription_start"], db: (d) => ({ cur: d.current.paidStarts, prev: d.previous.paidStarts }) },
  { name: "subscription_cancel", label: "サブスク解約", ga4: ["subscription_cancel"], db: (d) => ({ cur: d.current.cancels, prev: d.previous.cancels }) },
];

export type EventRow = {
  name: string;
  label: string;
  registered: boolean;
  ga4: { count: number; users: number; prevCount: number } | null;
  db: { cur: number; prev: number } | null;
  rate: number | null; // ユーザー数 ÷ アクティブユーザー
  fromPrev: number | null; // 直前の（計測済み）登録イベントからの遷移率（ユーザー数ベース）
};

export function buildEvents(p: WebrisAnalyticsPayload): EventRow[] {
  const ga4 = sectionData(p.ga4);
  const product = sectionData(p.product);
  const byName = new Map((ga4?.events ?? []).map((e) => [e.name, e]));
  const used = new Set<string>();
  const rows: EventRow[] = [];
  let prevUsers: number | null = null;
  for (const def of EVENT_REGISTRY) {
    const hits = def.ga4.map((n) => byName.get(n)).filter((e): e is NonNullable<typeof e> => !!e);
    def.ga4.forEach((n) => used.add(n));
    const g = hits.length
      ? { count: hits.reduce((a, e) => a + e.count, 0), users: Math.max(...hits.map((e) => e.users)), prevCount: hits.reduce((a, e) => a + e.prevCount, 0) }
      : null;
    const funnelEvent = !["page_view", "session_start", "scroll", "click"].includes(def.name);
    const row: EventRow = {
      name: def.name,
      label: def.label,
      registered: true,
      ga4: g,
      db: def.db && product ? def.db(product) : null,
      rate: g && ga4 ? ratio(g.users, ga4.current.activeUsers) : null,
      fromPrev: funnelEvent && g && prevUsers !== null ? ratio(g.users, prevUsers) : null,
    };
    if (funnelEvent && g) prevUsers = g.users;
    rows.push(row);
  }
  // 定義に無いがGA4に届いているイベント（将来追加分・自動収集分）
  for (const e of ga4?.events ?? []) {
    if (used.has(e.name)) continue;
    rows.push({
      name: e.name,
      label: "（未定義）",
      registered: false,
      ga4: { count: e.count, users: e.users, prevCount: e.prevCount },
      db: null,
      rate: ratio(e.users, ga4!.current.activeUsers),
      fromPrev: null,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// アラート・改善ポイント
// ---------------------------------------------------------------------------

export type Alert = { level: "critical" | "warning" | "info"; title: string; detail: string; tab?: string };

function pctText(p: number) {
  return `${p >= 0 ? "+" : ""}${Math.round(p * 100)}%`;
}

export function buildAlerts(p: WebrisAnalyticsPayload, ads: AdSpendSummary, adsPrev: AdSpendSummary): Alert[] {
  const alerts: Alert[] = [];
  const ga4 = sectionData(p.ga4);
  const gsc = sectionData(p.gsc);
  const product = sectionData(p.product);

  // データ取得の問題（数値の異常と混同しないよう先に出す）
  const sections: [string, Section<unknown>, string][] = [
    ["GA4", p.ga4, "overview"],
    ["Search Console", p.gsc, "seo"],
    ["Stripe（売上）", p.revenue, "overview"],
    ["WEBRIS DB", p.product, "overview"],
  ];
  for (const [name, s, tab] of sections) {
    if (s.status === "error") alerts.push({ level: "critical", title: `${name}: データ取得エラー`, detail: s.message, tab });
  }
  if (ga4?.partialErrors.length) {
    alerts.push({ level: "info", title: "GA4の一部レポートを取得できませんでした", detail: ga4.partialErrors.join(" / ").slice(0, 300) });
  }

  if (ga4) {
    const { sessions } = ga4.current;
    const prevSessions = ga4.previous.sessions;
    const c = change(sessions, prevSessions);
    if (c?.pct !== null && c && prevSessions >= 20) {
      if (c.pct >= 1) alerts.push({ level: "info", title: "アクセス急増", detail: `セッションが前期間比 ${pctText(c.pct)}（${prevSessions} → ${sessions}）`, tab: "acquisition" });
      if (c.pct <= -0.4) alerts.push({ level: "warning", title: "アクセス急減", detail: `セッションが前期間比 ${pctText(c.pct)}（${prevSessions} → ${sessions}）`, tab: "acquisition" });
    }
    if (product && sessions >= 50 && prevSessions >= 50) {
      const cur = product.current.signups / sessions;
      const prev = product.previous.signups / prevSessions;
      if (prev > 0 && cur / prev - 1 <= -0.3) {
        alerts.push({ level: "warning", title: "CVR低下", detail: `登録CVR ${(prev * 100).toFixed(2)}% → ${(cur * 100).toFixed(2)}%`, tab: "funnel" });
      }
    }
    if (ga4.current.activeUsers < SMALL_SAMPLE) {
      alerts.push({
        level: "info",
        title: "サンプル数が少ない期間です",
        detail: `アクティブユーザー ${ga4.current.activeUsers}人。増減率や順位は偶然の変動が大きく、統計的な傾向とは言えません。`,
      });
    }
  }

  const notFound = buildNotFound(p).rows;
  const nf = notFound.reduce((a, r) => a + r.views, 0);
  if (nf > 0) {
    alerts.push({
      level: nf >= 10 ? "warning" : "info",
      title: `404ページの表示 ${nf}件`,
      detail: `存在しないURLへのアクセスがあります（${notFound.slice(0, 3).map((r) => r.path).join(", ")}）`,
      tab: "pages",
    });
  }

  if (ads.hasData && adsPrev.hasData && adsPrev.totalJpy > 0) {
    const c = ads.totalJpy / adsPrev.totalJpy - 1;
    if (c >= 0.5) alerts.push({ level: "warning", title: "広告費急増", detail: `前期間比 ${pctText(c)}（¥${adsPrev.totalJpy.toLocaleString("ja-JP")} → ¥${ads.totalJpy.toLocaleString("ja-JP")}）`, tab: "acquisition" });
    if (product && product.current.paidStarts > 0 && product.previous.paidStarts > 0) {
      const cac = ads.totalJpy / product.current.paidStarts;
      const prevCac = adsPrev.totalJpy / product.previous.paidStarts;
      if (cac / prevCac - 1 >= 0.3) alerts.push({ level: "warning", title: "CPA（CAC）悪化", detail: `¥${Math.round(prevCac).toLocaleString("ja-JP")} → ¥${Math.round(cac).toLocaleString("ja-JP")}`, tab: "acquisition" });
    }
  }

  if (gsc) {
    const seo = buildSeo(gsc);
    const severe = seo.bigDrops.filter((q) => (q.delta ?? 0) <= -5);
    if (severe.length) {
      alerts.push({
        level: severe.some((q) => (q.prevPosition ?? 99) <= 10 && q.position > 10) ? "critical" : "warning",
        title: `SEO順位急落 ${severe.length}キーワード`,
        detail: severe.slice(0, 3).map((q) => `「${q.query}」${q.prevPosition?.toFixed(1)}位→${q.position.toFixed(1)}位`).join(" / "),
        tab: "seo",
      });
    }
  }

  if (product) {
    const f = product.failedAnalyses;
    if (f.current >= 3 && f.current > f.previous * 1.5) {
      alerts.push({ level: "warning", title: "分析エラー増加", detail: `ページを取得できなかった診断が ${f.previous} → ${f.current}件`, tab: "events" });
    }
    if (product.current.cancels > product.current.paidStarts && product.current.cancels > 0) {
      alerts.push({ level: "warning", title: "有料アカウントが純減", detail: `新規有料化 ${product.current.paidStarts}件 / 解約 ${product.current.cancels}件`, tab: "users" });
    }
    if (product.previous.paidStarts >= 2 && product.current.paidStarts <= product.previous.paidStarts / 2) {
      alerts.push({ level: "warning", title: "課金数急減", detail: `新規有料化 ${product.previous.paidStarts} → ${product.current.paidStarts}件`, tab: "funnel" });
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

export type Improvement = { priority: "高" | "中" | "低"; title: string; reason: string; tab?: string };

export function buildImprovements(p: WebrisAnalyticsPayload, ads: AdSpendSummary): Improvement[] {
  const out: Improvement[] = [];
  const ga4 = sectionData(p.ga4);
  const gsc = sectionData(p.gsc);
  const funnel = buildFunnel(p);

  const connect: [Section<unknown>, string, string][] = [
    [p.ga4, "GA4", "流入・ページ・ファネル前半"],
    [p.gsc, "Search Console", "SEOの順位・クリック"],
  ];
  for (const [s, name, what] of connect) {
    if (s.status === "ok") continue;
    out.push(
      s.status === "error"
        ? { priority: "高", title: `${name}のデータ取得エラーを解消する`, reason: `${what}が表示できていません（${s.message}）`, tab: name === "GA4" ? "overview" : "seo" }
        : { priority: "高", title: `WEBRIS自身の${name}をWEBRIS上で連携する`, reason: `${what}が計測できていません（${s.message}）`, tab: name === "GA4" ? "overview" : "seo" },
    );
  }
  if (funnel.worst) {
    const key = funnelAdviceKey(funnel.rows, funnel.worst);
    out.push({
      priority: "高",
      title: FUNNEL_ADVICE[key] ?? `「${funnel.worst.prevLabel} → ${funnel.worst.label}」の離脱を減らす`,
      reason: `最大離脱：${funnel.worst.prevLabel} → ${funnel.worst.label}（離脱率 ${Math.round((funnel.worst.dropRate ?? 0) * 100)}%、${funnel.worst.dropCount}人）`,
      tab: "funnel",
    });
  }
  if (ga4) {
    const channels = buildChannels(ga4, ads);
    const missing = Object.entries(channels.trackedEvents).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) {
      out.push({
        priority: "中",
        title: "WEBRISにGA4コンバージョンイベントを実装する",
        reason: `sign_up / url_add / ai_analysis_complete / purchase などがGA4に届いていないため、流入元別の登録・課金が分かりません（未計測: ${missing.length}種類）`,
        tab: "events",
      });
    }
  }
  const nf = buildNotFound(p).rows;
  if (nf.length) {
    out.push({ priority: "中", title: "404になっているURLをリダイレクトする", reason: `${nf.slice(0, 3).map((r) => r.path).join(", ")} などに合計${nf.reduce((a, r) => a + r.views, 0)}回アクセスがあります`, tab: "pages" });
  }
  if (gsc) {
    const seo = buildSeo(gsc);
    const opp = seo.opportunities[0];
    if (opp) {
      out.push({ priority: "中", title: `「${opp.query}」のページを強化する`, reason: `${opp.position.toFixed(1)}位・表示${opp.impressions}回。上位表示でクリック増が見込めます`, tab: "seo" });
    }
  }
  if (!ads.hasData) {
    out.push({ priority: "低", title: "Instagram広告の費用を入力する", reason: "広告費が無いとCAC・ROASが計算できません", tab: "acquisition" });
  }
  return out.slice(0, 6);
}

// ---------------------------------------------------------------------------
// 売上系の補助
// ---------------------------------------------------------------------------

export function roas(revenue: RevenueData | null, ads: AdSpendSummary): number | null {
  if (!revenue || !ads.hasData || ads.totalJpy === 0) return null;
  return revenue.current.revenueJpy / ads.totalJpy;
}
