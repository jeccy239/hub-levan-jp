"use client";

import { useActionState } from "react";
import { toggleSecretPlan, type SecretPlanState } from "./actions";

const button =
  "rounded-xl px-4 py-2 text-sm font-medium bg-[var(--text)] text-[var(--bg)] hover:opacity-90 disabled:opacity-50 transition-opacity";
const subtle =
  "rounded-xl px-4 py-2 text-sm font-medium border border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-50 transition-colors";

export function SecretPlanForm({ id, name, enabled, hasSubscription }: { id: string; name: string; enabled: boolean; hasSubscription: boolean }) {
  const [state, action, pending] = useActionState<SecretPlanState, FormData>(toggleSecretPlan, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const msg = enabled
          ? `「${name}」のシークレットプランを解除しますか？\n店舗は解約済みと同じ扱いになり、お試しと同じ機能制限に戻ります。`
          : `「${name}」にシークレットプランを付与しますか？\nプレミアムと同じ機能を無料・無期限で使えるようになります。`;
        if (!confirm(msg)) e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <span className="text-sm text-[var(--text)]">{enabled ? "付与中" : "未付与"}</span>
      <button type="submit" disabled={pending || (!enabled && hasSubscription)} className={enabled ? subtle : button}>
        {pending ? "処理中…" : enabled ? "解除する" : "付与する"}
      </button>
      {!enabled && hasSubscription && <span className="text-xs text-[var(--text-dim)]">有料プランを契約中のため付与できません（店舗側で解約後に付与してください）</span>}
      {state && <span className={`text-sm ${state.ok ? "text-[var(--accent-strong)]" : "text-red-600"}`}>{state.message}</span>}
    </form>
  );
}
