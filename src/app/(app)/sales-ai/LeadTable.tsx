"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type LeadRow = {
  leadId: string;
  company: string;
  website: string;
  category: string | null;
  score: number | null;
  status: string;
  statusLabel: string;
  tools: string[];
  gapCount: number;
  recipient: string | null;
};

const CATEGORIES = [
  "SEOツール利用企業",
  "ヒートマップツール利用企業",
  "LLMOツール利用企業",
  "広告代理店",
] as const;

const STATUS_STYLE: Record<string, string> = {
  QUALIFIED: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
  CONTACTED: "bg-[var(--gold-tint)] text-[var(--gold)]",
  RESEARCHED: "bg-[var(--surface-2)] text-[var(--text-dim)]",
};

function scoreColor(score: number | null) {
  if (score == null) return "text-[var(--text-dim)]";
  if (score >= 80) return "text-[var(--accent-strong)] font-semibold";
  if (score >= 60) return "text-[var(--text)]";
  return "text-[var(--text-dim)]";
}

export default function LeadTable({ rows, sendableCount }: { rows: LeadRow[]; sendableCount: number }) {
  const [category, setCategory] = useState<string | null>(null);
  const [onlySendable, setOnlySendable] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (category && r.category !== category) return false;
      if (onlySendable && !r.recipient) return false;
      if (q && !r.company.toLowerCase().includes(q) && !r.website.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, category, onlySendable, query]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.category) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return m;
  }, [rows]);

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
      active
        ? "bg-[var(--text)] text-white"
        : "bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]"
    }`;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--text)]">
          営業対象リード
          <span className="ml-2 font-normal text-[var(--text-dim)]">
            {filtered.length}件表示 / 全{rows.length}件・送信可能{sendableCount}件
          </span>
        </h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="会社名・URLで絞り込み"
          className="text-sm rounded-full border border-[var(--line)] px-4 py-1.5 bg-[var(--surface)] text-[var(--text)] w-56 focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setCategory(null)} className={chip(category === null)}>
          すべて {rows.length}
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(category === c ? null : c)}
            className={chip(category === c)}
          >
            {c} {counts.get(c) ?? 0}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOnlySendable((v) => !v)}
          className={`${chip(onlySendable)} ml-auto`}
        >
          {onlySendable ? "✓ " : ""}メール送信可能のみ
        </button>
      </div>

      <div className="overflow-x-auto border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-[var(--text-dim)] border-b border-[var(--line)] bg-[var(--surface-2)]/50">
              <th className="px-4 py-2.5 font-medium">会社</th>
              <th className="px-4 py-2.5 font-medium">検出したツール</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">SEO課題</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">見込み度</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">状態</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.leadId} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]/60 transition-colors">
                <td className="px-4 py-3 max-w-xs">
                  <Link href={`/leads/${r.leadId}`} className="font-medium text-[var(--text)] hover:text-[var(--accent)]">
                    {r.company}
                  </Link>
                  <div className="text-xs text-[var(--text-dim)] truncate mt-0.5">
                    {r.recipient ? (
                      <span title="サイトで公開されている問い合わせ先">✉ {r.recipient}</span>
                    ) : (
                      <span className="opacity-60">公開アドレス無し（フォーム/電話で個別対応）</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {r.tools.slice(0, 3).map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-md text-[11px] bg-[var(--surface-2)] text-[var(--text-dim)] whitespace-nowrap">
                        {t}
                      </span>
                    ))}
                    {r.tools.length > 3 && (
                      <span className="text-[11px] text-[var(--text-dim)]">+{r.tools.length - 3}</span>
                    )}
                    {r.tools.length === 0 && <span className="text-xs text-[var(--text-dim)]">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {r.gapCount > 0 ? (
                    <span className="text-[var(--text)] tabular-nums">
                      {r.gapCount}件
                      <span className="ml-1 text-[11px] text-[var(--gold)]">改善余地</span>
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-dim)]">なし</span>
                  )}
                </td>
                <td className={`px-4 py-3 tabular-nums whitespace-nowrap ${scoreColor(r.score)}`}>
                  {r.score ?? "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[r.status] ?? "bg-[var(--surface-2)] text-[var(--text-dim)]"}`}>
                    {r.statusLabel}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--text-dim)]">
                  {rows.length === 0
                    ? "リードがまだありません。上の「リサーチ実行」から候補企業を発掘してください。"
                    : "条件に合うリードがありません。フィルタを変えてみてください。"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
