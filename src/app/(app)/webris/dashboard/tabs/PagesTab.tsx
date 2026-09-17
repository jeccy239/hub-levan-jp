import { DashLink } from "../LoadingBar";
import { DASH, fmtDuration, fmtInt, fmtPct } from "@/lib/webrisAnalytics/format";
import { buildNotFound, buildPages, PAGE_RANKINGS, rankPages, sectionData, type PageRanking } from "@/lib/webrisAnalytics/metrics";
import { Delta, EmptyRow, Pager, Panel, SectionNotice, SmallSampleNote, numClass, tdClass, thClass } from "../ui";
import { pageNumber, type TabContext } from "./context";

const PER_PAGE = 25;
const SITE = "https://webris.levan.jp";

export default function PagesTab({ payload, href, sp }: TabContext) {
  const ga4 = sectionData(payload.ga4);
  const { rows, source } = buildPages(payload);
  const ranking: PageRanking = PAGE_RANKINGS.some((r) => r.key === sp.rank) ? (sp.rank as PageRanking) : "pv";
  const ranked = rankPages(rows, ranking);
  const pages = Math.max(Math.ceil(ranked.rows.length / PER_PAGE), 1);
  const page = Math.min(pageNumber(sp.page), pages);
  const visible = ranked.rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const isGa4 = source === "GA4";
  const notFound = buildNotFound(payload);

  return (
    <div className="space-y-5">
      {!ga4 && <SectionNotice section={payload.ga4} name="GA4" />}
      {source === "WEBRISタグ" && (
        <p className="text-xs text-[var(--text-dim)]">GA4が使えないため、WEBRIS自身のヒートマップタグで計測した表示回数を出しています（ユーザー数・滞在時間は取得できません）。</p>
      )}

      <Panel
        title="ページ別の分析"
        source={source ?? undefined}
        description="出口数・離脱率はGA4 Data APIで取得できないため、代わりに直帰率を表示しています。CV = GA4のキーイベント数。"
      >
        <nav className="flex flex-wrap gap-1 mb-3" aria-label="ランキング">
          {PAGE_RANKINGS.map((r) => (
            <DashLink
              key={r.key}
              href={href({ rank: r.key, page: undefined })}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                ranking === r.key ? "bg-[var(--text)] text-white" : "bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              {r.label}
            </DashLink>
          ))}
        </nav>
        {ranked.unavailable ? (
          <p className="rounded-xl bg-[var(--surface-2)] px-4 py-6 text-sm text-[var(--text-dim)]">{ranked.unavailable}</p>
        ) : (
          <>
            <div className="overflow-x-auto -mx-5">
              <table className="w-full min-w-[1080px]">
                <thead className="border-b border-[var(--line)]">
                  <tr>
                    <th className={thClass}>#</th>
                    <th className={thClass}>ページ</th>
                    <th className={`${thClass} text-right`}>PV</th>
                    <th className={`${thClass} text-right`}>前期間比</th>
                    <th className={`${thClass} text-right`}>ユーザー</th>
                    <th className={`${thClass} text-right`}>新規</th>
                    <th className={`${thClass} text-right`}>平均滞在</th>
                    <th className={`${thClass} text-right`}>エンゲージ率</th>
                    <th className={`${thClass} text-right`}>直帰率</th>
                    <th className={`${thClass} text-right`}>入口数</th>
                    <th className={`${thClass} text-right`} title="GA4 Data APIに出口数の指標が無いため未計測">出口数</th>
                    <th className={`${thClass} text-right`}>CV数</th>
                    <th className={`${thClass} text-right`}>CVR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {visible.map((r, i) => (
                    <tr key={`${r.path}-${r.title}`}>
                      <td className={`${tdClass} text-[var(--text-dim)] tabular-nums`}>{(page - 1) * PER_PAGE + i + 1}</td>
                      <td className={`${tdClass} max-w-[340px]`}>
                        <div className="truncate font-medium" title={r.title}>
                          {r.title || "（タイトルなし）"}
                        </div>
                        <a href={`${SITE}${r.path}`} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-[var(--text-dim)] hover:text-[var(--accent)]">
                          {r.path}
                        </a>
                      </td>
                      <td className={`${tdClass} ${numClass} font-medium`}>{fmtInt(r.views)}</td>
                      <td className={`${tdClass} ${numClass}`}>{r.prevViews === null ? DASH : <Delta cur={r.views} prev={r.prevViews} format="int" compact />}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(r.users)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(r.newUsers)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtDuration(r.avgEngagementSec)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtPct(r.engagementRate, 0)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtPct(r.bounceRate, 0)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(r.entrances)}</td>
                      <td className={`${tdClass} ${numClass} text-[var(--text-dim)]`}>{DASH}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(r.conversions)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtPct(r.cvr)}</td>
                    </tr>
                  ))}
                  {visible.length === 0 && <EmptyRow colSpan={13}>{source ? "該当するページがありません" : "ページデータを取得できていません"}</EmptyRow>}
                </tbody>
              </table>
            </div>
            <Pager page={page} pages={pages} hrefFor={(p) => href({ page: String(p) })} />
            {isGa4 && <SmallSampleNote n={ga4?.current.activeUsers ?? 0} />}
          </>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        {ga4 && (
          <Panel title="ランディングページ（入口）" source="GA4" description="セッションが始まったページ">
            <div className="overflow-x-auto -mx-5">
              <table className="w-full min-w-[480px]">
                <thead className="border-b border-[var(--line)]">
                  <tr>
                    <th className={thClass}>ページ</th>
                    <th className={`${thClass} text-right`}>セッション</th>
                    <th className={`${thClass} text-right`}>ユーザー</th>
                    <th className={`${thClass} text-right`}>直帰率</th>
                    <th className={`${thClass} text-right`}>CV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {ga4.landingPages.slice(0, 15).map((l) => (
                    <tr key={l.path}>
                      <td className={`${tdClass} max-w-[260px] truncate`}>{l.path || "(not set)"}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(l.sessions)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(l.users)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtPct(l.bounceRate, 0)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(l.keyEvents)}</td>
                    </tr>
                  ))}
                  {ga4.landingPages.length === 0 && <EmptyRow colSpan={5}>データがありません</EmptyRow>}
                </tbody>
              </table>
            </div>
          </Panel>

        )}
          <Panel
            title="404（ページが見つからない）"
            source={notFound.source ?? undefined}
            description={notFound.source === "GA4" ? "ページタイトルに「404」「見つかりません」「Not Found」を含む表示。発生日時は最後に観測した時間帯（GA4プロパティのタイムゾーン・1時間単位）。" : "ページタイトルに「404」などを含む表示（WEBRISタグ）。参照元・発生日時はGA4連携時のみ表示できます。"}
          >
            <div className="overflow-x-auto -mx-5">
              <table className="w-full min-w-[520px]">
                <thead className="border-b border-[var(--line)]">
                  <tr>
                    <th className={thClass}>URL</th>
                    <th className={`${thClass} text-right`}>アクセス数</th>
                    <th className={thClass}>参照元</th>
                    <th className={thClass}>発生日時</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {notFound.rows.map((n) => (
                    <tr key={`${n.path}-${n.referrer}`}>
                      <td className={`${tdClass} max-w-[220px] truncate text-[var(--danger)]`} title={n.path}>
                        {n.path}
                      </td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(n.views)}</td>
                      <td className={`${tdClass} max-w-[200px] truncate text-[var(--text-dim)]`} title={n.referrer ?? undefined}>
                        {n.referrer === null ? "—" : n.referrer || "（直接 / 不明）"}
                      </td>
                      <td className={`${tdClass} tabular-nums text-[var(--text-dim)]`}>{n.lastSeen ? n.lastSeen.replaceAll("-", "/") : "—"}</td>
                    </tr>
                  ))}
                  {notFound.rows.length === 0 && <EmptyRow colSpan={4}>{notFound.source ? "期間中の404表示はありません" : "ページデータを取得できていません"}</EmptyRow>}
                </tbody>
              </table>
            </div>
          </Panel>
      </div>
    </div>
  );
}
