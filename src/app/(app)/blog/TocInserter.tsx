"use client";

import { useState } from "react";
import type { BlogEditorHandle } from "./BlogEditor";

// 本文中の見出し(##/###)から目次を自動生成し、本文の先頭に挿入する。
//
// WEBRISの公開ページはMarkdown中の生HTMLをそのまま出力する（CTAボタンで
// 動作確認済み）ため、目次のリンク先には `<a name="...">` アンカーを使う。
// href="#name" は id と同様に name 属性のアンカーへもジャンプできるため、
// WEBRIS側の見出しレンダリングがid付きかどうかに依存せず動く。
//
// 再実行すると前回挿入した目次・アンカーを検出して置き換える（累積しない）。

const TOC_START = "<!-- levanhub-toc:start -->";
const TOC_END = "<!-- levanhub-toc:end -->";
const ANCHOR_PREFIX = "levanhub-toc-";

type Heading = { level: 2 | 3; text: string; anchor: string };

function stripPreviousToc(md: string): string {
  return md
    .replace(new RegExp(`${TOC_START}[\\s\\S]*?${TOC_END}\\n*`, "g"), "")
    .replace(new RegExp(`<a name="${ANCHOR_PREFIX}\\d+"></a>\\n*`, "g"), "");
}

function extractHeadings(md: string): Heading[] {
  const headings: Heading[] = [];
  const lines = md.split("\n");
  let n = 0;
  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) continue;
    n++;
    headings.push({
      level: m[1].length as 2 | 3,
      text: m[2].trim(),
      anchor: `${ANCHOR_PREFIX}${n}`,
    });
  }
  return headings;
}

function insertAnchors(md: string): string {
  let n = 0;
  return md.replace(/^(#{2,3})\s+(.+)$/gm, (line) => {
    n++;
    return `<a name="${ANCHOR_PREFIX}${n}"></a>\n\n${line}`;
  });
}

function buildTocHtml(headings: Heading[]): string {
  const items = headings
    .map(
      (h) =>
        `<li style="margin:${h.level === 3 ? "4px 0 4px 18px" : "6px 0"};font-size:${h.level === 3 ? "13px" : "14px"}">` +
        `<a href="#${h.anchor}" style="color:#0071e3;text-decoration:none">${h.text}</a></li>`,
    )
    .join("");
  return (
    `${TOC_START}\n` +
    `<div style="border:1px solid #e5e5e5;border-radius:12px;padding:16px 20px;margin:0 0 28px">` +
    `<p style="font-weight:bold;margin:0 0 8px;font-size:14px">目次</p>` +
    `<ul style="margin:0;padding:0;list-style:none">${items}</ul>` +
    `</div>\n${TOC_END}`
  );
}

export default function TocInserter({ getEditor }: { getEditor: () => BlogEditorHandle | null }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function insert() {
    const editor = getEditor();
    if (!editor) return;
    setError(null);

    const cleaned = stripPreviousToc(editor.getMarkdown());
    const headings = extractHeadings(cleaned);
    if (headings.length === 0) {
      setError("本文に見出し（##/###）が見つかりませんでした。見出しを追加してから実行してください。");
      return;
    }

    const withAnchors = insertAnchors(cleaned);
    const toc = buildTocHtml(headings);
    editor.setMarkdown(`${toc}\n\n${withAnchors}`);
    setOpen(false);
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-[var(--text)]"
      >
        <span>目次を挿入</span>
        <span className="text-[var(--text-dim)]">{open ? "閉じる ▲" : "開く ▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[var(--line)] pt-3 space-y-3">
          <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
            本文中の見出し（## / ###）から目次を自動生成し、本文の先頭に挿入します。
            見出しにはジャンプ用のリンク先を自動で埋め込みます。
          </p>
          <p className="text-[11px] text-[var(--gold)] leading-relaxed">
            挿入すると自動でMarkdown表示に切り替わります。
            <strong>挿入後はWYSIWYGに戻さずそのまま保存・公開してください</strong>
            （WYSIWYGに戻すとリンク用のHTMLが失われます）。
          </p>
          <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
            すでに目次がある状態でもう一度実行すると、見出しの追加・変更に合わせて作り直します。
          </p>
          {error && <p className="text-[11px] text-[var(--danger)] leading-relaxed">{error}</p>}
          <button
            type="button"
            onClick={insert}
            className="w-full text-sm font-medium px-4 py-2 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] transition-colors"
          >
            本文の先頭に目次を挿入
          </button>
        </div>
      )}
    </div>
  );
}
