"use client";

// 記事のSEO状態をその場でチェックする。数値は日本語コンテンツ向けの目安。
// note のような書き味にしても、ここで抜け漏れを可視化して品質を担保する。

type Level = "ok" | "warn" | "bad";
type Check = { level: Level; label: string; hint?: string };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Markdown記法をおおまかに除いた本文の文字数。 */
function plainLength(md: string): number {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, (m) => m.replace(/\]\([^)]*\)/, "").replace(/^\[/, ""))
    .replace(/[#>*_`~\-|]/g, "")
    .replace(/\s+/g, "")
    .length;
}

export function buildChecks(input: {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  coverImageUrl: string;
  body: string;
}): Check[] {
  const checks: Check[] = [];

  const effTitle = (input.metaTitle || input.title).trim();
  if (!effTitle) {
    checks.push({ level: "bad", label: "タイトルが未入力" });
  } else if (effTitle.length > 40) {
    checks.push({
      level: "warn",
      label: `メタタイトルが長い（${effTitle.length}字）`,
      hint: "検索結果では30〜35字前後で切れます。前半に主要キーワードを。",
    });
  } else if (effTitle.length < 10) {
    checks.push({ level: "warn", label: `メタタイトルが短い（${effTitle.length}字）` });
  } else {
    checks.push({ level: "ok", label: `メタタイトル ${effTitle.length}字（${input.metaTitle ? "個別指定" : "本文タイトルを使用"}）` });
  }

  const effDesc = (input.metaDescription || input.excerpt).trim();
  if (!effDesc) {
    checks.push({ level: "warn", label: "メタディスクリプション/抜粋が未入力", hint: "検索結果の説明文になります。80〜120字を推奨。" });
  } else if (effDesc.length > 160) {
    checks.push({ level: "warn", label: `説明文が長い（${effDesc.length}字）`, hint: "120字前後で要点を。" });
  } else if (effDesc.length < 50) {
    checks.push({ level: "warn", label: `説明文が短い（${effDesc.length}字）` });
  } else {
    checks.push({ level: "ok", label: `説明文 ${effDesc.length}字（${input.metaDescription ? "個別指定" : "抜粋を使用"}）` });
  }

  if (!input.slug.trim()) {
    checks.push({ level: "ok", label: "スラッグは自動生成" });
  } else if (!SLUG_RE.test(input.slug.trim())) {
    checks.push({ level: "warn", label: "スラッグは半角英数字とハイフンのみ推奨", hint: "日本語や大文字・記号はURLで崩れます。" });
  } else {
    checks.push({ level: "ok", label: "スラッグの形式OK" });
  }

  checks.push(
    input.coverImageUrl.trim()
      ? { level: "ok", label: "アイキャッチ画像あり（OGP/SNS表示用）" }
      : { level: "warn", label: "アイキャッチ画像が未設定", hint: "SNSでシェアされたときの見え方に影響します。" },
  );

  const hasH2 = /^#{2,3}\s/m.test(input.body);
  const hasH1 = /^#\s/m.test(input.body);
  if (hasH1) {
    checks.push({ level: "warn", label: "本文に H1（# 見出し）があります", hint: "ページのH1は記事タイトルです。本文の見出しは H2（##）から。" });
  } else if (hasH2) {
    checks.push({ level: "ok", label: "見出し（H2〜）で構造化されています" });
  } else {
    checks.push({ level: "warn", label: "本文に見出しがありません", hint: "H2で節を分けると読みやすさと評価が上がります。" });
  }

  const len = plainLength(input.body);
  if (len === 0) {
    checks.push({ level: "bad", label: "本文が未入力" });
  } else if (len < 400) {
    checks.push({ level: "warn", label: `本文が短い（約${len}字）`, hint: "検索意図を満たすなら800字以上が目安。" });
  } else {
    checks.push({ level: "ok", label: `本文 約${len}字` });
  }

  if (/!\[\s*\]\(/.test(input.body)) {
    checks.push({ level: "warn", label: "alt（代替テキスト）が空の画像があります", hint: "画像の内容を短い文で入れると検索・アクセシビリティに有効です。" });
  }

  return checks;
}

const ICON: Record<Level, string> = { ok: "✓", warn: "!", bad: "✕" };
const CLS: Record<Level, string> = {
  ok: "text-[var(--accent-strong)]",
  warn: "text-[var(--gold)]",
  bad: "text-[var(--danger)]",
};

export default function SeoChecklist({ checks }: { checks: Check[] }) {
  const okCount = checks.filter((c) => c.level === "ok").length;
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--text)]">SEO チェック</h2>
        <span className="text-xs text-[var(--text-dim)] tabular-nums">
          {okCount} / {checks.length} OK
        </span>
      </div>
      <ul className="space-y-2">
        {checks.map((c, i) => (
          <li key={i} className="flex gap-2 text-[12px] leading-relaxed">
            <span className={`font-bold ${CLS[c.level]}`}>{ICON[c.level]}</span>
            <span className="min-w-0">
              <span className="text-[var(--text)]">{c.label}</span>
              {c.hint && <span className="block text-[var(--text-dim)]">{c.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
