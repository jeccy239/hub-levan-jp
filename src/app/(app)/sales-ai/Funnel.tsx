type Stage = { label: string; value: number; hint: string };

function rate(from: number, to: number): string | null {
  if (from <= 0) return null;
  const pct = (to / from) * 100;
  return pct >= 10 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
}

/** 本日の営業ファネル。各段の絶対数だけでなく、前段からの転換率と相対的な
 *  ボリュームを見せることで「どこで落ちているか」が一目で分かるようにする。 */
export default function Funnel({ stages, outcomes }: { stages: Stage[]; outcomes: Stage[] }) {
  const peak = Math.max(...stages.map((s) => s.value), 1);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">本日の営業</h2>
        <span className="text-xs text-[var(--text-dim)]">各段の下は前段からの転換率</span>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-[var(--line)]">
          {stages.map((s, i) => {
            const conv = i === 0 ? null : rate(stages[i - 1].value, s.value);
            return (
              <div key={s.label} className="p-4 group relative" title={s.hint}>
                <div className="text-xs text-[var(--text-dim)]">{s.label}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[26px] leading-none font-semibold tabular-nums text-[var(--text)]">
                    {s.value.toLocaleString("ja-JP")}
                  </span>
                  <span className="text-xs text-[var(--text-dim)]">社</span>
                </div>
                {/* 相対ボリュームのバー */}
                <div className="mt-2.5 h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all"
                    style={{ width: `${Math.max((s.value / peak) * 100, s.value > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <div className="mt-1.5 text-[11px] text-[var(--text-dim)] tabular-nums">
                  {conv ? `前段から ${conv}` : " "}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 divide-x divide-[var(--line)] border-t border-[var(--line)] bg-[var(--surface-2)]/60">
          {outcomes.map((o) => (
            <div key={o.label} className="p-4" title={o.hint}>
              <div className="text-xs text-[var(--text-dim)]">{o.label}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-[26px] leading-none font-semibold tabular-nums text-[var(--text)]">
                  {o.value.toLocaleString("ja-JP")}
                </span>
                <span className="text-xs text-[var(--text-dim)]">社</span>
              </div>
              <div className="mt-1.5 text-[11px] text-[var(--text-dim)]">{o.hint}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
