"use client";

import { useState, useTransition } from "react";
import { runProspectingAction } from "./actions";

export default function ProspectingButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await runProspectingAction();
            setMessage(`${result.count}社の新規候補を発見しました`);
          });
        }}
        className="text-sm font-medium px-4 py-2 rounded-full border border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
      >
        {isPending ? "リサーチ中…" : "リサーチ実行"}
      </button>
      {message && <span className="text-xs text-[var(--text-dim)]">{message}</span>}
    </div>
  );
}
