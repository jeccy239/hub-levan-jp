"use client";

import { useState } from "react";
import type { BlogEditorHandle } from "./BlogEditor";

// 本文中の見出し(##/###)から目次を自動生成する。
//
// `[目次]` とだけ書いた行を本文中に置くと、##のような記法としてそこに目次が
// 展開される。書いていなければ本文の先頭に挿入する。
//
// WEBRISの公開ページはMarkdown中の生HTMLをそのまま出力する。既存の公開記事
// （例: /blog/llmo-getting-started 相当）に実際に埋め込まれた目次を直接確認した
// ところ、インラインstyle属性の`list-style:none`はToast UIエディタのプレビューでは
// 無視されるが、WEBRIS公開ページ側ではちゃんと効いていた（プレビューだけが
// 独自にサニタイズしている＝プレビューの見た目とWEBRIS実機の見た目は別物）。
// この実績から、見た目の基本部分は必ずインラインstyleで組み、崩れても機能に
// 影響しない「おまけ」としてのみ<style>タグでホバー演出を追加する
// （<style>が万一無視されても静的な見た目のまま壊れず表示される設計）。
//
// リンク先には `<a name="...">` アンカーを使う。href="#name" はid同様name属性の
// アンカーへもジャンプできるため、WEBRIS側の見出しレンダリングがid付きかどうかに
// 依存しない。
//
// 再実行すると前回挿入した目次・アンカーを検出して置き換える（累積しない）。
//
// H2見出しには①②③...の丸数字を自動で採番する（目次・本文の両方）。プレーンな
// 半角数字(1,2,3)は使わない — 著者が見出しに手打ちで通し番号（1, 2, 3...）を
// 付けている記事があり、同じ半角数字の自動採番だと「11」「22」のように連結して
// 二重表示になってしまったため。丸数字なら見た目上も衝突しない。
// 自動採番した①②③は<span class="NUM_CLASS">で囲み、再実行時にそれだけを検出して
// 除去できるようにしている（著者が手打ちした①②と区別するため。手打ちのものは
// スタイルを持たないただのテキストなので誤って消さない）。

const TOC_START = "<!-- levanhub-toc:start -->";
const TOC_END = "<!-- levanhub-toc:end -->";
const ANCHOR_PREFIX = "levanhub-toc-";
const BADGE_CLASS = "levanhub-toc-heading-badge";
const NUM_CLASS = "levanhub-toc-num";
const MARKER = "[目次]";

const CIRCLED_DIGITS = [
  "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩",
  "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳",
];

function circledNumber(n: number): string {
  return CIRCLED_DIGITS[n - 1] ?? `(${n})`;
}

type Heading = { level: 2 | 3; text: string; anchor: string };

function escapeHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function stripPreviousToc(md: string): string {
  return md
    .replace(new RegExp(`${TOC_START}[\\s\\S]*?${TOC_END}\\n*`, "g"), "")
    .replace(new RegExp(`<a name="${ANCHOR_PREFIX}\\d+"></a>\\n*`, "g"), "")
    .replace(new RegExp(`^(#{2,3}\\s+)<span class="${BADGE_CLASS}"[^>]*>\\d+</span>\\s*`, "gm"), "$1")
    .replace(new RegExp(`^(#{2,3}\\s+)<span class="${NUM_CLASS}">[^<]*</span>\\s*`, "gm"), "$1");
}

function extractHeadings(md: string): Heading[] {
  const headings: Heading[] = [];
  let n = 0;
  for (const line of md.split("\n")) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) continue;
    n++;
    headings.push({ level: m[1].length as 2 | 3, text: m[2].trim(), anchor: `${ANCHOR_PREFIX}${n}` });
  }
  return headings;
}

/** 各見出しの直前にアンカーを差し込み、H2見出しには丸数字（①②③...）を自動で
 *  差し込む。丸数字はNUM_CLASSのspanで囲み、再実行時に検出・除去できるようにする。 */
function decorateHeadings(md: string): string {
  let n = 0;
  let topIndex = 0;
  return md.replace(/^(#{2,3})(\s+)(.+)$/gm, (_line, hashes: string, spacing: string, text: string) => {
    n++;
    const anchor = `${ANCHOR_PREFIX}${n}`;
    let prefix = "";
    if (hashes.length === 2) {
      topIndex++;
      prefix = `<span class="${NUM_CLASS}">${circledNumber(topIndex)}</span> `;
    }
    return `<a name="${anchor}"></a>\n\n${hashes}${spacing}${prefix}${text}`;
  });
}

// 基本の見た目は必ずインラインstyleで完結させる（class名は<style>が効いた場合の
// ホバー演出専用で、無視されても静的な見た目のまま壊れず表示される）。
const LINK_STYLE =
  "color:#333;text-decoration:none;font-size:14px;line-height:22px;display:inline-block;" +
  "transition:color .15s ease,transform .15s ease";

function tocLink(anchor: string, text: string): string {
  return (
    `<a href="#${anchor}" class="levanhub-toc-link" style="${LINK_STYLE}">` +
    `${escapeHtml(text)}</a>`
  );
}

/** H2は丸数字、H3は三角ブレットで表現する2階層のリストを組む。
 *  各<li>自体はflexにしない（flexにすると、あとに続くネストした<ul>まで横並びの
 *  flexアイテム扱いになってしまい、右にズレて表示される）。ブレット+リンクだけを
 *  内側の<div>でflexにし、ネストした<ul>はその外・<li>直下のブロックとして続ける。 */
function buildTocList(headings: Heading[]): string {
  let html = "";
  let topOpen = false;
  let subOpen = false;
  let topIndex = 0;

  for (const h of headings) {
    if (h.level === 2) {
      if (subOpen) {
        html += "</ul>";
        subOpen = false;
      }
      if (topOpen) html += "</li>";
      topIndex++;
      html +=
        `<li style="list-style:none;margin:0 0 10px">` +
        `<div style="display:flex;align-items:flex-start;gap:8px">` +
        `<span style="flex:none;color:#9ca3af;font-size:13px;margin-top:3px">${circledNumber(topIndex)}</span>` +
        tocLink(h.anchor, h.text) +
        `</div>`;
      topOpen = true;
    } else {
      if (!subOpen) {
        html += '<ul style="list-style:none;margin:6px 0 0;padding:0 0 0 32px">';
        subOpen = true;
      }
      html +=
        `<li style="list-style:none;margin:0 0 8px">` +
        `<div style="display:flex;align-items:flex-start;gap:8px">` +
        `<span style="flex:none;color:#9ca3af;font-size:10px;margin-top:5px">▶</span>` +
        `${tocLink(h.anchor, h.text)}</div></li>`;
    }
  }
  if (subOpen) html += "</ul>";
  if (topOpen) html += "</li>";

  return `<ul style="list-style:none;margin:0;padding:0">${html}</ul>`;
}

function buildTocHtml(headings: Heading[]): string {
  return (
    `${TOC_START}\n` +
    // ホバー時の色・動きだけを担う「おまけ」の<style>。無視されても静的な
    // 見た目のまま壊れないよう、レイアウトに関わる指定はここに置かない。
    `<style>.levanhub-toc-link:hover{color:#0071e3!important;transform:translateX(3px)}</style>` +
    `<div style="border:1px solid #e5e5e5;border-radius:12px;padding:20px 24px;margin:0 0 28px;` +
    `width:100%;box-sizing:border-box">` +
    `<p style="font-weight:700;font-size:15px;margin:0 0 14px;color:#111">目次</p>` +
    `${buildTocList(headings)}</div>\n` +
    TOC_END
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

    const withAnchors = decorateHeadings(cleaned);
    const toc = buildTocHtml(headings);

    // 本文中に [目次] という行があればそこに展開する。無ければ先頭に差し込む。
    const markerLine = new RegExp(`^\\s*${MARKER.replace(/[[\]]/g, "\\$&")}\\s*$`, "m");
    const result = markerLine.test(withAnchors)
      ? withAnchors.replace(markerLine, toc)
      : `${toc}\n\n${withAnchors}`;

    editor.setMarkdown(result);
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
            本文中の見出し（## / ###）から目次を自動生成します。本文中に
            <code className="mx-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono">[目次]</code>
            とだけ書いた行があれば、そこに目次を展開します（<code className="mx-1 rounded bg-[var(--surface-2)] px-1 font-mono">##</code>
            と同じように行の先頭に単独で書いてください）。書いていない場合は本文の先頭に挿入します。
          </p>
          <p className="text-[11px] text-[var(--gold)] leading-relaxed">
            挿入すると自動でMarkdown表示に切り替わります。
            <strong>挿入後はWYSIWYGに戻さずそのまま保存・公開してください</strong>
            （WYSIWYGに戻すとリンク用のHTMLが失われます）。
          </p>
          <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
            すでに目次がある状態でもう一度実行すると、見出しの追加・変更に合わせて作り直します。
          </p>
          <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
            本文中の見出し（##）の横にも、目次と同じ①②③の丸数字を自動で表示します。
          </p>
          {error && <p className="text-[11px] text-[var(--danger)] leading-relaxed">{error}</p>}
          <button
            type="button"
            onClick={insert}
            className="w-full text-sm font-medium px-4 py-2 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] transition-colors"
          >
            目次を挿入・更新
          </button>
        </div>
      )}
    </div>
  );
}
