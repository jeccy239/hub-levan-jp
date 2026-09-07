"use client";

import { useState, useTransition } from "react";
import { runProspectingAction } from "./actions";

// JIS X 0401 都道府県コード
const PREFECTURES = [
  { code: "13", label: "東京都" },
  { code: "27", label: "大阪府" },
  { code: "23", label: "愛知県" },
  { code: "14", label: "神奈川県" },
  { code: "40", label: "福岡県" },
  { code: "01", label: "北海道" },
  { code: "26", label: "京都府" },
  { code: "28", label: "兵庫県" },
];

type Summary = {
  created: number;
  examined: number;
  skippedNoSite: number;
  skippedUnreachable: number;
  skippedExisting: number;
  withEmail: number;
};

export default function ProspectingPanel() {
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefecture, setPrefecture] = useState("13");
  const [page, setPage] = useState(1);

  function run() {
    setSummary(null);
    setError(null);
    const fd = new FormData();
    fd.set("prefecture", prefecture);
    fd.set("page", String(page));
    startTransition(async () => {
      const r = await runProspectingAction(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPage((p) => p + 1);
      setSummary(r);
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm p-5">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">新規リサーチ</h2>
          <p className="text-xs text-[var(--text-dim)] mt-1 max-w-md">
            gBizINFOから実在企業を取得し、各社サイトを解析して導入ツール・SEO課題・公開問い合わせ先を収集します。
          </p>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-[var(--text-dim)]">エリア</label>
          <select
            value={prefecture}
            onChange={(e) => {
              setPrefecture(e.target.value);
              setPage(1);
            }}
            className="text-sm rounded-xl border border-[var(--line)] px-3 py-2 bg-[var(--surface)] text-[var(--text)]"
          >
            {PREFECTURES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={run}
            disabled={isPending}
            className="text-sm font-medium px-5 py-2 rounded-full bg-[var(--text)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 whitespace-nowrap"
          >
            {isPending ? "リサーチ中…" : `リサーチ実行（${page}ページ目）`}
          </button>
        </div>
      </div>

      {isPending && (
        <p className="mt-4 text-xs text-[var(--text-dim)]">
          最大10社ぶんのサイトを取得・解析しています。30秒ほどかかることがあります…
        </p>
      )}

      {summary && (
        <div className="mt-4 rounded-xl bg-[var(--accent-tint)] px-4 py-3">
          <div className="text-sm font-medium text-[var(--accent-strong)]">
            {summary.created}社を新規登録しました（うち{summary.withEmail}社はメール送信可能）
          </div>
          <div className="mt-1 text-xs text-[var(--text-dim)]">
            {summary.examined}社を検査 ／ サイト未登録 {summary.skippedNoSite}社・接続できず{" "}
            {summary.skippedUnreachable}社・登録済み {summary.skippedExisting}社をスキップ
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>
      )}
    </section>
  );
}
