import { DASH, fmtInt, fmtPct } from "@/lib/webrisAnalytics/format";
import { buildEvents, sectionData } from "@/lib/webrisAnalytics/metrics";
import { BarList, Delta, Panel, SectionNotice, SmallSampleNote, numClass, tdClass, thClass } from "../ui";
import type { TabContext } from "./context";

export default function EventsTab({ payload }: TabContext) {
  const ga4 = sectionData(payload.ga4);
  const product = sectionData(payload.product);
  const rows = buildEvents(payload);
  const unmeasured = rows.filter((r) => r.registered && !r.ga4).map((r) => r.name);

  return (
    <div className="space-y-5">
      {!ga4 && <SectionNotice section={payload.ga4} name="GA4" />}

      <Panel
        title="ユーザー行動イベント"
        source="GA4 / WEBRIS DB"
        description="GA4に届いたイベントと、WEBRIS DBから数えられる実績を並べています。イベント定義は src/lib/webrisAnalytics/metrics.ts の EVENT_REGISTRY に追加できます。"
      >
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-[var(--line)]">
              <tr>
                <th className={thClass}>イベント</th>
                <th className={`${thClass} text-right`}>回数（GA4）</th>
                <th className={`${thClass} text-right`}>前期間比</th>
                <th className={`${thClass} text-right`}>ユーザー数</th>
                <th className={`${thClass} text-right`}>発生率</th>
                <th className={`${thClass} text-right`}>前イベントからの遷移率</th>
                <th className={`${thClass} text-right`}>WEBRIS DB実績</th>
                <th className={`${thClass} text-right`}>前期間</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {rows.map((r) => (
                <tr key={r.name} className={!r.ga4 && !r.db ? "text-[var(--text-dim)]" : ""}>
                  <td className={tdClass}>
                    <span className="font-mono text-[12px]">{r.name}</span>
                    <span className="ml-2 text-[11px] text-[var(--text-dim)]">{r.label}</span>
                  </td>
                  <td className={`${tdClass} ${numClass}`}>{r.ga4 ? fmtInt(r.ga4.count) : <span title="GA4に届いていません">未計測</span>}</td>
                  <td className={`${tdClass} ${numClass}`}>{r.ga4 ? <Delta cur={r.ga4.count} prev={r.ga4.prevCount} format="int" compact /> : DASH}</td>
                  <td className={`${tdClass} ${numClass}`}>{r.ga4 ? fmtInt(r.ga4.users) : DASH}</td>
                  <td className={`${tdClass} ${numClass}`}>{fmtPct(r.rate)}</td>
                  <td className={`${tdClass} ${numClass}`}>{fmtPct(r.fromPrev)}</td>
                  <td className={`${tdClass} ${numClass}`}>{r.db ? fmtInt(r.db.cur) : DASH}</td>
                  <td className={`${tdClass} ${numClass} text-[var(--text-dim)]`}>{r.db ? fmtInt(r.db.prev) : DASH}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-[var(--text-dim)]">
          発生率 = イベントのユーザー数 ÷ アクティブユーザー。遷移率は、定義順で直前にある（GA4で計測済みの）行動イベントとのユーザー数比です。
        </p>
        {ga4 && <SmallSampleNote n={ga4.current.activeUsers} />}
      </Panel>

      {ga4 && unmeasured.length > 0 && (
        <Panel title="未計測のイベント" description="WEBRIS側で gtag('event', 名前) を送ると、流入元別の成果やファネルの空白が埋まります。">
          <div className="flex flex-wrap gap-1.5">
            {unmeasured.map((n) => (
              <span key={n} className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-dim)]">
                {n}
              </span>
            ))}
          </div>
        </Panel>
      )}

      {product && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="AI機能の内訳" source="WEBRIS DB" description="期間中の実行回数">
            <BarList
              items={[
                { label: "AIインサイト（サイト分析）", value: product.current.aiBreakdown.insights },
                { label: "AI記事生成", value: product.current.aiBreakdown.articles },
                { label: "SEO改善提案", value: product.current.aiBreakdown.improvements },
                { label: "AIO表示チェック", value: product.current.aiBreakdown.aioChecks },
                { label: "ブランド露出チェック", value: product.current.aiBreakdown.brandChecks },
                { label: "AIOページスコア", value: product.current.aiBreakdown.aioScores },
              ].sort((a, b) => b.value - a.value)}
              emptyText="期間中のAI機能の実行はありません"
            />
          </Panel>
          <Panel title="エラーイベント" source="WEBRIS DB" description="ページを1件も取得できなかったサイト診断">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold tabular-nums">{fmtInt(product.failedAnalyses.current)}</span>
              <Delta cur={product.failedAnalyses.current} prev={product.failedAnalyses.previous} format="int" lowerIsBetter />
            </div>
            <p className="mt-2 text-xs text-[var(--text-dim)]">
              期間中の診断 {fmtInt(product.current.analyses)}件のうち、{fmtPct(product.current.analyses ? product.failedAnalyses.current / product.current.analyses : null)} が取得失敗です。
              アプリケーションの例外（500エラーなど）はWEBRISのログ基盤が無いため、この画面には含まれません。
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}
