"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction } from "./actions";

const input =
  "mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]";

export default function ProfileForm({ name: initialName, email: initialEmail }: { name: string; email: string }) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const dirty = name !== initialName || email !== initialEmail;

  function save() {
    setStatus(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("email", email);

    startTransition(async () => {
      const r = await updateProfileAction(fd);
      if (!r.ok) {
        setStatus({ ok: false, text: r.error });
        return;
      }
      // サイドバーはDBから名前を読むサーバーコンポーネントなので、
      // 再取得すれば新しい表示名がすぐ反映される。
      router.refresh();
      setStatus({
        ok: true,
        text: r.emailChanged
          ? "保存しました。次回のログインからは新しいメールアドレスを使用してください。"
          : "保存しました。",
      });
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm p-5 space-y-4">
      <h2 className="text-sm font-semibold text-[var(--text)]">基本情報</h2>

      <label className="block">
        <span className="text-xs font-medium text-[var(--text-dim)]">表示名</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="井手" />
        <span className="mt-1 block text-[11px] text-[var(--text-dim)]">
          営業メールの本文・署名に差し込まれます（例:「株式会社LEVANの{name || "…"}と申します」）。
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-[var(--text-dim)]">メールアドレス（ログインID）</span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className={input} type="email" />
        <span className="mt-1 block text-[11px] text-[var(--text-dim)]">
          変更するとログインに使うアドレスも変わります。
        </span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending || !dirty}
          className="text-sm font-medium px-5 py-2.5 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-40"
        >
          {isPending ? "保存中…" : "保存"}
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
