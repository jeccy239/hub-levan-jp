"use client";

import { useState, useTransition } from "react";
import { changePasswordAction } from "./actions";

const input =
  "mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]";

export default function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const ready = current.length > 0 && next.length > 0 && confirm.length > 0;

  function submit() {
    setStatus(null);
    const fd = new FormData();
    fd.set("currentPassword", current);
    fd.set("newPassword", next);
    fd.set("confirmPassword", confirm);

    startTransition(async () => {
      const r = await changePasswordAction(fd);
      if (!r.ok) {
        setStatus({ ok: false, text: r.error });
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setStatus({ ok: true, text: "パスワードを変更しました。" });
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm p-5 space-y-4">
      <h2 className="text-sm font-semibold text-[var(--text)]">パスワード変更</h2>

      <label className="block">
        <span className="text-xs font-medium text-[var(--text-dim)]">現在のパスワード</span>
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className={input}
        />
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-[var(--text-dim)]">新しいパスワード</span>
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={input}
          />
          <span className="mt-1 block text-[11px] text-[var(--text-dim)]">8文字以上</span>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--text-dim)]">新しいパスワード（確認）</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={input}
          />
          {confirm.length > 0 && confirm !== next && (
            <span className="mt-1 block text-[11px] text-[var(--danger)]">一致していません</span>
          )}
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !ready}
          className="text-sm font-medium px-5 py-2.5 rounded-full border border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
        >
          {isPending ? "変更中…" : "パスワードを変更"}
        </button>
        {status && (
          <span className={`text-xs ${status.ok ? "text-[var(--accent-strong)]" : "text-[var(--danger)]"}`}>
            {status.text}
          </span>
        )}
      </div>
    </section>
  );
}
