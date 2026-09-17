import { AutoRefresh } from "../AutoRefresh";
import { DashLink } from "../LoadingBar";
import { DASH, fmtDateTime, fmtInt, fmtPct } from "@/lib/webrisAnalytics/format";
import { sectionData } from "@/lib/webrisAnalytics/metrics";
import { getPublicScans, type PublicScanItem } from "@/lib/webrisAnalytics/publicScans";
import { addDays, jstToday, type ResolvedRange } from "@/lib/webrisAnalytics/range";
import { DailyBars, EmptyRow, Pager, Panel, cardClass, numClass, tdClass, thClass } from "../ui";
import { pageNumber, type TabContext } from "./context";

const PER_PAGE = 50;
const REFRESH_MS = 30_000;

const FILTERS = [
  { key: "", label: "すべて" },
  { key: "ok", label: "診断成功" },
  { key: "failed", label: "失敗" },
  { key: "signed", label: "登録済みサイト" },
  { key: "internal", label: "社内" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  invalid_url: "URL不正",
  blocked_host: "内部アドレス",
  unreachable: "接続できず",
  not_html: "HTML以外",
  http_error: "HTTPエラー",
  error: "システムエラー",
};

/** www の有無で別サイト扱いにしない */
const siteKey = (host: string) => host.toLowerCase().replace(/^www\./, "");

function hostOf(url: string) {
  try {
    return siteKey(new URL(url).hostname);
  } catch {
    return null;
  }
}

function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function Score({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[var(--text-dim)]">{DASH}</span>;
  const tone = score >= 80 ? "text-[#1b7f3b]" : score >= 50 ? "text-[var(--gold)]" : "text-[var(--danger)]";
  return <span className={`font-semibold tabular-nums ${tone}`}>{score}</span>;
}

function ScanResult({ item }: { item: PublicScanItem }) {
  if (item.status === "ok") {
    return (
      <span className="text-[12px] text-[var(--text-dim)] tabular-nums">
        問題 {fmtInt(item.issueCount)} / 合格 {fmtInt(item.passCount)}
      </span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[var(--danger-tint)] text-[var(--danger)]">
      {STATUS_LABELS[item.status] ?? item.status}
    </span>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={`${cardClass} px-4 py-3`}>
      <p className="text-[11px] text-[var(--text-dim)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{note}</p>}
    </div>
  );
}

/**
 * 「7日間」などは GA4 に合わせて昨日までだが、このタブは診断直後に見たいので
 * 昨日で終わる期間は今日まで延ばす。
 */
function scanRange(range: ResolvedRange) {
  const today = jstToday();
  const extend = range.preset !== "yesterday" && range.current.end === addDays(today, -1);
  return { start: range.current.start, end: extend ? today : range.current.end, extended: extend };
}

export default async function ScansTab({ payload, range, href, sp }: TabContext) {
  const period = scanRange(range);
  const result = await getPublicScans(period);
  const refresher = <AutoRefresh intervalMs={REFRESH_MS} />;

  if (!result.data) {
    return (
      <Panel title="無料SEO診断" source="WEBRIS DB">
        {refresher}
        <p className="text-sm text-[var(--danger)]">{result.error}</p>
      </Panel>
    );
  }
  const { totals, daily, items, truncated, generatedAt } = result.data;

  // 診断されたサイトが WEBRIS に登録済みか（診断 → 登録につながったか）
  const accountByHost = new Map<string, string>();
  for (const a of sectionData(payload.product)?.accounts ?? []) {
    for (const u of a.siteUrls ?? []) {
      const h = hostOf(u);
      if (h && !accountByHost.has(h)) accountByHost.set(h, a.id);
    }
  }
  const accountFor = (item: PublicScanItem) => (item.host ? accountByHost.get(siteKey(item.host)) : undefined);

  // 同じサイトが期間内に何回診断されたか（取得分の範囲で数える）
  const scansPerHost = new Map<string, number>();
  for (const i of items) {
    if (i.host && !i.internal) scansPerHost.set(siteKey(i.host), (scansPerHost.get(siteKey(i.host)) ?? 0) + 1);
  }

  const filter = FILTERS.some((f) => f.key === sp.scan) ? (sp.scan as string) : "";
  const rows = items.filter((i) => {
    if (filter === "internal") return i.internal;
    if (i.internal) return false;
    if (filter === "ok") return i.status === "ok";
    if (filter === "failed") return i.status !== "ok";
    if (filter === "signed") return accountFor(i) !== undefined;
    return true;
  });
  const pages = Math.max(Math.ceil(rows.length / PER_PAGE), 1);
  const page = Math.min(pageNumber(sp.page), pages);
  const visible = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // 期間内の全日を並べる（診断0件の日も棒の位置を空ける）
  const counts = new Map(daily.map((d) => [d.date, d.scans]));
  const dailyRows: { date: string; values: number[] }[] = [];
  for (let d = period.start; d <= period.end; d = addDays(d, 1)) {
    dailyRows.push({ date: d, values: [counts.get(d) ?? 0] });
  }

  return (
    <div className="space-y-5">
      {refresher}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label="診断数" value={fmtInt(totals.scans)} note="社内IPからの診断を除く" />
        <Stat label="診断されたサイト" value={fmtInt(totals.sites)} note="ドメイン単位" />
        <Stat label="診断成功率" value={totals.scans ? fmtPct(totals.succeeded / totals.scans) : DASH} note={`成功 ${fmtInt(totals.succeeded)}件`} />
        <Stat label="社内からの診断" value={fmtInt(totals.internal)} note="PV_EXCLUDE_IPS に一致" />
      </div>

      <Panel
        title="日別の診断数"
        source="WEBRIS DB"
        description={`${period.start.replaceAll("-", "/")}〜${period.end.replaceAll("-", "/")}${period.extended ? "（このタブは今日の分も含めて表示します）" : ""}`}
      >
        <DailyBars rows={dailyRows} series={[{ label: "診断数", color: "var(--accent)" }]} />
      </Panel>

      <Panel
        title="診断されたサイト"
        source="WEBRIS DB"
        description="webris.levan.jp の無料SEO診断（ログイン不要）で入力されたURLです。新しい順。30秒ごとに自動で更新します。訪問者のIP・個人情報は保存していません。"
      >
        <nav className="flex flex-wrap gap-1 mb-3" aria-label="絞り込み">
          {FILTERS.map((f) => (
            <DashLink
              key={f.key}
              href={href({ scan: f.key || undefined, page: undefined })}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                filter === f.key ? "bg-[var(--text)] text-white" : "bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              {f.label}
            </DashLink>
          ))}
          <span className="ml-auto self-center text-[11px] text-[var(--text-dim)] tabular-nums">
            {fmtInt(rows.length)}件 ・ {fmtDateTime(generatedAt)} 時点
          </span>
        </nav>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-[var(--line)]">
              <tr>
                <th className={thClass}>診断日時</th>
                <th className={thClass}>URL</th>
                <th className={`${thClass} text-right`}>スコア</th>
                <th className={thClass}>結果</th>
                <th className={`${thClass} text-right`}>同サイトの診断</th>
                <th className={thClass}>WEBRIS登録</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {visible.map((i) => {
                const accountId = accountFor(i);
                const href = i.finalUrl ?? i.url;
                const linkable = /^https?:\/\//.test(href);
                const repeats = i.host ? (scansPerHost.get(siteKey(i.host)) ?? 0) : 0;
                return (
                  <tr key={i.id} className="hover:bg-[var(--surface-2)]/50">
                    <td className={`${tdClass} tabular-nums text-[var(--text-dim)]`}>{fmtDateTime(i.createdAt)}</td>
                    <td className={`${tdClass} max-w-[360px]`}>
                      <span className="flex items-center gap-1.5 min-w-0">
                        {linkable ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            title={i.finalUrl && i.finalUrl !== i.url ? `${i.url}\n→ ${i.finalUrl}` : i.url}
                            className="truncate text-[var(--accent)] hover:underline"
                          >
                            {displayUrl(i.url)}
                          </a>
                        ) : (
                          <span className="truncate text-[var(--text-dim)]" title={i.url}>
                            {i.url}
                          </span>
                        )}
                        {i.internal && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-dim)]">社内</span>
                        )}
                      </span>
                    </td>
                    <td className={`${tdClass} ${numClass}`}>
                      <Score score={i.score} />
                    </td>
                    <td className={tdClass}>
                      <ScanResult item={i} />
                    </td>
                    <td className={`${tdClass} ${numClass} text-[var(--text-dim)]`}>{repeats > 1 ? `${fmtInt(repeats)}回` : DASH}</td>
                    <td className={tdClass}>
                      {accountId ? (
                        <DashLink href={`/webris/dashboard/accounts/${accountId}`} className="text-xs text-[var(--accent)] hover:underline">
                          登録済み
                        </DashLink>
                      ) : (
                        <span className="text-[var(--text-dim)]">{DASH}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && <EmptyRow colSpan={6}>この期間に該当する診断はありません</EmptyRow>}
            </tbody>
          </table>
        </div>
        <Pager page={page} pages={pages} hrefFor={(p) => href({ page: String(p) })} />
        <p className="mt-2 text-[11px] text-[var(--text-dim)]">
          {truncated && "件数が多いため、新しい500件のみ表示しています（上の集計は期間全体）。"}
          同サイトの診断 = 表示中の期間で同じドメインが診断された回数。WEBRIS登録 = そのドメインを登録しているアカウントがあるもの（診断より前の登録も含みます）。
        </p>
      </Panel>
    </div>
  );
}
