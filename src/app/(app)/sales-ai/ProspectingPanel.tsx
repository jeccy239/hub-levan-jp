"use client";

import { useState, useTransition } from "react";
import { runProspectingAction, runEcShopProspectingAction } from "./actions";

// JIS X 0401 都道府県コード
const PREFECTURES = [
  { code: "13", label: "東京都" },
  { code: "27", label: "大阪府" },
  { code: "23", label: "愛知県" },
  { code: "14", label: "神奈川県" },
  { code: "40", label: "福岡県" },
  { code: "01", label: "北海道" },
  { code: "26", label: "京都府" },
  { code: "28", label: "兵庫県" },
];

const EC_CATEGORIES = [
  "アクセサリー",
  "ピアス",
  "イヤリング",
  "ネックレス",
  "指輪",
  "ブレスレット",
  "シルバーアクセサリー",
  "天然石アクセサリー",
  "ハンドメイド",
  "レディースファッション",
  "セレクトショップ",
  "革製品",
  "財布",
  "バッグ",
  "キャンドル",
  "インテリア雑貨",
];

const EC_MAX_URLS_PER_RUN = 15;

type Summary = {
  created: number;
  examined: number;
  skippedNoSite: number;
  skippedUnreachable: number;
  skippedExisting: number;
  withEmail: number;
};

type Source = "gbiz" | "ec";

export default function ProspectingPanel() {
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("gbiz");

  const [prefecture, setPrefecture] = useState("13");
  const [gbizPage, setGbizPage] = useState(1);

  const [category, setCategory] = useState(EC_CATEGORIES[0]);
  const [urls, setUrls] = useState("");

  function run() {
    setSummary(null);
    setError(null);

    if (source === "gbiz") {
      const fd = new FormData();
      fd.set("prefecture", prefecture);
      fd.set("page", String(gbizPage));
      startTransition(async () => {
        const r = await runProspectingAction(fd);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setGbizPage((p) => p + 1);
        setSummary(r);
      });
      return;
    }

    const fd = new FormData();
    fd.set("category", category);
    fd.set("urls", urls);
    startTransition(async () => {
      const r = await runEcShopProspectingAction(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setUrls("");
      setSummary(r);
    });
  }

  function switchSource(next: Source) {
    setSource(next);
    setSummary(null);
    setError(null);
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">新規リサーチ</h2>
          <p className="text-xs text-[var(--text-dim)] mt-1 max-w-md">
            {source === "gbiz"
              ? "gBizINFOから実在企業を取得し、各社サイトを解析して導入ツール・SEO課題・公開問い合わせ先を収集します。"
              : "Instagram等で見つけたBASE/Shopify/STORES上の個人ショップURLを貼り付けると、SEO課題と公開連絡先（特定商取引法表記等）を解析します（自動発掘は現時点で未対応）。"}
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] p-1 shrink-0">
          <button
            type="button"
            onClick={() => switchSource("gbiz")}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
              source === "gbiz" ? "bg-[var(--text)] text-white" : "text-[var(--text-dim)]"
            }`}
          >
            実在法人（gBizINFO）
          </button>
          <button
            type="button"
            onClick={() => switchSource("ec")}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
              source === "ec" ? "bg-[var(--text)] text-white" : "text-[var(--text-dim)]"
            }`}
          >
            個人ECショップ（URL貼り付け）
          </button>
        </div>
      </div>

      {source === "gbiz" ? (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-dim)]">エリア</label>
            <select
              value={prefecture}
              onChange={(e) => {
                setPrefecture(e.target.value);
                setGbizPage(1);
              }}
              className="text-sm rounded-xl border border-[var(--line)] px-3 py-2 bg-[var(--surface)] text-[var(--text)]"
            >
              {PREFECTURES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={run}
            disabled={isPending}
            className="text-sm font-medium px-5 py-2 rounded-full bg-[var(--text)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 whitespace-nowrap ml-auto"
          >
            {isPending ? "リサーチ中…" : `リサーチ実行（${gbizPage}ページ目）`}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-dim)]">カテゴリ</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-sm rounded-xl border border-[var(--line)] px-3 py-2 bg-[var(--surface)] text-[var(--text)]"
            >
              {EC_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={`ショップURLを1行に1件、貼り付け（最大${EC_MAX_URLS_PER_RUN}件）\n例:\nhttps://example.base.shop\nhttps://example2.stores.jp`}
            rows={4}
            className="w-full text-sm rounded-xl border border-[var(--line)] px-3 py-2 bg-[var(--surface)] text-[var(--text)] font-mono"
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={run}
              disabled={isPending || !urls.trim()}
              className="text-sm font-medium px-5 py-2 rounded-full bg-[var(--text)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 whitespace-nowrap"
            >
              {isPending ? "解析中…" : "このURLを解析して登録"}
            </button>
          </div>
        </div>
      )}

      {isPending && (
        <p className="mt-4 text-xs text-[var(--text-dim)]">
          最大{EC_MAX_URLS_PER_RUN}社ぶんのサイトを取得・解析しています。30秒ほどかかることがあります…
        </p>
      )}

      {summary && (
        <div className="mt-4 rounded-xl bg-[var(--accent-tint)] px-4 py-3">
          <div className="text-sm font-medium text-[var(--accent-strong)]">
            {summary.created}社を新規登録しました（うち{summary.withEmail}社はメール送信可能）
          </div>
          <div className="mt-1 text-xs text-[var(--text-dim)]">
            {summary.examined}社を検査 ／ サイト未登録 {summary.skippedNoSite}社・接続できず{" "}
            {summary.skippedUnreachable}社・登録済み {summary.skippedExisting}社をスキップ
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>
      )}
    </section>
  );
}
