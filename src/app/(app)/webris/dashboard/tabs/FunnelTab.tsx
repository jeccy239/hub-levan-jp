import { DASH, fmtInt, fmtPct } from "@/lib/webrisAnalytics/format";
import { buildFunnel, FUNNEL_ADVICE, funnelAdviceKey, sectionData } from "@/lib/webrisAnalytics/metrics";
import { MetricGap, Panel, SmallSampleNote, SourceChip, numClass, tdClass, thClass } from "../ui";
import type { TabContext } from "./context";

export default function FunnelTab({ payload }: TabContext) {
  const { rows, worst } = buildFunnel(payload);
  const product = sectionData(payload.product);
  const peak = Math.max(...rows.map((r) => r.value ?? 0), 1);
  const worstKey = worst ? funnelAdviceKey(rows, worst) : null;

  return (
    <div className="space-y-5">
      {worst && (
        <section className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger-tint)] px-5 py-4 grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold text-[var(--danger)]">最大離脱</p>
            <p className="text-lg font-semibold text-[var(--text)]">
              {worst.prevLabel} → {worst.label}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-dim)]">離脱率 / 離脱数</p>
            <p className="text-lg font-semibold tabular-nums text-[var(--text)]">
              {fmtPct(worst.dropRate, 0)} <span className="text-sm font-normal text-[var(--text-dim)]">/ {fmtInt(worst.dropCount)}人</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-dim)]">改善候補</p>
            <p className="text-sm font-medium text-[var(--text)]">{(worstKey && FUNNEL_ADVICE[worstKey]) ?? "このステップの導線を見直す"}</p>
            <p className="text-[10px] text-[var(--text-dim)] mt-0.5">概要タブの「AIで要約する」で、データに基づく具体策も生成できます。</p>
          </div>
        </section>
      )}

      <Panel
        title="コンバージョンファネル"
        description="訪問から有料契約までの各ステップ。「未計測」のステップは飛ばして、直前の計測済みステップと比較します。"
      >
        <div className="space-y-1.5">
          {rows.map((r, i) => {
            const isWorst = worst?.key === r.key;
            return (
              <div key={r.key} className={`grid grid-cols-[1.5rem_minmax(7rem,11rem)_1fr] sm:grid-cols-[1.5rem_12rem_1fr_9rem] items-center gap-x-3 gap-y-1 rounded-xl px-2 py-1.5 ${isWorst ? "bg-[var(--danger-tint)]" : ""}`}>
                <span className="text-[11px] tabular-nums text-[var(--text-dim)] text-right">{i + 1}</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text)] truncate">{r.label}</div>
                  <div className="text-[10px] text-[var(--text-dim)] truncate" title={r.basis}>
                    {r.source}
                  </div>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  {r.value !== null ? (
                    <>
                      <div className="h-6 flex-1 rounded-md bg-[var(--surface-2)] overflow-hidden">
                        <div
                          className={`h-full rounded-md ${r.source === "GA4" ? "bg-[var(--accent)]" : "bg-[#1f5fa8]"}`}
                          style={{ width: `${Math.max((r.value / peak) * 100, r.value > 0 ? 1.5 : 0)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-sm font-semibold tabular-nums">{fmtInt(r.value)}</span>
                    </>
                  ) : (
                    r.metric.kind !== "value" && <MetricGap metric={r.metric} />
                  )}
                </div>
                <div className="col-start-2 col-span-2 sm:col-start-auto sm:col-span-1 text-[11px] tabular-nums text-[var(--text-dim)] sm:text-right">
                  {r.fromPrev !== null ? (
                    <>
                      前段から <span className="font-medium text-[var(--text)]">{fmtPct(r.fromPrev, 0)}</span>
                      {r.dropRate !== null && r.dropRate > 0 && <span className="ml-1 text-[var(--danger)]">−{fmtPct(r.dropRate, 0)}</span>}
                    </>
                  ) : r.metric.kind !== "value" ? (
                    <span className="truncate block" title={r.metric.reason}>
                      {r.metric.reason}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-dim)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-[var(--accent)]" />
            GA4：期間中の全ユーザー（既存ユーザーを含む）
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-[#1f5fa8]" />
            WEBRIS DB：期間中に登録したアカウントが現時点までに到達した数
          </span>
        </div>
        <p className="mt-2 text-[11px] text-[var(--text-dim)]">
          ※ GA4とWEBRIS DBでは数え方（匿名ユーザー / アカウント）が異なるため、両者をまたぐ通過率は目安です。前段より多い場合は100%を超えます。
        </p>
        <SmallSampleNote n={rows[0]?.value ?? 0} />
      </Panel>

      <Panel title="ステップ別の数値" description="人数・通過率・離脱">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-[var(--line)]">
              <tr>
                <th className={thClass}>ステップ</th>
                <th className={thClass}>データ元</th>
                <th className={`${thClass} text-right`}>人数</th>
                <th className={`${thClass} text-right`}>前ステップからのCVR</th>
                <th className={`${thClass} text-right`}>全体CVR</th>
                <th className={`${thClass} text-right`}>離脱数</th>
                <th className={`${thClass} text-right`}>離脱率</th>
                <th className={thClass}>集計の定義</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className={`${tdClass} font-medium`}>{r.label}</td>
                  <td className={tdClass}>
                    <SourceChip>{r.source}</SourceChip>
                  </td>
                  <td className={`${tdClass} ${numClass}`}>{r.value !== null ? fmtInt(r.value) : r.metric.kind !== "value" && <MetricGap metric={r.metric} />}</td>
                  <td className={`${tdClass} ${numClass}`}>{r.fromPrev === null ? DASH : fmtPct(r.fromPrev)}</td>
                  <td className={`${tdClass} ${numClass}`}>{r.fromTop === null ? DASH : fmtPct(r.fromTop)}</td>
                  <td className={`${tdClass} ${numClass}`}>{r.dropCount === null ? DASH : fmtInt(r.dropCount)}</td>
                  <td className={`${tdClass} ${numClass}`}>{r.dropRate === null ? DASH : fmtPct(r.dropRate)}</td>
                  <td className={`${tdClass} text-[11px] text-[var(--text-dim)] whitespace-normal min-w-[220px]`}>{r.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {product && (
        <Panel title="期間中のプロダクト利用（件数）" source="WEBRIS DB" description="ファネルは「人」、こちらは期間中に発生した「回数」">
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-[13px]">
            {[
              ["企業アカウント登録", product.current.signups],
              ["管理者アカウント登録", product.current.managerSignups],
              ["URL登録", product.current.urlAdds],
              ["サイト診断", product.current.analyses],
              ["AI機能の実行", product.current.aiRuns],
              ["レポート作成", product.current.reports],
              ["有料化", product.current.paidStarts],
              ["解約（有料→無料）", product.current.cancels],
              ["Search Console連携", product.current.gscConnects],
              ["GA4連携", product.current.ga4Connects],
              ["診断したアカウント", product.current.analyzedAccounts],
              ["AIを使ったアカウント", product.current.aiAccounts],
            ].map(([label, v]) => (
              <div key={label as string}>
                <dt className="text-[11px] text-[var(--text-dim)]">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{fmtInt(v as number)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-[var(--text-dim)]">
            ※ サイト診断には、WEBRISの定期クロールで自動実行されたものも含まれます。有料化・解約は、WEBRISがプラン変更の記録を始めて以降のものだけです。
          </p>
        </Panel>
      )}
    </div>
  );
}
