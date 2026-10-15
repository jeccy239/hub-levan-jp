"use client";

import { useActionState, useState } from "react";
import { createDemo, deleteDemo, type DemoFormState } from "./actions";
import type { SimulatorDemoCatalog } from "@/lib/simulator-studio";

const input =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30";
const button =
  "rounded-xl px-4 py-2 text-sm font-medium bg-[var(--text)] text-[var(--bg)] hover:opacity-90 disabled:opacity-50 transition-opacity";

function Message({ state }: { state: DemoFormState }) {
  if (!state) return null;
  return <p className={`text-sm ${state.ok ? "text-[var(--accent-strong)]" : "text-red-600"}`}>{state.message}</p>;
}

/** デモページの作成フォーム（メールアドレスは不要。テーマとコピー元の店舗を選ぶだけ） */
export function CreateDemoForm({ themes, sources, usedThemeIds }: Omit<SimulatorDemoCatalog, "demos"> & { usedThemeIds: string[] }) {
  const [state, action, pending] = useActionState<DemoFormState, FormData>(createDemo, null);
  const available = themes.filter((t) => !usedThemeIds.includes(t.id));
  const [themeId, setThemeId] = useState(available[0]?.id ?? "");
  const theme = themes.find((t) => t.id === themeId);
  if (available.length === 0) return <p className="text-sm text-[var(--text-dim)]">すべてのテーマにデモページがあります。作り直す場合は一覧から削除してください。</p>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="themeLabel" value={theme?.label ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs text-[var(--text-dim)]">テーマ</span>
          <select name="themeId" value={themeId} onChange={(e) => setThemeId(e.target.value)} className={input}>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.premium ? "（プレミアム）" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs text-[var(--text-dim)]">コピー元の店舗（車両・カラー・ページ構成・画像を複製）</span>
          <select name="sourceTenantId" className={input} required defaultValue="">
            <option value="" disabled>
              選択してください
            </option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}（{s.slug}）{s.isDemo ? " ・デモ" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs text-[var(--text-dim)]">店舗名（空欄なら「{theme?.label ?? "テーマ名"} DEMO」）</span>
          <input name="name" maxLength={60} placeholder={`${theme?.label ?? ""} DEMO`} className={input} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs text-[var(--text-dim)]">URL（{"{URL}"}.simulatorstudio.jp。空欄なら自動）</span>
          <input name="slug" maxLength={32} pattern="[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]" placeholder={`${themeId.toLowerCase().replace(/_/g, "-")}-demo`} className={input} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={button}>
          {pending ? "作成中…（画像の複製に少し時間がかかります）" : "デモページを作成"}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function DeleteDemoButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<DemoFormState, FormData>(deleteDemo, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`「${name}」を削除しますか？\n車両・画像などデモページの内容もすべて削除されます。`)) e.preventDefault();
      }}
      className="inline-flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
        {pending ? "削除中…" : "削除"}
      </button>
      {state && !state.ok && <span className="text-xs text-red-600">{state.message}</span>}
    </form>
  );
}
