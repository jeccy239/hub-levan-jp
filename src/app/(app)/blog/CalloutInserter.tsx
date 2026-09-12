"use client";

import { useState } from "react";
import type { BlogEditorHandle } from "./BlogEditor";

// ハイライトボックス（コールアウト）を本文に挿入するUI。
// CTAボタンと同様、インラインスタイル付きのHTMLブロックを挿入することで
// WEBRIS公開ページ上でリッチなレイアウトを実現する。

type CalloutType = {
  id: string;
  label: string;
  emoji: string;
  borderColor: string;
  bgColor: string;
  titleColor: string;
  defaultTitle: string;
};

const CALLOUT_TYPES: CalloutType[] = [
  {
    id: "point",
    label: "ポイント（黄）",
    emoji: "💡",
    borderColor: "#f59e0b",
    bgColor: "#fefce8",
    titleColor: "#92400e",
    defaultTitle: "ポイント",
  },
  {
    id: "info",
    label: "補足（青）",
    emoji: "ℹ️",
    borderColor: "#3b82f6",
    bgColor: "#eff6ff",
    titleColor: "#1e40af",
    defaultTitle: "補足",
  },
  {
    id: "warning",
    label: "注意（オレンジ）",
    emoji: "⚠️",
    borderColor: "#f97316",
    bgColor: "#fff7ed",
    titleColor: "#9a3412",
    defaultTitle: "注意",
  },
  {
    id: "check",
    label: "まとめ（緑）",
    emoji: "✅",
    borderColor: "#22c55e",
    bgColor: "#f0fdf4",
    titleColor: "#166534",
    defaultTitle: "まとめ",
  },
];

function buildCalloutHtml(type: CalloutType, title: string, body: string): string {
  const t = (title || type.defaultTitle).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const b = (body || "ここに本文を入力してください").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return (
    `<div style="background:${type.bgColor};border-left:4px solid ${type.borderColor};` +
    `padding:16px 20px;border-radius:0 8px 8px 0;margin:24px 0">` +
    `<p style="margin:0 0 6px;font-weight:700;color:${type.titleColor};font-size:14px">` +
    `${type.emoji} ${t}</p>` +
    `<p style="margin:0;color:#374151;font-size:14px;line-height:1.8">${b}</p>` +
    `</div>`
  );
}

export default function CalloutInserter({
  getEditor,
}: {
  getEditor: () => BlogEditorHandle | null;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>("point");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const type = CALLOUT_TYPES.find((t) => t.id === selected) ?? CALLOUT_TYPES[0];

  function insert() {
    const html = buildCalloutHtml(type, title, body);
    getEditor()?.insertHtml(html);
    setTitle("");
    setBody("");
    setOpen(false);
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-[var(--text)]"
      >
        <span>ハイライトボックスを挿入</span>
        <span className="text-[var(--text-dim)]">{open ? "閉じる ▲" : "開く ▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[var(--line)] pt-3 space-y-3">
          <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
            ポイント・補足・注意・まとめなどを目立つボックスで表示します。カーソル位置に挿入されます。
          </p>

          {/* タイプ選択 */}
          <div className="grid grid-cols-2 gap-1.5">
            {CALLOUT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t.id)}
                className={`text-[11px] px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                  selected === t.id
                    ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                    : "border-[var(--line)] text-[var(--text-dim)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          {/* タイトル・本文 */}
          <label className="block">
            <span className="text-[11px] text-[var(--text-dim)]">タイトル（空欄で「{type.defaultTitle}」）</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type.defaultTitle}
              className="mt-1 w-full rounded-lg border border-[var(--line)] px-2.5 py-2 text-xs bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-[var(--text-dim)]">本文</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="ボックスの内容を入力…"
              className="mt-1 w-full rounded-lg border border-[var(--line)] px-2.5 py-2 text-xs bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] resize-none"
            />
          </label>

          {/* プレビュー */}
          <div
            style={{
              background: type.bgColor,
              borderLeft: `4px solid ${type.borderColor}`,
              padding: "12px 16px",
              borderRadius: "0 8px 8px 0",
            }}
          >
            <p style={{ margin: "0 0 4px", fontWeight: 700, color: type.titleColor, fontSize: 12 }}>
              {type.emoji} {title || type.defaultTitle}
            </p>
            <p style={{ margin: 0, color: "#374151", fontSize: 12, lineHeight: 1.7 }}>
              {body || "ここに本文を入力してください"}
            </p>
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
