"use client";

import { useState } from "react";
import { deleteAccountAction } from "../actions";

export default function DeleteAccountForm({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [value, setValue] = useState("");
  const matches = value === orgName;

  return (
    <form
      action={deleteAccountAction}
      onSubmit={(e) => {
        if (!matches || !confirm(`本当に「${orgName}」を完全に削除しますか？この操作は絶対に元に戻せません。`)) {
          e.preventDefault();
        }
      }}
      className="space-y-2"
    >
      <input type="hidden" name="orgId" value={orgId} />
      <label className="text-xs text-[var(--text-dim)]">
        確認のため、会社名「{orgName}」を正確に入力してください
        <input
          name="confirmName"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-full border border-[var(--danger)]/40 rounded-xl px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text)]"
          autoComplete="off"
        />
      </label>
      <button
        type="submit"
        disabled={!matches}
        className="text-sm bg-[var(--danger)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2 font-medium shadow-sm"
      >
        アカウントを完全に削除する
      </button>
    </form>
  );
}
