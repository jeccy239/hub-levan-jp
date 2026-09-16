import Link from "next/link";
import { listAdSpend, summarizeAdSpend } from "@/lib/webrisAnalytics/adsService";
import { getAiSummary } from "@/lib/webrisAnalytics/aiSummary";
import { fmtDateTime } from "@/lib/webrisAnalytics/format";
import { buildAlerts, sectionData } from "@/lib/webrisAnalytics/metrics";
import { COMPARE_MODES, RANGE_PRESETS, resolveRange } from "@/lib/webrisAnalytics/range";
import type { WebrisAnalyticsPayload } from "@/lib/webrisAnalytics/types";
import { getDashboardData } from "@/lib/webrisAnalytics/webrisService";
import { RefreshButton, type RangeParams } from "./controls";
import AcquisitionTab from "./tabs/AcquisitionTab";
import EventsTab from "./tabs/EventsTab";
import FunnelTab from "./tabs/FunnelTab";
import OverviewTab from "./tabs/OverviewTab";
import PagesTab from "./tabs/PagesTab";
import SeoTab from "./tabs/SeoTab";
import UsersTab from "./tabs/UsersTab";
import type { DashboardSearchParams } from "./tabs/context";
import { cardClass } from "./ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TABS = [
  { key: "overview", label: "概要" },
  { key: "acquisition", label: "流入元" },
  { key: "funnel", label: "ファネル" },
  { key: "pages", label: "ページ" },
  { key: "seo", label: "SEO" },
  { key: "events", label: "イベント" },
  { key: "users", label: "ユーザー" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** WEBRIS自体に届かなかったとき、全セクションを「取得エラー」にした応答を作る */
function unreachablePayload(message: string, today: string, range: WebrisAnalyticsPayload["range"], compare: WebrisAnalyticsPayload["compare"]): WebrisAnalyticsPayload {
  const err = { status: "error" as const, message };
  return {
    generatedAt: new Date().toISOString(),
    today,
    range,
    compare,
    selfSite: { host: "webris.levan.jp", found: false },
    product: err,
    revenue: err,
    ga4: err,
    gsc: err,
    firstParty: err,
    competitors: err,
  };
}

export default async function WebrisDashboardPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  const sp = await searchParams;
  const range = resolveRange(sp);
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "overview";

  const [data, ads, adsPrev, aiSummary, adEntries] = await Promise.all([
    getDashboardData(range),
    summarizeAdSpend(range.current),
    summarizeAdSpend(range.previous),
    getAiSummary(range),
    tab === "acquisition" ? listAdSpend() : Promise.resolve([]),
  ]);
  const payload = data.payload ?? unreachablePayload(data.error ?? "WEBRISのデータを取得できませんでした。", range.current.end, range.current, range.previous);
  const alerts = buildAlerts(payload, ads, adsPrev);
  const ga4 = sectionData(payload.ga4);
  const product = sectionData(payload.product);
  // WEBRISの提供開始前など、前年同期に計測値が1件も無い場合
  const noYoyData =
    range.compareMode === "yoy" &&
    (ga4 !== null || product !== null) &&
    (ga4 === null || (ga4.previous.activeUsers === 0 && ga4.previous.pageViews === 0)) &&
    (product === null || (product.previous.signups === 0 && product.previous.urlAdds === 0));

  const rangeParams: RangeParams = {
    range: range.preset,
    compare: range.compareMode,
    ...(range.preset === "custom" ? { from: range.current.start, to: range.current.end } : {}),
  };
  const href = (over: Partial<DashboardSearchParams>) => {
    const q = new URLSearchParams();
    const merged: DashboardSearchParams = { ...rangeParams, tab, ...over };
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === "") continue;
      if (k === "tab" && v === "overview") continue;
      if (k === "range" && v === "28d") continue;
      if (k === "compare" && v === "prev") continue;
      q.set(k, String(v));
    }
    const s = q.toString();
    return `/webris/dashboard${s ? `?${s}` : ""}`;
  };

  const ctx = { payload, range, ads, adsPrev, href, sp, rangeParams };
  const visibleAlerts = alerts.filter((a) => a.level !== "info" || tab === "overview");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">WEBRIS ダッシュボード</h1>
          <p className="text-[var(--text-dim)] mt-1 text-sm">
            集客・プロダクト利用・課金・SEOをまとめて、WEBRISの事業状態を判断するための画面です。
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <RefreshButton params={rangeParams} />
          <p className="text-[11px] text-[var(--text-dim)] tabular-nums">
            Last updated {data.fetchedAt ? fmtDateTime(data.fetchedAt) : "—"}
            {data.fromCache && !data.stale && "（キャッシュ）"}
          </p>
        </div>
      </header>

      {data.error && (
        <div className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger-tint)] px-5 py-3 text-sm text-[var(--text)]">
          <p className="font-medium">データ取得エラー</p>
          <p className="text-xs text-[var(--text-dim)] mt-0.5">
            {data.error}
            {data.stale && data.fetchedAt && ` 前回（${fmtDateTime(data.fetchedAt)}）に取得したデータを表示しています。`}
          </p>
        </div>
      )}

      {/* 期間・比較 */}
      <div className={`${cardClass} px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-3`}>
        <nav className="flex flex-wrap gap-1" aria-label="期間">
          {RANGE_PRESETS.filter((p) => p.value !== "custom").map((p) => (
            <Link
              key={p.value}
              href={href({ range: p.value, from: undefined, to: undefined, page: undefined })}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                range.preset === p.value ? "bg-[var(--text)] text-white" : "bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <form action="/webris/dashboard" className="flex flex-wrap items-center gap-1.5 text-xs">
          <input type="hidden" name="range" value="custom" />
          <input type="hidden" name="compare" value={range.compareMode} />
          {tab !== "overview" && <input type="hidden" name="tab" value={tab} />}
          <input
            type="date"
            name="from"
            defaultValue={range.current.start}
            aria-label="開始日"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs"
          />
          <span className="text-[var(--text-dim)]">〜</span>
          <input
            type="date"
            name="to"
            defaultValue={range.current.end}
            aria-label="終了日"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs"
          />
          <button
            type="submit"
            className={`px-3 py-1 rounded-full font-medium ${
              range.preset === "custom" ? "bg-[var(--text)] text-white" : "bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            カスタム
          </button>
        </form>
        <nav className="flex gap-1 md:ml-auto" aria-label="比較">
          {COMPARE_MODES.map((m) => (
            <Link
              key={m.value}
              href={href({ compare: m.value })}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                range.compareMode === m.value
                  ? "bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              {m.label}
            </Link>
          ))}
        </nav>
        <p className="basis-full text-[11px] text-[var(--text-dim)] tabular-nums">
          表示期間 {range.label}（{range.days}日間）　比較 {range.compareLabel}
          {noYoyData && <span className="ml-2 text-[var(--gold)]">前年同期のデータが無いため、増減は参考になりません（「新規」と表示されます）。</span>}
        </p>
      </div>

      {/* アラート */}
      {visibleAlerts.length > 0 && (
        <section aria-label="アラート" className="grid gap-2 xl:grid-cols-2">
          {visibleAlerts.slice(0, 8).map((a, i) => {
            const tone =
              a.level === "critical"
                ? "border-[var(--danger)]/40 bg-[var(--danger-tint)]"
                : a.level === "warning"
                  ? "border-[var(--gold)]/30 bg-[var(--gold-tint)]"
                  : "border-[var(--line)] bg-[var(--surface)]";
            const label = a.level === "critical" ? "重大" : a.level === "warning" ? "注意" : "情報";
            const body = (
              <>
                <span className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      a.level === "critical" ? "bg-[var(--danger)] text-white" : a.level === "warning" ? "bg-[var(--gold)] text-white" : "bg-[var(--surface-2)] text-[var(--text-dim)]"
                    }`}
                  >
                    {label}
                  </span>
                  <span className="text-sm font-medium text-[var(--text)]">{a.title}</span>
                </span>
                <span className="mt-0.5 block text-xs text-[var(--text-dim)] break-words">{a.detail}</span>
              </>
            );
            return a.tab && a.tab !== tab ? (
              <Link key={i} href={href({ tab: a.tab, page: undefined })} className={`block rounded-xl border px-4 py-2.5 hover:shadow-sm ${tone}`}>
                {body}
              </Link>
            ) : (
              <div key={i} className={`rounded-xl border px-4 py-2.5 ${tone}`}>
                {body}
              </div>
            );
          })}
        </section>
      )}

      {/* タブ */}
      <nav className="flex gap-1 overflow-x-auto border-b border-[var(--line)] -mx-4 px-4 sm:mx-0 sm:px-0" aria-label="ダッシュボードの表示切り替え">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={href({ tab: t.key, page: undefined, rank: undefined, kw: undefined, plan: undefined })}
            className={`px-3.5 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-[var(--accent)] text-[var(--text)]" : "border-transparent text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab {...ctx} aiSummary={aiSummary} dataFetchedAt={data.fetchedAt} />}
      {tab === "acquisition" && <AcquisitionTab {...ctx} adEntries={adEntries} />}
      {tab === "funnel" && <FunnelTab {...ctx} />}
      {tab === "pages" && <PagesTab {...ctx} />}
      {tab === "seo" && <SeoTab {...ctx} />}
      {tab === "events" && <EventsTab {...ctx} />}
      {tab === "users" && <UsersTab {...ctx} />}
    </div>
  );
}
