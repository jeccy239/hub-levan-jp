import { AD_CHANNEL_LABEL, type AdSpendEntry } from "@/lib/webrisAnalytics/adsService";
import { DASH, fmtInt, fmtJpy, fmtPct } from "@/lib/webrisAnalytics/format";
import { buildChannels, classifyChannel, CHANNELS, roas, sectionData, type ChannelRow } from "@/lib/webrisAnalytics/metrics";
import { AdSpendForm, DeleteAdSpendButton } from "../controls";
import { BarList, Delta, EmptyRow, Panel, SectionNotice, SmallSampleNote, numClass, tdClass, thClass } from "../ui";
import type { TabContext } from "./context";

function Tracked({ v, format = "int" }: { v: number | null; format?: "int" | "pct" | "jpy" }) {
  if (v === null) return <span className="text-[var(--text-dim)]" title="GA4にイベントが送られていないため未計測">{DASH}</span>;
  return <>{format === "pct" ? fmtPct(v) : format === "jpy" ? fmtJpy(v) : fmtInt(v)}</>;
}

export default function AcquisitionTab({ payload, range, ads, adsPrev, adEntries }: TabContext & { adEntries: AdSpendEntry[] }) {
  const ga4 = sectionData(payload.ga4);
  const product = sectionData(payload.product);
  const revenue = sectionData(payload.revenue);
  const channels = ga4 ? buildChannels(ga4, ads) : null;
  const rows = channels?.rows ?? [];
  const blended = roas(revenue, ads);
  const firstUsers = ga4
    ? CHANNELS.map((c) => ({
        label: c.label,
        value: ga4.firstUserChannels.filter((f) => classifyChannel(f.source, f.medium, f.channelGroup) === c.key).reduce((a, f) => a + f.users, 0),
      })).filter((x) => x.value > 0)
    : [];
  const best = (pick: (r: ChannelRow) => number | null) => {
    const top = [...rows].filter((r) => (pick(r) ?? 0) > 0).sort((a, b) => pick(b)! - pick(a)!)[0];
    return top ? `${top.label}（${fmtInt(pick(top))}）` : DASH;
  };

  return (
    <div className="space-y-5">
      {!ga4 && <SectionNotice section={payload.ga4} name="GA4" />}

      {channels && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "最もユーザーを連れてきた", value: best((r) => r.users) },
              { label: "最も登録につながった", value: channels.trackedEvents.signup ? best((r) => r.signups) : "未計測" },
              { label: "最もAI分析につながった", value: channels.trackedEvents.ai ? best((r) => r.aiRuns) : "未計測" },
              { label: "最も課金につながった", value: channels.trackedEvents.purchase ? best((r) => r.purchases) : "未計測" },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm px-4 py-3">
                <div className="text-[11px] text-[var(--text-dim)]">{c.label}</div>
                <div className={`mt-0.5 text-[15px] font-semibold ${c.value === "未計測" ? "text-[var(--text-dim)]" : "text-[var(--text)]"}`}>{c.value}</div>
              </div>
            ))}
          </section>

          <Panel
            title="流入元別の成果"
            source="GA4 / 広告費(手入力)"
            description="セッションの参照元で分類。登録・URL登録・AI分析・有料化は、WEBRISがGA4へイベントを送っている場合のみ流入元別に集計できます。"
          >
            <div className="overflow-x-auto -mx-5">
              <table className="w-full min-w-[980px]">
                <thead className="border-b border-[var(--line)]">
                  <tr>
                    <th className={thClass}>流入元</th>
                    <th className={`${thClass} text-right`}>ユーザー</th>
                    <th className={`${thClass} text-right`}>前期間比</th>
                    <th className={`${thClass} text-right`}>セッション</th>
                    <th className={`${thClass} text-right`}>新規</th>
                    <th className={`${thClass} text-right`}>初回流入</th>
                    <th className={`${thClass} text-right`}>キーイベント</th>
                    <th className={`${thClass} text-right`}>登録</th>
                    <th className={`${thClass} text-right`}>CVR</th>
                    <th className={`${thClass} text-right`}>URL登録</th>
                    <th className={`${thClass} text-right`}>AI分析</th>
                    <th className={`${thClass} text-right`}>有料化</th>
                    <th className={`${thClass} text-right`}>売上</th>
                    <th className={`${thClass} text-right`}>広告費</th>
                    <th className={`${thClass} text-right`}>CAC</th>
                    <th className={`${thClass} text-right`}>ROAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {rows.map((r) => (
                    <tr key={r.key} className={r.users === 0 && r.prevUsers === 0 ? "text-[var(--text-dim)]" : ""}>
                      <td className={`${tdClass} font-medium`}>{r.label}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(r.users)}</td>
                      <td className={`${tdClass} ${numClass}`}>
                        <Delta cur={r.users} prev={r.prevUsers} format="int" compact />
                      </td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(r.sessions)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(r.newUsers)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(r.firstUsers)}</td>
                      <td className={`${tdClass} ${numClass}`}>{fmtInt(r.keyEvents)}</td>
                      <td className={`${tdClass} ${numClass}`}><Tracked v={r.signups} /></td>
                      <td className={`${tdClass} ${numClass}`}><Tracked v={r.cvr} format="pct" /></td>
                      <td className={`${tdClass} ${numClass}`}><Tracked v={r.urlAdds} /></td>
                      <td className={`${tdClass} ${numClass}`}><Tracked v={r.aiRuns} /></td>
                      <td className={`${tdClass} ${numClass}`}><Tracked v={r.purchases} /></td>
                      <td className={`${tdClass} ${numClass}`}><Tracked v={r.revenue} format="jpy" /></td>
                      <td className={`${tdClass} ${numClass}`}>{r.adSpend === null ? DASH : fmtJpy(r.adSpend)}</td>
                      <td className={`${tdClass} ${numClass}`}>{r.cac === null ? DASH : fmtJpy(r.cac)}</td>
                      <td className={`${tdClass} ${numClass}`}>{r.roas === null ? DASH : fmtPct(r.roas, 0)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[var(--surface-2)]/60 font-medium">
                    <td className={tdClass}>合計（全チャネル）</td>
                    <td className={`${tdClass} ${numClass}`}>{fmtInt(ga4!.current.activeUsers)}</td>
                    <td className={`${tdClass} ${numClass}`}>
                      <Delta cur={ga4!.current.activeUsers} prev={ga4!.previous.activeUsers} format="int" compact />
                    </td>
                    <td className={`${tdClass} ${numClass}`}>{fmtInt(ga4!.current.sessions)}</td>
                    <td className={`${tdClass} ${numClass}`}>{fmtInt(ga4!.current.newUsers)}</td>
                    <td className={`${tdClass} ${numClass}`}>{DASH}</td>
                    <td className={`${tdClass} ${numClass}`}>{fmtInt(ga4!.current.keyEvents)}</td>
                    <td className={`${tdClass} ${numClass}`} title="WEBRIS DB">{product ? fmtInt(product.current.signups) : DASH}</td>
                    <td className={`${tdClass} ${numClass}`}>{product && ga4!.current.sessions > 0 ? fmtPct(product.current.signups / ga4!.current.sessions) : DASH}</td>
                    <td className={`${tdClass} ${numClass}`}>{product ? fmtInt(product.current.urlAdds) : DASH}</td>
                    <td className={`${tdClass} ${numClass}`}>{product ? fmtInt(product.current.aiRuns) : DASH}</td>
                    <td className={`${tdClass} ${numClass}`}>{product ? fmtInt(product.current.paidStarts) : DASH}</td>
                    <td className={`${tdClass} ${numClass}`}>{revenue ? fmtJpy(revenue.current.revenueJpy) : DASH}</td>
                    <td className={`${tdClass} ${numClass}`}>{ads.hasData ? fmtJpy(ads.totalJpy) : "未入力"}</td>
                    <td className={`${tdClass} ${numClass}`}>
                      {ads.hasData && product && product.current.paidStarts > 0 ? fmtJpy(ads.totalJpy / product.current.paidStarts) : DASH}
                    </td>
                    <td className={`${tdClass} ${numClass}`}>{blended === null ? DASH : fmtPct(blended, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-[var(--text-dim)]">
              合計行の登録・URL登録・AI分析・有料化はWEBRIS DBの実数（流入元は不明）。「—」は未計測を意味し、0件ではありません。
              {!channels.trackedEvents.signup && " 流入元別の登録を見るには、WEBRISの登録完了時に GA4 の sign_up イベントを送信してください。"}
            </p>
            <SmallSampleNote n={ga4!.current.activeUsers} />
          </Panel>

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="流入元の比較（ユーザー）" source="GA4">
              <BarList items={rows.filter((r) => r.users > 0).sort((a, b) => b.users - a.users).map((r) => ({ label: r.label, value: r.users, sub: `前期 ${fmtInt(r.prevUsers)}` }))} />
            </Panel>
            <Panel title="最初の参照元（ユーザー）" source="GA4" description="ユーザーが初めて来た経路">
              <BarList items={firstUsers.sort((a, b) => b.value - a.value)} />
            </Panel>
            <Panel title="Otherに分類された参照元" source="GA4" description="分類ルールの見直し候補">
              {channels.unmatched.length === 0 ? (
                <p className="py-4 text-sm text-[var(--text-dim)]">ありません</p>
              ) : (
                <ul className="divide-y divide-[var(--line)] text-[13px]">
                  {channels.unmatched.map((u) => (
                    <li key={`${u.source}/${u.medium}`} className="flex justify-between gap-2 py-1.5">
                      <span className="truncate">
                        {u.source} / {u.medium}
                      </span>
                      <span className="tabular-nums">{fmtInt(u.sessions)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      <Panel
        title="広告費"
        source="手入力"
        description={
          <>
            Meta / Google広告のAPIは未連携のため、実績を入力してください。表示期間と一部だけ重なる入力は日割りで按分します。
            {ads.prorated && "（この期間は按分あり）"}
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3 mb-4">
          <div>
            <div className="text-[11px] text-[var(--text-dim)]">表示期間の広告費</div>
            <div className="text-xl font-semibold tabular-nums">{ads.hasData ? fmtJpy(ads.totalJpy) : "未入力"}</div>
            {ads.hasData && adsPrev.hasData && <Delta cur={ads.totalJpy} prev={adsPrev.totalJpy} format="jpy" lowerIsBetter />}
          </div>
          <div>
            <div className="text-[11px] text-[var(--text-dim)]">媒体別</div>
            <div className="text-[13px]">
              {ads.hasData
                ? Object.entries(ads.byChannel).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span>{AD_CHANNEL_LABEL[k] ?? k}</span>
                      <span className="tabular-nums">{fmtJpy(v)}</span>
                    </div>
                  ))
                : DASH}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[var(--text-dim)]">ブレンドROAS（売上 ÷ 広告費）</div>
            <div className="text-xl font-semibold tabular-nums">{blended === null ? DASH : fmtPct(blended, 0)}</div>
          </div>
        </div>
        <AdSpendForm defaultStart={range.current.start} defaultEnd={range.current.end} />
        <div className="overflow-x-auto -mx-5 mt-4">
          <table className="w-full min-w-[560px]">
            <thead className="border-b border-[var(--line)]">
              <tr>
                <th className={thClass}>媒体</th>
                <th className={thClass}>期間</th>
                <th className={`${thClass} text-right`}>金額</th>
                <th className={thClass}>メモ</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {adEntries.map((e) => (
                <tr key={e.id}>
                  <td className={tdClass}>{AD_CHANNEL_LABEL[e.channel] ?? e.channel}</td>
                  <td className={`${tdClass} tabular-nums`}>
                    {e.periodStart.replaceAll("-", "/")}〜{e.periodEnd.replaceAll("-", "/")}
                  </td>
                  <td className={`${tdClass} ${numClass}`}>{fmtJpy(e.amountJpy)}</td>
                  <td className={`${tdClass} text-[var(--text-dim)] max-w-[240px] truncate`}>{e.memo ?? ""}</td>
                  <td className={`${tdClass} text-right`}>
                    <DeleteAdSpendButton id={e.id} />
                  </td>
                </tr>
              ))}
              {adEntries.length === 0 && <EmptyRow colSpan={5}>まだ広告費の記録はありません。</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
