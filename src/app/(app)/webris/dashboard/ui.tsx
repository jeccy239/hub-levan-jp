import { DashLink } from "./LoadingBar";
import type { ReactNode } from "react";
import type { Kpi, KpiFormat } from "@/lib/webrisAnalytics/metrics";
import { change } from "@/lib/webrisAnalytics/metrics";
import { DASH, fmtDiff, fmtPct, fmtValue } from "@/lib/webrisAnalytics/format";
import type { Metric, Section } from "@/lib/webrisAnalytics/types";

// WEBRISダッシュボードの表示部品。フックを使わないのでサーバー/クライアントの両方から使える。

export const cardClass = "rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm";
export const thClass = "px-3 py-2.5 text-left text-[11px] font-medium text-[var(--text-dim)] whitespace-nowrap";
export const tdClass = "px-3 py-2.5 text-[13px] text-[var(--text)] whitespace-nowrap";
export const numClass = "tabular-nums text-right";

export function Panel({
  title,
  description,
  source,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: ReactNode;
  source?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${cardClass} min-w-0 ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-2 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-[var(--text-dim)]">{description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {source && <SourceChip>{source}</SourceChip>}
          {action}
        </div>
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

export function SourceChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-dim)] whitespace-nowrap">
      {children}
    </span>
  );
}

/** セクションが使えない理由の表示。未連携と取得エラーを見た目でも区別する。 */
export function SectionNotice({ section, name }: { section: Section<unknown>; name: string }) {
  if (section.status === "ok") return null;
  const isError = section.status === "error";
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        isError
          ? "border-[var(--danger)]/30 bg-[var(--danger-tint)] text-[var(--text)]"
          : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
      }`}
    >
      <p className="font-medium">
        {isError ? `${name}: データ取得エラー` : section.status === "not_configured" ? `${name}: 未設定` : `${name}: 未連携`}
      </p>
      <p className="mt-0.5 text-xs text-[var(--text-dim)] break-words">{section.message}</p>
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-[var(--text-dim)]">
        {children}
      </td>
    </tr>
  );
}

/** 未計測・エラーの値表示 */
export function MetricGap({ metric }: { metric: Exclude<Metric, { kind: "value" }> }) {
  return (
    <span title={metric.reason} className="inline-flex items-baseline gap-1.5">
      <span className="text-[var(--text-dim)]">{DASH}</span>
      <span
        className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ${
          metric.kind === "error" ? "bg-[var(--danger-tint)] text-[var(--danger)]" : "bg-[var(--surface-2)] text-[var(--text-dim)]"
        }`}
      >
        {metric.kind === "error" ? "取得エラー" : "未計測"}
      </span>
    </span>
  );
}

export function Delta({
  cur,
  prev,
  format,
  lowerIsBetter,
  compact,
}: {
  cur: number;
  prev: number | null;
  format: KpiFormat;
  lowerIsBetter?: boolean;
  compact?: boolean;
}) {
  const c = change(cur, prev);
  if (!c) return <span className="text-[11px] text-[var(--text-dim)]">比較なし</span>;
  const good = lowerIsBetter ? c.diff < 0 : c.diff > 0;
  const tone = c.diff === 0 ? "text-[var(--text-dim)]" : good ? "text-[#1b7f3b]" : "text-[var(--danger)]";
  const arrow = c.diff === 0 ? "" : c.diff > 0 ? "↑" : "↓";
  return (
    <span className={`text-[11px] font-medium tabular-nums whitespace-nowrap ${tone}`}>
      {arrow}
      {c.pct === null ? (prev === 0 && cur !== 0 ? "新規" : "") : fmtPct(Math.abs(c.pct), 0)}
      {!compact && <span className="ml-1 font-normal text-[var(--text-dim)]">({fmtDiff(c.diff, format)})</span>}
    </span>
  );
}

export function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  if (values.length < 2) return <div className={`h-8 ${className}`} />;
  const w = 120;
  const h = 32;
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`h-8 w-full ${className}`} aria-hidden>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="var(--accent-tint)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function KpiCard({ kpi, compareLabel }: { kpi: Kpi; compareLabel: string }) {
  const m = kpi.metric;
  return (
    <div className={`${cardClass} p-3.5 flex flex-col min-w-0`} title={`${kpi.hint}（${kpi.source}）`}>
      <div className="text-xs leading-snug text-[var(--text-dim)] min-h-[2lh] line-clamp-2">{kpi.label}</div>
      <div className="mt-1 text-[22px] leading-tight font-semibold tabular-nums text-[var(--text)] truncate">
        {m.kind === "value" ? fmtValue(m.value, kpi.format) : <MetricGap metric={m} />}
      </div>
      <div className="mt-1 min-h-4" title={compareLabel}>
        {m.kind === "value" ? (
          kpi.note ? (
            <span className="text-[11px] text-[var(--text-dim)]">{kpi.note}</span>
          ) : (
            <Delta cur={m.value} prev={m.prev} format={kpi.format} lowerIsBetter={kpi.lowerIsBetter} />
          )
        ) : (
          <span className="block text-[11px] text-[var(--text-dim)] truncate">{m.reason}</span>
        )}
      </div>
      <div className="mt-auto pt-2">{m.kind === "value" && m.series ? <Sparkline values={m.series} /> : <div className="h-8" />}</div>
      <div className="mt-1 text-[9px] text-[var(--text-dim)] truncate">{kpi.source}</div>
    </div>
  );
}

/** 横棒の比較（値ラベル付き） */
export function BarList({
  items,
  format = "int",
  emptyText = "データがありません",
}: {
  items: { label: string; value: number; sub?: string; href?: string }[];
  format?: KpiFormat;
  emptyText?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 0);
  if (items.length === 0 || max === 0) return <p className="py-4 text-sm text-[var(--text-dim)]">{emptyText}</p>;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            {i.href ? (
              <DashLink href={i.href} className="truncate text-[var(--text)] hover:text-[var(--accent)]">
                {i.label}
              </DashLink>
            ) : (
              <span className="truncate text-[var(--text)]">{i.label}</span>
            )}
            <span className="shrink-0 tabular-nums font-medium text-[var(--text)]">
              {fmtValue(i.value, format)}
              {i.sub && <span className="ml-1.5 text-[11px] font-normal text-[var(--text-dim)]">{i.sub}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max((i.value / max) * 100, i.value > 0 ? 2 : 0)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 日次の棒グラフ（2系列まで） */
export function DailyBars({
  rows,
  series,
}: {
  rows: { date: string; values: number[] }[];
  series: { label: string; color: string }[];
}) {
  if (rows.length === 0) return <p className="py-6 text-sm text-[var(--text-dim)]">データがありません</p>;
  const max = Math.max(...rows.map((r) => r.values.reduce((a, b) => a + b, 0)), 1);
  const labelEvery = Math.ceil(rows.length / 8);
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
            <span className="size-2 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto text-[11px] text-[var(--text-dim)] tabular-nums">最大 {max.toLocaleString("ja-JP")}</span>
      </div>
      <div className="flex items-end gap-[2px] h-32 border-b border-[var(--line)]">
        {rows.map((r) => {
          const total = r.values.reduce((a, b) => a + b, 0);
          return (
            <div
              key={r.date}
              className="flex-1 min-w-0 flex flex-col-reverse h-full"
              title={`${r.date}  ${series.map((s, i) => `${s.label}: ${r.values[i]}`).join(" / ")}`}
            >
              {r.values.map((v, i) => (
                <div key={i} style={{ height: `${(v / max) * 100}%`, background: series[i].color }} className={i === r.values.length - 1 && total > 0 ? "rounded-t-[2px]" : ""} />
              ))}
            </div>
          );
        })}
      </div>
      <div className="flex gap-[2px] mt-1">
        {rows.map((r, i) => (
          <div key={r.date} className="flex-1 min-w-0 text-[9px] text-[var(--text-dim)] tabular-nums text-center overflow-visible whitespace-nowrap">
            {i % labelEvery === 0 ? r.date.slice(5).replace("-", "/") : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SmallSampleNote({ n, unit = "人" }: { n: number; unit?: string }) {
  if (n >= 30) return null;
  return (
    <p className="mt-3 text-[11px] text-[var(--text-dim)]">
      ※ 母数が {n}
      {unit} と少ないため、比率・順位は偶然の影響が大きく、傾向とは断定できません。
    </p>
  );
}

export function Pager({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-end gap-2 pt-3 text-xs">
      {page > 1 ? (
        <DashLink href={hrefFor(page - 1)} className="rounded-full px-3 py-1 bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--line)]">
          前へ
        </DashLink>
      ) : null}
      <span className="tabular-nums text-[var(--text-dim)]">
        {page} / {pages}
      </span>
      {page < pages ? (
        <DashLink href={hrefFor(page + 1)} className="rounded-full px-3 py-1 bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--line)]">
          次へ
        </DashLink>
      ) : null}
    </nav>
  );
}
