import Link from "next/link";
import {
  fetchClaudeCostReport,
  fetchUsdJpyRate,
  AnthropicUsageNotConfiguredError,
  AnthropicUsageApiError,
} from "@/lib/anthropicUsage";

export const dynamic = "force-dynamic";

function monthBounds(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(first), to: fmt(last) };
}

function buildMonthOptions() {
  const now = new Date();
  const options: { label: string; from: string; to: string }[] = [];
  for (let offset = -6; offset <= 0; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const { from, to } = monthBounds(d.getFullYear(), d.getMonth());
    options.push({ label: `${d.getFullYear()}年${d.getMonth() + 1}月`, from, to });
  }
  return options;
}

const card = "border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm";

export default async function ClaudeUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const monthOptions = buildMonthOptions();
  const currentMonth = monthOptions[6];
  const from = params.from || currentMonth.from;
  const to = params.to || currentMonth.to;

  let buckets: Awaited<ReturnType<typeof fetchClaudeCostReport>> = [];
  let error: string | null = null;
  let rate = 150;
  let rateIsLive = false;

  try {
    [buckets, { rate, isLive: rateIsLive }] = await Promise.all([
      fetchClaudeCostReport(from, to),
      fetchUsdJpyRate(),
    ]);
  } catch (e) {
    error =
      e instanceof AnthropicUsageNotConfiguredError || e instanceof AnthropicUsageApiError
        ? e.message
        : "Claude API使用量の取得中に予期しないエラーが発生しました。";
  }

  const totalUsd = buckets.reduce((sum, b) => sum + b.costUsd, 0);
  const totalJpy = totalUsd * rate;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">
          Claude Console API 使用料
        </h1>
        <p className="text-[var(--text-dim)] mt-1">
          WEBRISが利用しているAnthropic APIの実費を、LEVANの経費として確認します。
        </p>
      </div>

      {error && (
        <div className="border border-[var(--gold)]/30 bg-[var(--gold-tint)] rounded-2xl p-5 text-sm text-[var(--text)]">
          <p className="font-medium mb-1">Claude API使用料の取得ができません</p>
          <p className="text-[var(--text-dim)]">{error}</p>
        </div>
      )}

      {!error && (
        <>
          <div className="flex flex-wrap gap-2">
            {monthOptions.map((m) => {
              const isActive = m.from === from && m.to === to;
              return (
                <Link
                  key={m.from}
                  href={`/webris/claude-usage?from=${m.from}&to=${m.to}`}
                  className={`text-sm px-3.5 py-1.5 rounded-full font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface-2)] text-[var(--text-dim)] hover:bg-[var(--line)]"
                  }`}
                >
                  {m.label}
                </Link>
              );
            })}
          </div>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={card}>
              <div className="text-xs text-[var(--text-dim)] mb-1">
                期間合計（{new Date(from).toLocaleDateString("ja-JP")} 〜 {new Date(to).toLocaleDateString("ja-JP")}）
              </div>
              <div className="text-3xl font-semibold tabular-nums text-[var(--text)]">
                ${totalUsd.toFixed(2)}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">USD</div>
            </div>
            <div className={card}>
              <div className="text-xs text-[var(--text-dim)] mb-1">
                日本円換算{rateIsLive ? "" : "（概算レート）"}
              </div>
              <div className="text-3xl font-semibold tabular-nums text-[var(--text)]">
                ¥{Math.round(totalJpy).toLocaleString("ja-JP")}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">
                レート: $1 = ¥{rate.toFixed(2)}
                {!rateIsLive && "（取得失敗のため固定値を使用）"}
              </div>
            </div>
          </section>

          <div className="overflow-x-auto border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium tracking-wide text-[var(--text-dim)] border-b border-[var(--line)]">
                  <th className="px-4 py-3">日付</th>
                  <th className="px-4 py-3">USD</th>
                  <th className="px-4 py-3">JPY（概算）</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr key={b.date} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-3 text-[var(--text)]">{new Date(b.date).toLocaleDateString("ja-JP")}</td>
                    <td className="px-4 py-3 tabular-nums text-[var(--text)]">${b.costUsd.toFixed(4)}</td>
                    <td className="px-4 py-3 tabular-nums text-[var(--text-dim)]">
                      ¥{Math.round(b.costUsd * rate).toLocaleString("ja-JP")}
                    </td>
                  </tr>
                ))}
                {buckets.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[var(--text-dim)]">
                      この期間の使用データはありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
