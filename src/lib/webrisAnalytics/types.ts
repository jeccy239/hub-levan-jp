// WEBRIS の GET /api/levanhub/analytics の応答型。
// 実装は webris.levan.jp リポジトリの src/lib/levanhub/business-analytics.ts。
// 仕様は docs/webris-dashboard.md。

export type SectionStatus = "ok" | "not_connected" | "not_configured" | "error";

export type Section<T> =
  | { status: "ok"; data: T }
  | { status: Exclude<SectionStatus, "ok">; message: string };

export type DateRange = { start: string; end: string };

export type ProductPeriod = {
  signups: number;
  managerSignups: number;
  urlAdds: number;
  analyses: number;
  analyzedAccounts: number;
  aiRuns: number;
  aiAccounts: number;
  aiBreakdown: { insights: number; articles: number; improvements: number; aioChecks: number; brandChecks: number; aioScores: number };
  reports: number;
  paidStarts: number;
  cancels: number;
  planChanges: number;
  gscConnects: number;
  ga4Connects: number;
};

export type AccountRow = {
  id: string;
  createdAt: string;
  planCode: string;
  planName: string;
  monthlyPriceJpy: number;
  subscriptionStatus: string | null;
  isPaid: boolean;
  sites: number;
  firstUrlAt: string | null;
  audits: number;
  lastAuditAt: string | null;
  aiRuns: number;
  lastAiAt: string | null;
  reports: number;
  gscConnected: boolean;
  ga4Connected: boolean;
  members: number;
  lastActivityAt: string | null;
  paidSince: string | null;
};

export type ProductData = {
  current: ProductPeriod;
  previous: ProductPeriod;
  daily: { date: string; signups: number; urlAdds: number; analyses: number; aiRuns: number; paidStarts: number }[];
  totals: {
    companies: number;
    managers: number;
    paying: number;
    mrrJpy: number;
    byPlan: { code: string; name: string; priceJpy: number; accounts: number; paying: number }[];
  };
  cohort: { signups: number; urlAdded: number; analyzed: number; aiUsed: number; reported: number; paid: number };
  failedAnalyses: { current: number; previous: number };
  /** 今日（JST）の件数。WEBRIS側で取得に失敗した場合は null */
  today: { signups: number; urlAdds: number; analyses: number; aiRuns: number } | null;
  accounts: AccountRow[];
  excludedSelfAccounts: number;
};

export type RevenueTotals = { revenueJpy: number; invoices: number; customers: number };
export type RevenueData = {
  current: RevenueTotals;
  previous: RevenueTotals;
  daily: { date: string; revenueJpy: number }[];
  truncated: boolean;
};

export type Ga4Totals = {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  engagedSessions: number;
  pageViews: number;
  eventCount: number;
  keyEvents: number;
  avgEngagementSec: number;
  engagementRate: number;
  bounceRate: number;
};

export type Ga4Channel = {
  source: string;
  medium: string;
  channelGroup: string;
  users: number;
  newUsers: number;
  sessions: number;
  engagedSessions: number;
  keyEvents: number;
  prevUsers: number;
  prevSessions: number;
};

export type Ga4Page = {
  path: string;
  title: string;
  views: number;
  users: number;
  newUsers: number;
  avgEngagementSec: number;
  engagementRate: number;
  bounceRate: number;
  keyEvents: number;
  prevViews: number;
};

export type Ga4Data = {
  propertyId: string;
  current: Ga4Totals;
  previous: Ga4Totals;
  returning: { current: number | null; previous: number | null };
  daily: { date: string; activeUsers: number; newUsers: number; sessions: number; pageViews: number }[];
  channels: Ga4Channel[];
  firstUserChannels: { source: string; medium: string; channelGroup: string; users: number }[];
  channelEvents: { source: string; medium: string; channelGroup: string; eventName: string; count: number; users: number }[];
  pages: Ga4Page[];
  landingPages: { path: string; sessions: number; users: number; keyEvents: number; bounceRate: number }[];
  events: { name: string; count: number; users: number; prevCount: number; prevUsers: number }[];
  cities: { city: string; users: number }[];
  notFound: { path: string; title: string; referrer: string; views: number; lastSeen: string }[];
  realtime: { activeUsers30m: number; activeUsers5m: number; pages: { page: string; users: number }[] } | null;
  today: { activeUsers: number; pageViews: number; sessions: number } | null;
  partialErrors: string[];
};

export type GscTotals = { clicks: number; impressions: number; ctr: number; position: number };
export type GscQuery = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  prevPosition: number | null;
  prevClicks: number;
  prevImpressions: number;
};
export type GscData = {
  siteProperty: string;
  current: GscTotals;
  previous: GscTotals;
  daily: ({ date: string } & GscTotals)[];
  queries: GscQuery[];
  lostQueries: { query: string; prevPosition: number; prevClicks: number; prevImpressions: number }[];
  pages: { page: string; clicks: number; impressions: number; ctr: number; position: number; prevClicks: number }[];
  dataLagNote: string;
};

export type FirstPartyData = {
  current: { views: number; clicks: number };
  previous: { views: number; clicks: number };
  today: { views: number };
  last30m: { views: number };
  pages: { page: string; title: string; views: number; clicks: number; avgScrollDepth: number | null }[];
};

export type CompetitorData = {
  items: { name: string; url: string; pages: number; changes: number; prevChanges: number; lastChangeAt: string | null }[];
};

export type WebrisAnalyticsPayload = {
  generatedAt: string;
  today: string;
  range: DateRange;
  compare: DateRange;
  selfSite: { host: string; found: boolean };
  product: Section<ProductData>;
  revenue: Section<RevenueData>;
  ga4: Section<Ga4Data>;
  gsc: Section<GscData>;
  firstParty: Section<FirstPartyData>;
  competitors: Section<CompetitorData>;
};

/**
 * HUB が画面に渡す取得結果。WEBRIS 自体に届かなかった場合は payload が null で
 * error に理由が入る（この場合、全セクションを「取得エラー」として表示する）。
 */
export type DashboardFetch = {
  payload: WebrisAnalyticsPayload | null;
  error: string | null;
  fetchedAt: Date | null;
  fromCache: boolean;
  stale: boolean;
};

/**
 * 1つの数値の状態。0 と「取れなかった」を型で区別する。
 * - value: 実測値（0 を含む）
 * - unmeasured: 計測の仕組みが無い／未連携
 * - error: 取得を試みて失敗した
 */
export type Metric =
  | { kind: "value"; value: number; prev: number | null; series?: number[] }
  | { kind: "unmeasured"; reason: string }
  | { kind: "error"; reason: string };
