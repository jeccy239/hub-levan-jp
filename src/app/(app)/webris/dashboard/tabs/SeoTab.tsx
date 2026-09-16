import Link from "next/link";
import { DASH, fmtDate, fmtInt, fmtPct, fmtPosition } from "@/lib/webrisAnalytics/format";
import { buildChannels, buildSeo, RANK_TREND_LABEL, sectionData, type RankTrend } from "@/lib/webrisAnalytics/metrics";
import type { Metric } from "@/lib/webrisAnalytics/types";
import { DailyBars, EmptyRow, KpiCard, Pager, Panel, SectionNotice, SmallSampleNote, numClass, tdClass, thClass } from "../ui";
import { pageNumber, type TabContext } from "./context";

const PER_PAGE = 30;
const TREND_FILTERS: { key: RankTrend | "all"; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "up", label: "上昇" },
  { key: "down", label: "下降" },
  { key: "flat", label: "維持" },
  { key: "new", label: "新規" },
];
const TREND_STYLE: Record<RankTrend, string> = {
  up: "bg-[#e3f4e8] text-[#1b7f3b]",
  down: "bg-[var(--danger-tint)] text-[var(--danger)]",
  flat: "bg-[var(--surface-2)] text-[var(--text-dim)]",
  new: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
};

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

export default function SeoTab({ payload, ads, range, href, sp }: TabContext) {
  const gsc = sectionData(payload.gsc);
  const ga4 = sectionData(payload.ga4);
  const competitors = sectionData(payload.competitors);
  const organic = ga4 ? buildChannels(ga4, ads).rows.find((r) => r.key === "google_organic") ?? null : null;
  const seo = gsc ? buildSeo(gsc) : null;

  const m = (v: number | undefined, prev: number | undefined, section: "gsc" | "ga4", series?: number[]): Metric => {
    const s = section === "gsc" ? payload.gsc : payload.ga4;
    if (s.status !== "ok" || v === undefined) {
      return s.status === "error" ? { kind: "error", reason: s.message } : { kind: "unmeasured", reason: s.status === "ok" ? "" : s.message };
    }
    return { kind: "value", value: v, prev: prev ?? null, series };
  };
  const counts = (v: number | undefined): Metric => (seo && v !== undefined ? { kind: "value", value: v, prev: null } : m(undefined, undefined, "gsc"));
  const kpis = [
    { key: "ou", label: "Google Organicユーザー", format: "int" as const, source: "GA4", hint: "Google検索（自然検索）から来たユーザー", metric: m(organic?.users, organic?.prevUsers, "ga4") },
    { key: "os", label: "Organicセッション", format: "int" as const, source: "GA4", hint: "Google検索からのセッション", metric: m(organic?.sessions, organic?.prevSessions, "ga4") },
    { key: "cl", label: "検索クリック", format: "int" as const, source: "Search Console", hint: "Google検索結果でのクリック数", metric: m(gsc?.current.clicks, gsc?.previous.clicks, "gsc", gsc?.daily.map((d) => d.clicks)) },
    { key: "im", label: "インプレッション", format: "int" as const, source: "Search Console", hint: "検索結果に表示された回数", metric: m(gsc?.current.impressions, gsc?.previous.impressions, "gsc", gsc?.daily.map((d) => d.impressions)) },
    { key: "ctr", label: "CTR", format: "pct" as const, source: "Search Console", hint: "クリック ÷ 表示回数", metric: m(gsc?.current.ctr, gsc?.previous.ctr, "gsc") },
    {
      key: "pos",
      label: "平均掲載順位",
      format: "position" as const,
      source: "Search Console",
      hint: "小さいほど上位",
      lowerIsBetter: true,
      metric: m(gsc?.current.position || undefined, gsc?.previous.position || undefined, "gsc"),
    },
    { key: "kw", label: "検索キーワード数", format: "int" as const, source: "Search Console", hint: "表示回数が1回以上あったクエリ（上位1,000件まで）", metric: counts(seo?.keywordCount) },
    { key: "t10", label: "TOP10キーワード", format: "int" as const, source: "Search Console", hint: "平均順位10位以内", metric: counts(seo?.top10) },
    { key: "t3", label: "TOP3キーワード", format: "int" as const, source: "Search Console", hint: "平均順位3位以内", metric: counts(seo?.top3) },
    { key: "up", label: "順位上昇", format: "int" as const, source: "Search Console", hint: "前期間より1位以上上昇", metric: counts(seo?.counts.up) },
    { key: "down", label: "順位下降", format: "int" as const, source: "Search Console", hint: "前期間より1位以上下降", metric: counts(seo?.counts.down) },
    { key: "new", label: "新規流入キーワード", format: "int" as const, source: "Search Console", hint: "前期間に表示が無かったクエリ", metric: counts(seo?.counts.new) },
  ];

  const trend = (TREND_FILTERS.some((t) => t.key === sp.kw) ? sp.kw : "all") as RankTrend | "all";
  const filtered = seo ? (trend === "all" ? seo.queries : seo.queries.filter((q) => q.trend === trend)) : [];
  const sorted = [...filtered].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
  const pages = Math.max(Math.ceil(sorted.length / PER_PAGE), 1);
  const page = Math.min(pageNumber(sp.page), pages);
  const visible = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="space-y-5">
      {payload.gsc.status !== "ok" && <SectionNotice section={payload.gsc} name="Search Console" />}

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <KpiCard key={k.key} kpi={k} compareLabel={range.compareLabel} />
        ))}
      </section>

      {gsc && seo && (
        <>
          <Panel title="検索パフォーマンス（日次）" source="Search Console" description={gsc.dataLagNote}>
            <DailyBars
              rows={gsc.daily.map((d) => ({ date: d.date, values: [d.clicks] }))}
              series={[{ label: "クリック", color: "var(--accent)" }]}
            />
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="順位が大きく下落したキーワード" description="前期間から3位以上ダウン">
              <KeywordMiniTable rows={seo.bigDrops} empty="大きな下落はありません" />
            </Panel>
            <Panel title="順位上昇のチャンスがあるキーワード" description="4〜20位で表示回数があるもの（表示回数順）">
              <KeywordMiniTable rows={seo.opportunities} empty="該当するキーワードはありません" />
            </Panel>
          </div>

          <Panel
            title="キーワード"
            source="Search Console"
            description="検索ボリュームは外部キーワードツール未連携のため表示できません。URLはクリック（同数なら表示回数）が最も多いページ。"
          >
            <nav className="flex flex-wrap gap-1 mb-3" aria-label="順位変化で絞り込み">
              {TREND_FILTERS.map((t) => (
                <Link
                  key={t.key}
                  href={href({ kw: t.key === "all" ? undefined : t.key, page: undefined })}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    trend === t.key ? "bg-[var(--text)] text-white" : "bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]"
                  }`}
                >
                  {t.label}
                  <span className="ml-1 tabular-nums opacity-70">{t.key === "all" ? seo.keywordCount : seo.counts[t.key]}</span>
                </Link>
              ))}
            </nav>
            <div className="overflow-x-auto -mx-5">
              <table className="w-full min-w-[960px]">
                <thead className="border-b border-[var(--line)]">
                  <tr>
                    <th className={thClass}>キーワード</th>
                    <th className={`${thClass} text-right`}>検索順位</th>
                    <th className={`${thClass} text-right`}>前回順位</th>
                    <th className={`${thClass} text-right`}>順位変化</th>
                    <th className={`${thClass} text-right`}>検索ボリューム</th>
                    <th className={`${thClass} text-right`}>クリック数</th>
                    <th className={`${thClass} text-right`}>表示回数</th>
                    <th className={`${thClass} text-right`}>CTR</th>
                    <th className={thClass}>URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {visible.map((q) => (
                    <tr key={q.query}>
                      <td className={`${tdClass} max-w-[260px] truncate font-medium`} title={q.query}>
                        {q.query}
                      </td>
                      <td className={`${tdClass} ${numClass}`}>{fmtPosition(q.position)}</td>
                      <td className={`${tdClass} ${numClass} text-[var(--text-dim)]`}>{fmtPosition(q.prevPosition)}</td>
                      <td className={`${tdClass} ${numClass}`}>
                        <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TREND_STYLE[q.trend]}`}>
                          {RANK_TREND_LABEL[q.trend]}
                          {q.delta !== null && q.trend !== "flat" && ` ${q.delta > 0 ? "+" : "−"}${Math.abs(q.delta).toFixed(1)}`}
                        </span>
                      </td>
                      <td className={`${tdClass} ${numClass} text-[var(--text-dim)]`}>{DASH}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(q.clicks)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(q.impressions)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtPct(q.ctr)}</td>
                      <td className={`${tdClass} max-w-[240px] truncate text-[11px] text-[var(--text-dim)]`} title={q.page}>
                        {q.page ? shortUrl(q.page) : DASH}
                      </td>
                    </tr>
                  ))}
                  {visible.length === 0 && <EmptyRow colSpan={9}>該当するキーワードはありません</EmptyRow>}
                </tbody>
              </table>
            </div>
            <Pager page={page} pages={pages} hrefFor={(p) => href({ page: String(p) })} />
            <SmallSampleNote n={gsc.current.clicks} unit="クリック" />
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="検索流入のあるページ" source="Search Console">
              <div className="overflow-x-auto -mx-5">
                <table className="w-full min-w-[480px]">
                  <thead className="border-b border-[var(--line)]">
                    <tr>
                      <th className={thClass}>ページ</th>
                      <th className={`${thClass} text-right`}>クリック</th>
                      <th className={`${thClass} text-right`}>表示</th>
                      <th className={`${thClass} text-right`}>CTR</th>
                      <th className={`${thClass} text-right`}>順位</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {gsc.pages.slice(0, 15).map((p) => (
                      <tr key={p.page}>
                        <td className={`${tdClass} max-w-[240px] truncate`} title={p.page}>
                          {shortUrl(p.page)}
                        </td>
                        <td className={`${tdClass} ${numClass}`}>{fmtInt(p.clicks)}</td>
                        <td className={`${tdClass} ${numClass}`}>{fmtInt(p.impressions)}</td>
                        <td className={`${tdClass} ${numClass}`}>{fmtPct(p.ctr)}</td>
                        <td className={`${tdClass} ${numClass}`}>{fmtPosition(p.position)}</td>
                      </tr>
                    ))}
                    {gsc.pages.length === 0 && <EmptyRow colSpan={5}>データがありません</EmptyRow>}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="表示されなくなったキーワード" source="Search Console" description="前期間に表示があり、今期は表示0のもの">
              <ul className="divide-y divide-[var(--line)] text-[13px]">
                {gsc.lostQueries.slice(0, 12).map((q) => (
                  <li key={q.query} className="flex justify-between gap-3 py-1.5">
                    <span className="truncate">{q.query}</span>
                    <span className="shrink-0 tabular-nums text-[var(--text-dim)]">
                      前回 {fmtPosition(q.prevPosition)}位 / 表示{fmtInt(q.prevImpressions)}
                    </span>
                  </li>
                ))}
                {gsc.lostQueries.length === 0 && <li className="py-4 text-sm text-[var(--text-dim)]">ありません</li>}
              </ul>
            </Panel>
          </div>
        </>
      )}

      <Panel
        title="競合との比較"
        source="WEBRIS 競合監視"
        description="WEBRIS上でWEBRIS自身のサイトに登録した比較サイトの動き。競合のアクセス数は取得できないため、更新頻度で比較します。"
      >
        {competitors ? (
          competitors.items.length === 0 ? (
            <p className="py-4 text-sm text-[var(--text-dim)]">比較サイトが登録されていません。WEBRISの「比較サイト」でwebris.levan.jpの競合を登録すると表示されます。</p>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-[var(--line)]">
                  <tr>
                    <th className={thClass}>サイト</th>
                    <th className={`${thClass} text-right`}>把握ページ数</th>
                    <th className={`${thClass} text-right`}>期間中の変更</th>
                    <th className={`${thClass} text-right`}>前期間の変更</th>
                    <th className={thClass}>最終変更検知</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {gsc && (
                    <tr className="bg-[var(--accent-tint)]/40">
                      <td className={`${tdClass} font-medium`}>WEBRIS（自社）</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(gsc.pages.length)}</td>
                      <td className={`${tdClass} text-[11px] text-[var(--text-dim)]`} colSpan={3}>
                        検索クリック {fmtInt(gsc.current.clicks)}（前期間 {fmtInt(gsc.previous.clicks)}）/ 表示キーワード {fmtInt(seo?.keywordCount)}
                      </td>
                    </tr>
                  )}
                  {competitors.items.map((c) => (
                    <tr key={c.url}>
                      <td className={`${tdClass} max-w-[260px]`}>
                        <div className="truncate font-medium">{c.name}</div>
                        <div className="truncate text-[11px] text-[var(--text-dim)]">{c.url}</div>
                      </td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(c.pages)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(c.changes)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(c.prevChanges)}</td>
                      <td className={`${tdClass} text-[var(--text-dim)]`}>{fmtDate(c.lastChangeAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <SectionNotice section={payload.competitors} name="競合監視" />
        )}
      </Panel>
    </div>
  );
}

function KeywordMiniTable({ rows, empty }: { rows: ReturnType<typeof buildSeo>["queries"]; empty: string }) {
  if (rows.length === 0) return <p className="py-4 text-sm text-[var(--text-dim)]">{empty}</p>;
  return (
    <ul className="divide-y divide-[var(--line)] text-[13px]">
      {rows.map((q) => (
        <li key={q.query} className="flex items-baseline justify-between gap-3 py-1.5">
          <span className="truncate" title={q.page}>
            {q.query}
          </span>
          <span className="shrink-0 tabular-nums">
            {q.prevPosition !== null && <span className="text-[var(--text-dim)]">{fmtPosition(q.prevPosition)} → </span>}
            <span className="font-medium">{fmtPosition(q.position)}位</span>
            <span className="ml-2 text-[11px] text-[var(--text-dim)]">表示{fmtInt(q.impressions)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
