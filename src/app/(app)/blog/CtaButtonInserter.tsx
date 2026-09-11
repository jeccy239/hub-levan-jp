"use client";

import { useState } from "react";
import type { BlogEditorHandle } from "./BlogEditor";

// 「[WEBRISを無料ではじめる](https://webris.levan.jp/)」のような誘導リンクを
// ただのテキストリンクではなくボタンにしたい、という要望への対応。
//
// WEBRISの公開ページはMarkdown中の生HTMLをそのまま出力する（動作確認済み）ので、
// インラインスタイル付きの <a> を本文に挿入すれば見た目上のボタンになる。

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildButtonHtml(label: string, url: string): string {
  return (
    `<div style="text-align:center;margin:28px 0">` +
    `<a href="${escapeHtml(url)}" style="display:inline-block;background:#0071e3;color:#ffffff;` +
    `padding:14px 32px;border-radius:24px;text-decoration:none;font-weight:bold;font-size:15px">` +
    `${escapeHtml(label)}</a></div>`
  );
}

export default function CtaButtonInserter({
  getEditor,
}: {
  getEditor: () => BlogEditorHandle | null;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("WEBRISを無料ではじめる");
  const [url, setUrl] = useState("https://webris.levan.jp/");

  function insert() {
    const l = label.trim() || "WEBRISを無料ではじめる";
    const u = url.trim() || "https://webris.levan.jp/";
    getEditor()?.insertHtml(buildButtonHtml(l, u));
    setOpen(false);
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-[var(--text)]"
      >
        <span>CTAボタンを挿入</span>
        <span className="text-[var(--text-dim)]">{open ? "閉じる ▲" : "開く ▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[var(--line)] pt-3 space-y-3">
          <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
            リンクをボタンの見た目にしてカーソル位置に挿入します。Markdownの
            <code className="mx-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono">
              [文言](URL)
            </code>
            のようなただのリンクより目立たせたいときに。
          </p>
          <p className="text-[11px] text-[var(--gold)] leading-relaxed">
            挿入すると自動でMarkdown表示に切り替わります。装飾が消えてしまうため、
            <strong>挿入後はWYSIWYGに戻さずそのまま保存・公開してください</strong>
            （見え方は公開ページ側の装飾で決まるので、Markdown表示のままで問題ありません）。
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] text-[var(--text-dim)]">ボタンの文言</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--line)] px-2.5 py-2 text-xs bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-[var(--text-dim)]">リンク先URL</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--line)] px-2.5 py-2 text-xs font-mono bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </label>
          </div>

          <div className="flex justify-center py-1">
            <span
              className="inline-block rounded-full bg-[#0071e3] px-5 py-2.5 text-[13px] font-bold text-white"
              aria-hidden
            >
              {label.trim() || "WEBRISを無料ではじめる"}
            </span>
          </div>

          <button
            type="button"
            onClick={insert}
            className="w-full text-sm font-medium px-4 py-2 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] transition-colors"
          >
            本文に挿入
          </button>
        </div>
      )}
    </div>
  );
}
