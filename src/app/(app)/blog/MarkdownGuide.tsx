"use client";

import { useState } from "react";

// エディタ左下の「Markdown」タブで直接編集する人向けの早見表。
// ここに載せている記法はすべて Toast UI Editor（WYSIWYG側）のツールバーと
// 対応しており、GFM（表・打ち消し線・タスクリスト）にも対応している。

const ROWS: { input: string; result: string; note?: string }[] = [
  { input: "# 見出し1", result: "大見出し", note: "本文中では使わない（記事タイトルと重複するため）" },
  { input: "## 見出し2", result: "中見出し", note: "節の区切りに使う" },
  { input: "### 見出し3", result: "小見出し" },
  { input: "**太字**", result: "太字" },
  { input: "*斜体*", result: "斜体" },
  { input: "~~打ち消し~~", result: "打ち消し線" },
  { input: "- 項目", result: "箇条書き" },
  { input: "1. 項目", result: "番号付きリスト" },
  { input: "- [ ] 未完了\n- [x] 完了", result: "チェックリスト" },
  { input: "> 引用文", result: "引用" },
  { input: "`コード`", result: "インラインコード" },
  { input: "```\nコードブロック\n```", result: "コードブロック" },
  { input: "[リンク文言](https://example.com)", result: "リンク" },
  { input: "![説明](画像の公開URL)", result: "画像", note: "説明（alt）は空にせず、画像の内容を書く" },
  { input: "---", result: "区切り線" },
  {
    input: "| 見出し | 見出し |\n| --- | --- |\n| A | B |",
    result: "表（GFM）",
  },
];

export default function MarkdownGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-[var(--text)]"
      >
        <span>Markdownの書き方（早見表）</span>
        <span className="text-[var(--text-dim)]">{open ? "閉じる ▲" : "開く ▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[var(--line)] pt-3 space-y-3">
          <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
            通常はエディタ上部のツールバーを使えば十分ですが、左下の
            <span className="mx-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono">Markdown</span>
            タブに切り替えると、下の記法をそのままキーボードで入力できます。行の先頭に書くのが基本です。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="text-left text-[var(--text-dim)]">
                  <th className="pb-1.5 pr-3 font-medium">入力する記法</th>
                  <th className="pb-1.5 font-medium">表示結果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {ROWS.map((r) => (
                  <tr key={r.input}>
                    <td className="py-2 pr-3 align-top">
                      <code className="block whitespace-pre-wrap rounded-md bg-[var(--surface-2)] px-2 py-1 font-mono text-[11px] text-[var(--text)]">
                        {r.input}
                      </code>
                    </td>
                    <td className="py-2 align-top text-[var(--text)]">
                      {r.result}
                      {r.note && <span className="block text-[11px] text-[var(--text-dim)] mt-0.5">{r.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
