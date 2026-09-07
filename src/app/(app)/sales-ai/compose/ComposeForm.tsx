"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { draftTemplateAction, sendBulkOutreachAction, sendTestEmailAction } from "../actions";

export type Candidate = {
  leadId: string;
  companyName: string;
  category: string | null;
  potentialScore: number | null;
  recipient: string | null;
  tools: string[];
  seoGaps: string[];
  alreadyContacted: boolean;
};

const VARIABLES = [
  { token: "{{company}}", label: "会社名", example: "株式会社ミエルカ" },
  { token: "{{tools}}", label: "導入済みツール", example: "Microsoft Clarity・Google Tag Manager" },
  { token: "{{seoGap}}", label: "SEO上の不足", example: "OGP設定が無い・canonicalタグが無い" },
];

const PRESETS = [
  {
    name: "ツール導入企業向け",
    subject: "【{{company}}様】サイト改善についてのご提案",
    body:
      "{{company}} ご担当者様\n\n" +
      "突然のご連絡失礼いたします。株式会社LEVANの営業担当です。\n" +
      "貴社サイトを拝見したところ、{{tools}}を活用されており、計測環境を整えていらっしゃると感じました。\n\n" +
      "一方で、{{seoGap}}といった点に改善余地があるようにお見受けしました。\n" +
      "弊社はSEOコンテンツ制作の運用代行を提供しており、計測基盤が整っている企業様ほど成果につながりやすい傾向があります。\n\n" +
      "もしご興味がありましたら、30分ほどオンラインでお話しさせていただけないでしょうか。\n\n" +
      "――――――――――\n株式会社LEVAN\nhttps://hub.levan.jp\n" +
      "配信停止をご希望の場合は、本メールにご返信いただければ以後お送りいたしません。",
  },
  {
    name: "広告代理店向け（協業提案）",
    subject: "【{{company}}様】SEOコンテンツ制作の外部リソースについて",
    body:
      "{{company}} ご担当者様\n\n" +
      "株式会社LEVANの営業担当です。貴社の支援領域を拝見しご連絡いたしました。\n" +
      "弊社はSEOコンテンツ制作に特化した運用代行を行っており、代理店様の制作リソースとしてご一緒するケースが増えております。\n\n" +
      "クライアント様への提案の幅を広げる一手として、一度情報交換させていただけないでしょうか。\n\n" +
      "――――――――――\n株式会社LEVAN\nhttps://hub.levan.jp\n" +
      "配信停止をご希望の場合は、本メールにご返信いただければ以後お送りいたしません。",
  },
  {
    name: "シンプル・短文",
    subject: "{{company}}様のSEOについて一点だけ",
    body:
      "{{company}} ご担当者様\n\n" +
      "株式会社LEVANと申します。貴社サイトを拝見し、{{seoGap}}が気になりご連絡しました。\n" +
      "改善案を10分ほどでご説明できます。ご興味があればご返信ください。\n\n" +
      "――――――――――\n株式会社LEVAN\nhttps://hub.levan.jp\n" +
      "配信停止をご希望の場合は本メールにご返信ください。",
  },
];

const CATEGORIES = ["SEOツール利用企業", "ヒートマップツール利用企業", "LLMOツール利用企業", "広告代理店"];

/** クライアント側プレビュー用。サーバ側 fillTemplate と同じ規則。 */
function fill(template: string, c: Candidate | null) {
  const tools = c && c.tools.length > 0 ? c.tools.join("・") : "アクセス解析ツール";
  const seoGap = c && c.seoGaps.length > 0 ? c.seoGaps.slice(0, 2).join("・") : "コンテンツ更新頻度";
  return template
    .replaceAll("{{company}}", c?.companyName ?? "サンプル株式会社")
    .replaceAll("{{tools}}", tools)
    .replaceAll("{{seoGap}}", seoGap);
}

export default function ComposeForm({
  candidates,
  emailConfigured,
}: {
  candidates: Candidate[];
  emailConfigured: boolean;
}) {
  const [subject, setSubject] = useState(PRESETS[0].subject);
  const [body, setBody] = useState(PRESETS[0].body);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<string | null>(null);
  const [excludeContacted, setExcludeContacted] = useState(true);
  const [aiInstruction, setAiInstruction] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const visible = useMemo(
    () =>
      candidates.filter((c) => {
        if (category && c.category !== category) return false;
        if (excludeContacted && c.alreadyContacted) return false;
        return true;
      }),
    [candidates, category, excludeContacted],
  );

  const sendable = visible.filter((c) => c.recipient);
  const selectedList = candidates.filter((c) => selected.has(c.leadId));
  // プレビューは選択中の1社目、無ければ送信可能な先頭で
  const previewTarget = selectedList[0] ?? sendable[0] ?? null;

  function insertVariable(token: string) {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? body.length;
    const next = body.slice(0, start) + token + body.slice(el.selectionEnd ?? start);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setSubject(p.subject);
    setBody(p.body);
    setStatus({ kind: "info", text: `テンプレート「${p.name}」を読み込みました。` });
  }

  function generateWithAi() {
    setStatus(null);
    startTransition(async () => {
      const d = await draftTemplateAction(aiInstruction || "SEOコンテンツ運用代行の初回アプローチメール");
      setSubject(d.subject);
      setBody(d.body);
      setStatus({ kind: "info", text: "AIが下書きを作成しました。内容を確認・調整してください。" });
    });
  }

  function testSend() {
    setStatus(null);
    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("body", body);
    if (previewTarget) fd.set("sampleLeadId", previewTarget.leadId);
    startTransition(async () => {
      const r = await sendTestEmailAction(fd);
      setStatus(
        r.delivered
          ? { kind: "ok", text: `${r.to} 宛にテスト送信しました。受信箱をご確認ください。` }
          : { kind: "error", text: `テスト送信できませんでした: ${r.reason}` },
      );
    });
  }

  function bulkSend() {
    setStatus(null);
    if (selected.size === 0) {
      setStatus({ kind: "error", text: "送信先を1社以上選択してください。" });
      return;
    }
    if (!confirm(`${selected.size}社に一斉送信します。取り消しはできません。よろしいですか？`)) return;

    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("body", body);
    for (const id of selected) fd.append("leadIds", id);

    startTransition(async () => {
      try {
        const r = await sendBulkOutreachAction(fd);
        const parts = [
          r.emailConfigured
            ? `${r.delivered}社に送信完了`
            : `${r.recorded}社を記録（配信基盤が未設定のため実際には届いていません）`,
        ];
        if (r.skippedNoAddress.length > 0) parts.push(`アドレス無し ${r.skippedNoAddress.length}社をスキップ`);
        if (r.failed.length > 0) parts.push(`失敗 ${r.failed.length}社（${r.failed[0].reason}）`);
        setStatus({ kind: r.failed.length > 0 ? "error" : "ok", text: parts.join(" / ") });
        setSelected(new Set());
      } catch (e) {
        setStatus({ kind: "error", text: e instanceof Error ? e.message : "送信に失敗しました。" });
      }
    });
  }

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
      active ? "bg-[var(--text)] text-white" : "bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]"
    }`;

  return (
    <div className="space-y-6">
      {!emailConfigured && (
        <div className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold-tint)] px-5 py-3.5 text-sm">
          <span className="font-medium text-[var(--text)]">配信基盤が未設定です。</span>{" "}
          <span className="text-[var(--text-dim)]">
            現在「送信」を押してもDBに記録されるだけで、実際のメールは届きません（RESEND_API_KEY / MAIL_FROM）。
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
        {/* ---------- 左: エディタ ---------- */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[var(--text-dim)]">テンプレート</span>
              {PRESETS.map((p) => (
                <button key={p.name} type="button" onClick={() => applyPreset(p)} className={chip(false)}>
                  {p.name}
                </button>
              ))}
            </div>

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
                <span className="text-xs font-medium text-[var(--text-dim)]">本文</span>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-[var(--text-dim)] mr-1">差込変数</span>
                  {VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => insertVariable(v.token)}
                      title={`${v.label} — 例: ${v.example}`}
                      className="px-2 py-1 rounded-md text-[11px] font-mono bg-[var(--accent-tint)] text-[var(--accent-strong)] hover:bg-[var(--accent)] hover:text-white transition-colors"
                    >
                      {v.token}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={16}
                className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text)] leading-relaxed focus:outline-none focus:border-[var(--accent)]"
              />
              <p className="mt-1.5 text-[11px] text-[var(--text-dim)]">
                特定電子メール法により、送信者情報と配信停止方法の記載が必要です。テンプレートには既に含まれています。
              </p>
            </div>

            <div className="rounded-xl bg-[var(--surface-2)] p-3">
              <div className="flex gap-2">
                <input
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  placeholder="AIへの指示（例: もっとカジュアルに、3行で）"
                  className="flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={generateWithAi}
                  disabled={isPending}
                  className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  AIで下書き
                </button>
              </div>
            </div>
          </section>

          {/* ---------- 送信先 ---------- */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
            <div className="p-5 pb-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--text)]">
                  送信先
                  <span className="ml-2 font-normal text-[var(--text-dim)]">
                    {selected.size}社選択中 / 送信可能{sendable.length}社
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(new Set(sendable.map((c) => c.leadId)))}
                    className="text-xs font-medium text-[var(--accent)]"
                  >
                    送信可能を全選択
                  </button>
                  <span className="text-[var(--line)]">|</span>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-xs font-medium text-[var(--text-dim)]"
                  >
                    解除
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setCategory(null)} className={chip(category === null)}>
                  すべて
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(category === c ? null : c)}
                    className={chip(category === c)}
                  >
                    {c}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setExcludeContacted((v) => !v)}
                  className={`${chip(excludeContacted)} ml-auto`}
                >
                  {excludeContacted ? "✓ " : ""}送信済みを除く
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto border-t border-[var(--line)] divide-y divide-[var(--line)]">
              {visible.map((c) => (
                <label
                  key={c.leadId}
                  className={`flex items-center gap-3 px-5 py-2.5 text-sm ${
                    c.recipient ? "cursor-pointer hover:bg-[var(--surface-2)]/60" : "opacity-45 cursor-not-allowed"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!c.recipient}
                    checked={selected.has(c.leadId)}
                    onChange={() =>
                      setSelected((prev) => {
                        const n = new Set(prev);
                        if (n.has(c.leadId)) n.delete(c.leadId);
                        else n.add(c.leadId);
                        return n;
                      })
                    }
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[var(--text)] truncate">
                      {c.companyName}
                      {c.alreadyContacted && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[var(--gold-tint)] text-[var(--gold)]">
                          送信済
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] text-[var(--text-dim)] truncate">
                      {c.recipient ?? "公開アドレス無し"}
                    </span>
                  </span>
                  <span className="text-[11px] text-[var(--text-dim)] tabular-nums shrink-0">{c.potentialScore ?? "—"}</span>
                </label>
              ))}
              {visible.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-[var(--text-dim)]">
                  条件に合う企業がありません。フィルタを変えるか、ダッシュボードでリサーチを実行してください。
                </p>
              )}
            </div>
          </section>
        </div>

        {/* ---------- 右: プレビュー + 送信 ---------- */}
        <div className="lg:sticky lg:top-6 space-y-4">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--line)] bg-[var(--surface-2)]/60">
              <div className="text-xs font-medium text-[var(--text)]">プレビュー</div>
              <div className="text-[11px] text-[var(--text-dim)] mt-0.5 truncate">
                {previewTarget ? `${previewTarget.companyName} の実データで差込` : "対象未選択（サンプル値で表示）"}
              </div>
            </div>
            <div className="p-4">
              <div className="text-[11px] text-[var(--text-dim)]">件名</div>
              <div className="text-sm font-medium text-[var(--text)] mt-0.5">{fill(subject, previewTarget)}</div>
              <div className="mt-3 pt-3 border-t border-[var(--line)] text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--text-dim)] max-h-[420px] overflow-y-auto">
                {fill(body, previewTarget)}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm p-4 space-y-3">
            <button
              type="button"
              onClick={testSend}
              disabled={isPending}
              className="w-full text-sm font-medium px-4 py-2.5 rounded-full border border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
            >
              自分宛にテスト送信
            </button>
            <button
              type="button"
              onClick={bulkSend}
              disabled={isPending || selected.size === 0}
              className="w-full text-sm font-medium px-4 py-2.5 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-40"
            >
              {isPending ? "処理中…" : selected.size > 0 ? `${selected.size}社に一斉送信` : "送信先を選択してください"}
            </button>

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
          </section>
        </div>
      </div>
    </div>
  );
}
