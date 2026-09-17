import { DashLink } from "../LoadingBar";
import type { AiSummary } from "@/lib/webrisAnalytics/aiSummary";
import { fmtDateTime, fmtInt, fmtJpy, fmtPct } from "@/lib/webrisAnalytics/format";
import {
  buildChannels,
  buildFunnel,
  buildImprovements,
  buildKpis,
  roas,
  sectionData,
} from "@/lib/webrisAnalytics/metrics";
import { GenerateSummaryButton } from "../controls";
import { BarList, DailyBars, Delta, KpiCard, Panel, SectionNotice, SmallSampleNote, cardClass } from "../ui";
import type { TabContext } from "./context";

function LiveStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-4 py-3 min-w-0">
      <div className="text-[11px] text-[var(--text-dim)] truncate">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums text-[var(--text)]">{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-dim)] truncate">{sub}</div>}
    </div>
  );
}

export default function OverviewTab({
  payload,
  range,
  ads,
  adsPrev,
  href,
  rangeParams,
  aiSummary,
  dataFetchedAt,
}: TabContext & { aiSummary: AiSummary | null; dataFetchedAt: Date | null }) {
  const ga4 = sectionData(payload.ga4);
  const product = sectionData(payload.product);
  const revenue = sectionData(payload.revenue);
  const firstParty = sectionData(payload.firstParty);
  const kpis = buildKpis(payload, ads, adsPrev);
  const improvements = buildImprovements(payload, ads);
  const funnel = buildFunnel(payload);
  const channels = ga4 ? buildChannels(ga4, ads) : null;
  const blendedRoas = roas(revenue, ads);
  const summaryIsStale = aiSummary && dataFetchedAt && new Date(aiSummary.dataFetchedAt) < new Date(dataFetchedAt.getTime() - 60_000);

  // リアルタイム：GA4 が使えなければ WEBRIS タグの計測で代替し、出典を明記する
  const online = ga4?.realtime ? fmtInt(ga4.realtime.activeUsers5m) : "—";
  const last30 = ga4?.realtime ? `${fmtInt(ga4.realtime.activeUsers30m)}人` : firstParty ? `${fmtInt(firstParty.last30m.views)} PV` : "—";
  const todayPv = ga4?.today ? fmtInt(ga4.today.pageViews) : firstParty ? fmtInt(firstParty.today.views) : "—";
  const liveSource = ga4?.realtime ? "GA4リアルタイム" : firstParty ? "WEBRISタグ" : payload.ga4.status === "error" ? "取得エラー" : "未連携";

  return (
    <div className="space-y-5">
      {/* 準リアルタイム */}
      <section className={`${cardClass} grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-[var(--line)] overflow-hidden`}>
        <LiveStat label="現在オンライン（5分）" value={online} sub={ga4?.realtime ? "GA4リアルタイム" : "GA4リアルタイム未取得"} />
        <LiveStat label={ga4?.realtime ? "直近30分のユーザー" : "直近30分のアクセス"} value={last30} sub={liveSource} />
        <LiveStat label="今日のPV" value={todayPv} sub={ga4?.today ? "GA4（当日は速報値）" : liveSource} />
        <LiveStat label="今日の登録" value={product?.today ? fmtInt(product.today.signups) : "—"} sub="WEBRIS DB" />
        <LiveStat label="今日の分析実行" value={product?.today ? `${fmtInt(product.today.analyses)} / AI ${fmtInt(product.today.aiRuns)}` : "—"} sub="診断 / AI（WEBRIS DB）" />
      </section>

      {/* AI要約 + 改善ポイント */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="AIによる現状サマリー"
          description={
            aiSummary
              ? `生成 ${fmtDateTime(aiSummary.generatedAt)}（データ取得 ${fmtDateTime(aiSummary.dataFetchedAt)}時点）`
              : "表示中の数値だけを根拠に、WEBRISの状態をAIが要約します。"
          }
          action={<GenerateSummaryButton params={rangeParams} hasSummary={!!aiSummary} />}
        >
          {aiSummary ? (
            <div className="space-y-3">
              {summaryIsStale && (
                <p className="text-[11px] text-[var(--gold)]">※ 要約の作成後にデータが更新されています。必要なら作り直してください。</p>
              )}
              <p className="text-[17px] font-semibold leading-snug text-[var(--text)]">{aiSummary.headline}</p>
              <p className="text-sm leading-relaxed text-[var(--text)]">{aiSummary.summary}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold text-[#1b7f3b] mb-1">良い点</h3>
                  <ul className="space-y-1 text-[13px] text-[var(--text)] list-disc pl-4">
                    {aiSummary.good.length ? aiSummary.good.map((g, i) => <li key={i}>{g}</li>) : <li className="text-[var(--text-dim)]">特になし</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-[var(--danger)] mb-1">懸念点</h3>
                  <ul className="space-y-1 text-[13px] text-[var(--text)] list-disc pl-4">
                    {aiSummary.concerns.length ? aiSummary.concerns.map((g, i) => <li key={i}>{g}</li>) : <li className="text-[var(--text-dim)]">特になし</li>}
                  </ul>
                </div>
              </div>
              {aiSummary.actions.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text)] mb-1">AIの推奨アクション</h3>
                  <ol className="space-y-1.5">
                    {aiSummary.actions.map((a, i) => (
                      <li key={i} className="flex gap-2 text-[13px]">
                        <span className="shrink-0 text-[10px] font-semibold rounded-full px-1.5 py-0.5 h-fit bg-[var(--accent-tint)] text-[var(--accent-strong)]">
                          {a.impact}
                        </span>
                        <span>
                          <span className="font-medium text-[var(--text)]">{a.title}</span>
                          <span className="block text-xs text-[var(--text-dim)]">{a.reason}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <p className="text-[11px] text-[var(--text-dim)]">データの信頼度: {aiSummary.confidence}</p>
            </div>
          ) : (
            <p className="py-6 text-sm text-[var(--text-dim)]">
              まだこの期間の要約はありません。「AIで要約する」を押すと、上の数値とファネル・流入元・SEOの状況から要約と打ち手を作成します。
            </p>
          )}
        </Panel>

        <Panel className="lg:col-span-2" title="今すぐ改善すべきポイント" description="データから自動で抽出（ルールベース）">
          {improvements.length === 0 ? (
            <p className="py-6 text-sm text-[var(--text-dim)]">目立った改善点は検出されていません。</p>
          ) : (
            <ol className="space-y-2.5">
              {improvements.map((imp, i) => (
                <li key={i} className="flex gap-2.5">
                  <span
                    className={`shrink-0 mt-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 h-fit ${
                      imp.priority === "高"
                        ? "bg-[var(--danger-tint)] text-[var(--danger)]"
                        : imp.priority === "中"
                          ? "bg-[var(--gold-tint)] text-[var(--gold)]"
                          : "bg-[var(--surface-2)] text-[var(--text-dim)]"
                    }`}
                  >
                    {imp.priority}
                  </span>
                  <div className="min-w-0">
                    {imp.tab ? (
                      <DashLink href={href({ tab: imp.tab })} className="text-[13px] font-medium text-[var(--text)] hover:text-[var(--accent)]">
                        {imp.title}
                      </DashLink>
                    ) : (
                      <p className="text-[13px] font-medium text-[var(--text)]">{imp.title}</p>
                    )}
                    <p className="text-xs text-[var(--text-dim)] break-words">{imp.reason}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {/* KPI */}
      <section aria-label="主要KPI" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3">
        {kpis.map((k) => (
          <KpiCard key={k.key} kpi={k} compareLabel={range.compareLabel} />
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="日次アクセス" source="GA4" description="新規ユーザーと既存ユーザー（アクティブ − 新規）">
          {ga4 ? (
            <DailyBars
              rows={ga4.daily.map((d) => ({ date: d.date, values: [d.newUsers, Math.max(d.activeUsers - d.newUsers, 0)] }))}
              series={[
                { label: "新規", color: "var(--accent)" },
                { label: "既存", color: "#8fbef2" },
              ]}
            />
          ) : (
            <SectionNotice section={payload.ga4} name="GA4" />
          )}
        </Panel>
        <Panel title="日次プロダクト利用" source="WEBRIS DB" description="無料登録・URL登録と、AI分析の実行回数">
          {product ? (
            <DailyBars
              rows={product.daily.map((d) => ({ date: d.date, values: [d.signups + d.urlAdds, d.aiRuns] }))}
              series={[
                { label: "登録 + URL登録", color: "var(--accent)" },
                { label: "AI分析", color: "#c9a25a" },
              ]}
            />
          ) : (
            <SectionNotice section={payload.product} name="WEBRIS DB" />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="事業の現在地" source="WEBRIS DB / Stripe">
          {product ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[11px] text-[var(--text-dim)]">MRR（表示価格ベース）</dt>
                  <dd className="text-xl font-semibold tabular-nums">{fmtJpy(product.totals.mrrJpy)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--text-dim)]">有料 / 全アカウント</dt>
                  <dd className="text-xl font-semibold tabular-nums">
                    {fmtInt(product.totals.paying)}
                    <span className="text-sm font-normal text-[var(--text-dim)]"> / {fmtInt(product.totals.companies)}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--text-dim)]">期間の売上（Stripe）</dt>
                  <dd className="text-base font-semibold tabular-nums">
                    {revenue ? fmtJpy(revenue.current.revenueJpy) : <span className="text-sm text-[var(--text-dim)]">—（{payload.revenue.status === "error" ? "取得エラー" : "未設定"}）</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--text-dim)]">広告費 / ROAS</dt>
                  <dd className="text-base font-semibold tabular-nums">
                    {ads.hasData ? fmtJpy(ads.totalJpy) : <span className="text-sm text-[var(--text-dim)]">未入力</span>}
                    <span className="text-sm font-normal text-[var(--text-dim)]"> / {blendedRoas === null ? "—" : fmtPct(blendedRoas, 0)}</span>
                  </dd>
                </div>
              </dl>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[11px] text-[var(--text-dim)]">
                    <th className="text-left font-medium pb-1">プラン</th>
                    <th className="text-right font-medium pb-1">月額</th>
                    <th className="text-right font-medium pb-1">アカウント</th>
                    <th className="text-right font-medium pb-1">課金中</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {product.totals.byPlan.map((p) => (
                    <tr key={p.code}>
                      <td className="py-1.5">{p.name}</td>
                      <td className="py-1.5 text-right tabular-nums text-[var(--text-dim)]">{fmtJpy(p.priceJpy)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtInt(p.accounts)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtInt(p.paying)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {product.excludedSelfAccounts > 0 && (
                <p className="text-[11px] text-[var(--text-dim)]">※ WEBRIS自身のサイトを登録したアカウント（{product.excludedSelfAccounts}件）は集計から除外しています。</p>
              )}
            </div>
          ) : (
            <SectionNotice section={payload.product} name="WEBRIS DB" />
          )}
        </Panel>

        <Panel
          title="流入元（セッション）"
          source="GA4"
          action={
            <DashLink href={href({ tab: "acquisition" })} className="text-xs text-[var(--accent)] hover:underline">
              詳細
            </DashLink>
          }
        >
          {channels ? (
            <>
              <BarList
                items={channels.rows
                  .filter((c) => c.sessions > 0 || c.prevSessions > 0)
                  .sort((a, b) => b.sessions - a.sessions)
                  .map((c) => ({ label: c.label, value: c.sessions, sub: `${fmtInt(c.users)}人` }))}
                emptyText="期間内のセッションはありません"
              />
              <SmallSampleNote n={ga4?.current.activeUsers ?? 0} />
            </>
          ) : (
            <SectionNotice section={payload.ga4} name="GA4" />
          )}
        </Panel>

        <Panel
          title="ファネルの要点"
          action={
            <DashLink href={href({ tab: "funnel" })} className="text-xs text-[var(--accent)] hover:underline">
              詳細
            </DashLink>
          }
        >
          <ul className="space-y-1.5 text-[13px]">
            {funnel.rows
              .filter((r) => ["visit", "signup", "url", "ai", "paid"].includes(r.key))
              .map((r) => (
                <li key={r.key} className="flex items-baseline justify-between gap-2">
                  <span className="text-[var(--text)]">{r.label}</span>
                  <span className="tabular-nums font-medium">
                    {r.value === null ? <span className="text-[var(--text-dim)]">—</span> : fmtInt(r.value)}
                    {r.fromPrev !== null && <span className="ml-1.5 text-[11px] font-normal text-[var(--text-dim)]">{fmtPct(r.fromPrev, 0)}</span>}
                  </span>
                </li>
              ))}
          </ul>
          {funnel.worst && (
            <div className="mt-4 rounded-xl bg-[var(--danger-tint)] px-3 py-2">
              <p className="text-[11px] text-[var(--danger)] font-semibold">最大離脱</p>
              <p className="text-[13px] font-medium text-[var(--text)]">
                {funnel.worst.prevLabel} → {funnel.worst.label}
              </p>
              <p className="text-xs text-[var(--text-dim)]">
                離脱率 {fmtPct(funnel.worst.dropRate, 0)}（{fmtInt(funnel.worst.dropCount)}人）
              </p>
            </div>
          )}
          {ga4 && (
            <p className="mt-3 text-[11px] text-[var(--text-dim)]">
              期間の新規ユーザー {fmtInt(ga4.current.newUsers)}人 <Delta cur={ga4.current.newUsers} prev={ga4.previous.newUsers} format="int" compact />
            </p>
          )}
        </Panel>
      </div>

      {ga4 && ga4.cities.length > 0 && (
        <Panel title="地域（市区町村）" source="GA4" description="初期データのため、地域の偏りは参考程度に見てください。">
          <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            <BarList items={ga4.cities.slice(0, 12).map((c) => ({ label: c.city, value: c.users, sub: "人" }))} />
          </div>
        </Panel>
      )}
    </div>
  );
}
