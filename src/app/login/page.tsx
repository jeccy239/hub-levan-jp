"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "./actions";

const initialState: { error?: string } = {};

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [state, formAction, pending] = useActionState<typeof initialState, FormData>(
    async (_prev, formData) => {
      const result = await login(formData);
      return result ?? {};
    },
    initialState,
  );

  return (
    <form action={formAction} className="w-full max-w-sm space-y-5">
      <div className="text-center mb-2">
        <div className="font-semibold text-xl text-[var(--text)]">LEVAN ビジネスOS</div>
        <p className="text-sm text-[var(--text-dim)] mt-1">社内アカウントでログイン</p>
      </div>

      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--text-dim)]">メールアドレス</label>
        <input
          name="email"
          type="email"
          required
          autoFocus
          className="w-full border border-[var(--line)] rounded-xl px-3.5 py-2.5 bg-[var(--surface)] text-[var(--text)]"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--text-dim)]">パスワード</label>
        <input
          name="password"
          type="password"
          required
          className="w-full border border-[var(--line)] rounded-xl px-3.5 py-2.5 bg-[var(--surface)] text-[var(--text)]"
        />
      </div>

      {state.error && <p className="text-sm text-[var(--danger)]">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white rounded-xl px-4 py-2.5 font-medium shadow-sm"
      >
        {pending ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
