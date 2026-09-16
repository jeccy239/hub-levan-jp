"use client";

import { useActionState } from "react";
import { AD_CHANNELS } from "@/lib/webrisAnalytics/adChannels";
import { addAdSpend, deleteAdSpend, generateSummary, refreshDashboard, type ActionState } from "./actions";

export type RangeParams = { range: string; compare: string; from?: string; to?: string };

function RangeFields({ params }: { params: RangeParams }) {
  return (
    <>
      <input type="hidden" name="range" value={params.range} />
      <input type="hidden" name="compare" value={params.compare} />
      {params.from && <input type="hidden" name="from" value={params.from} />}
      {params.to && <input type="hidden" name="to" value={params.to} />}
    </>
  );
}

function Message({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <span role="status" className={`text-xs ${state.ok ? "text-[var(--text-dim)]" : "text-[var(--danger)]"}`}>
      {state.message}
    </span>
  );
}

export function RefreshButton({ params }: { params: RangeParams }) {
  const [state, action, pending] = useActionState(refreshDashboard, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <RangeFields params={params} />
      {state && !state.ok && <Message state={state} />}
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium px-3 py-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]"
      >
        {pending ? "取得中…" : "最新に更新"}
      </button>
    </form>
  );
}

export function GenerateSummaryButton({ params, hasSummary }: { params: RangeParams; hasSummary: boolean }) {
  const [state, action, pending] = useActionState(generateSummary, null);
  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-2">
      <RangeFields params={params} />
      <Message state={state} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
      >
        {pending ? "AIが分析中…" : hasSummary ? "AI要約を作り直す" : "AIで要約する"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--text)]";

export function AdSpendForm({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const [state, action, pending] = useActionState(addAdSpend, null);
  return (
    <form action={action} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
      <label className="col-span-2 md:col-span-1 text-[11px] text-[var(--text-dim)]">
        媒体
        <select name="channel" className={`${inputClass} mt-1`} defaultValue="instagram_paid">
          {AD_CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] text-[var(--text-dim)]">
        開始日
        <input type="date" name="periodStart" required defaultValue={defaultStart} className={`${inputClass} mt-1`} />
      </label>
      <label className="text-[11px] text-[var(--text-dim)]">
        終了日
        <input type="date" name="periodEnd" required defaultValue={defaultEnd} className={`${inputClass} mt-1`} />
      </label>
      <label className="text-[11px] text-[var(--text-dim)]">
        金額（円・税込）
        <input type="text" inputMode="numeric" name="amountJpy" required placeholder="30000" className={`${inputClass} mt-1 tabular-nums`} />
      </label>
      <label className="text-[11px] text-[var(--text-dim)]">
        メモ
        <input type="text" name="memo" maxLength={200} placeholder="キャンペーン名など" className={`${inputClass} mt-1`} />
      </label>
      <div className="col-span-2 md:col-span-1 flex flex-col items-stretch gap-1">
        <button
          type="submit"
          disabled={pending}
          className="text-sm font-semibold px-4 py-1.5 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
        >
          {pending ? "登録中…" : "登録"}
        </button>
      </div>
      {state && (
        <div className="col-span-2 md:col-span-6">
          <Message state={state} />
        </div>
      )}
    </form>
  );
}

export function DeleteAdSpendButton({ id }: { id: string }) {
  return (
    <form
      action={deleteAdSpend}
      onSubmit={(e) => {
        if (!confirm("この広告費の記録を削除しますか？")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs text-[var(--text-dim)] hover:text-[var(--danger)]">
        削除
      </button>
    </form>
  );
}
