"use client";

import { useState, useTransition } from "react";
import { saveThanksEmailConfigAction, sendTestEmailAction } from "../actions";
import { fillPreview } from "./preview";

const TOKENS = ["{{company}}", "{{sender}}", "{{webris_url}}", "{{company_address}}"];

export default function ThanksEmailPanel({
  initial,
}: {
  initial: { enabled: boolean; subject: string; body: string; senderName: string };
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty =
    enabled !== initial.enabled || subject !== initial.subject || body !== initial.body;

  const previewSubject = fillPreview(subject, null, initial.senderName);
  const previewBody = fillPreview(body, null, initial.senderName);

  function save() {
    setStatus(null);
    const fd = new FormData();
    fd.set("enabled", enabled ? "1" : "0");
    fd.set("subject", subject);
    fd.set("body", body);
    startTransition(async () => {
      try {
        const r = await saveThanksEmailConfigAction(fd);
        setStatus({
          kind: "ok",
          text: r.enabled
            ? "保存しました。以降、WEBRISの新規登録を検知すると自動送信されます。"
            : "保存しました。自動送信は無効になっています。",
        });
      } catch (e) {
        setStatus({ kind: "error", text: e instanceof Error ? e.message : "保存に失敗しました。" });
      }
    });
  }

  function testSend() {
    setStatus(null);
    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("body", body);
    fd.set("bodyFormat", "html");
    startTransition(async () => {
      const r = await sendTestEmailAction(fd);
      setStatus(
        r.delivered
          ? { kind: "ok", text: `${r.to} 宛にテスト送信しました。受信箱をご確認ください。` }
          : { kind: "error", text: `テスト送信できませんでした: ${r.reason}` },
      );
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">
            新規登録者への自動サンクスメール
          </h2>
          <p className="text-[12px] text-[var(--text-dim)] mt-0.5">
            WEBRISに新規登録（企業アカウント）があると、この文面を登録者へ自動送信します。
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
              initial.enabled
                ? "bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                : "bg-[var(--surface-2)] text-[var(--text-dim)]"
            }`}
          >
            {initial.enabled ? "自動送信 ON" : "自動送信 OFF"}
          </span>
          <span className="text-[var(--text-dim)] text-xs">{open ? "閉じる" : "開く"}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-[var(--line)] space-y-4">
          <label className="flex items-center gap-2.5 text-sm text-[var(--text)] mt-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4"
            />
            この自動送信を有効にする
          </label>

          <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-[var(--text-dim)]">件名</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              </label>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[var(--text-dim)]">本文（HTML）</span>
                  <span className="text-[11px] text-[var(--text-dim)] font-mono">
                    {TOKENS.join(" ")}
                  </span>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={16}
                  className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 bg-[var(--surface)] text-[var(--text)] font-mono text-[12px] leading-relaxed focus:outline-none focus:border-[var(--accent)]"
                />
                <p className="mt-1.5 text-[11px] text-[var(--text-dim)]">
                  使える差込変数は上記4つのみ（登録直後に確実に取れる値）。差出人名 {"{{sender}}"} は
                  「{initial.senderName}」になります（環境変数 SUPPORT_SENDER_NAME）。
                  特定電子メール法により {"{{company_address}}"} は必須です。
                </p>
              </div>
            </div>

            <div className="lg:sticky lg:top-6 rounded-xl border border-[var(--line)] overflow-hidden">
              <div className="px-3 py-2 bg-[var(--surface-2)]/60 border-b border-[var(--line)]">
                <div className="text-[11px] text-[var(--text-dim)]">プレビュー（サンプル値）</div>
                <div className="text-xs font-medium text-[var(--text)] mt-0.5 truncate">
                  {previewSubject}
                </div>
              </div>
              <iframe
                title="サンクスメールのプレビュー"
                sandbox=""
                srcDoc={previewBody}
                className="w-full h-[360px] bg-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isPending || !dirty}
              className="text-sm font-medium px-4 py-2 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-40"
            >
              {isPending ? "処理中…" : "保存"}
            </button>
            <button
              type="button"
              onClick={testSend}
              disabled={isPending}
              className="text-sm font-medium px-4 py-2 rounded-full border border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
            >
              自分宛にテスト送信
            </button>
            {dirty && <span className="text-[11px] text-[var(--text-dim)]">未保存の変更があります</span>}
          </div>

          {status && (
            <div
              className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                status.kind === "ok"
                  ? "bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                  : status.kind === "error"
                    ? "bg-[var(--danger-tint)] text-[var(--danger)]"
                    : "bg-[var(--surface-2)] text-[var(--text-dim)]"
              }`}
            >
              {status.text}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
