"use client";

import { useState, useTransition } from "react";
import { runProspectingAction } from "./actions";

// JIS X 0401 都道府県コード（主要な営業対象エリアのみ）
const PREFECTURES = [
  { code: "13", label: "東京都" },
  { code: "27", label: "大阪府" },
  { code: "23", label: "愛知県" },
  { code: "14", label: "神奈川県" },
  { code: "40", label: "福岡県" },
  { code: "01", label: "北海道" },
];

export default function ProspectingButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefecture, setPrefecture] = useState("13");
  const [page, setPage] = useState(1);

  return (
    <div className="flex items-center gap-2">
      <select
        value={prefecture}
        onChange={(e) => setPrefecture(e.target.value)}
        className="text-sm rounded-full border border-[var(--line)] px-3 py-2 bg-transparent text-[var(--text)]"
      >
        {PREFECTURES.map((p) => (
          <option key={p.code} value={p.code}>
            {p.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
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
            setPage((p) => p + 1); // 次回は次ページを見に行く
            setMessage(
              `${r.created}社を登録（${r.examined}社を検査・` +
                `サイト無し${r.skippedNoSite}・接続不可${r.skippedUnreachable}・登録済${r.skippedExisting}／` +
                `メアド取得${r.withEmail}社）`,
            );
          });
        }}
        className="text-sm font-medium px-4 py-2 rounded-full border border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {isPending ? "リサーチ中…" : "リサーチ実行"}
      </button>
      {message && <span className="text-xs text-[var(--text-dim)] max-w-56">{message}</span>}
      {error && <span className="text-xs text-[var(--danger)] max-w-56">{error}</span>}
    </div>
  );
}
