"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { draftTemplateAction, sendBulkOutreachAction, sendTestEmailAction } from "../actions";
import { HTML_PRESETS, PRESETS, VARIABLES } from "./templates";
import { fillPreview, unresolvedVariables } from "./preview";
import { parseManualEmails } from "@/lib/parseEmails";

export type Recipient = {
  id: string;
  kind: "lead" | "company" | "webris" | "manual";
  name: string;
  email: string;
  meta: string | null;
  website: string;
  tools: string[];
  seoGaps: string[];
  alreadyContacted: boolean;
};

const KIND_TABS = [
  { kind: "lead" as const, label: "見込み客" },
  { kind: "company" as const, label: "既存顧客・CRM" },
  { kind: "webris" as const, label: "WEBRIS契約者" },
];

const KIND_BADGE: Record<string, string> = {
  lead: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
  company: "bg-[var(--surface-2)] text-[var(--text-dim)]",
  webris: "bg-[var(--gold-tint)] text-[var(--gold)]",
};

export default function ComposeForm({
  recipients,
  emailConfigured,
  senderName,
  unreachableCount,
  webrisError,
}: {
  recipients: Recipient[];
  emailConfigured: boolean;
  senderName: string;
  unreachableCount: number;
  webrisError: string | null;
}) {
  const [subject, setSubject] = useState(PRESETS[0].subject);
  const [body, setBody] = useState(PRESETS[0].body);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"lead" | "company" | "webris" | "manual">("lead");
  const [query, setQuery] = useState("");
  const [manualEmails, setManualEmails] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [format, setFormat] = useState<"text" | "html">("text");
  const [status, setStatus] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of recipients) m.set(r.kind, (m.get(r.kind) ?? 0) + 1);
    return m;
  }, [recipients]);

  const visible = useMemo(() => {
    if (tab === "manual") return [];
    const q = query.trim().toLowerCase();
    return recipients.filter((r) => {
      if (r.kind !== tab) return false;
      if (q && !r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [recipients, tab, query]);

  const selectedList = useMemo(() => recipients.filter((r) => selected.has(r.id)), [recipients, selected]);

  const manualParsed = useMemo(() => parseManualEmails(manualEmails), [manualEmails]);

  const totalToSend = selectedList.length + manualParsed.valid.length;
  const previewTarget = selectedList[0] ?? recipients.find((r) => r.kind === tab) ?? recipients[0] ?? null;

  const activePresets = format === "html" ? HTML_PRESETS : PRESETS;

  const filledSubject = fillPreview(subject, previewTarget, senderName);
  const filledBody = fillPreview(body, previewTarget, senderName);
  const badVars = [...new Set([...unresolvedVariables(filledSubject), ...unresolvedVariables(filledBody)])];

  // サイト解析データが無い宛先に {{tools}}/{{seoGap}} を使うと、実測ではなく
  // 一般的な言い回しに置き換わる。黙って送ると「調べた風」の文面になるので警告する。
  const usesAuditVars = /\{\{(tools|seoGap|seoOpportunity|website)\}\}/.test(subject + body);
  const noAuditData = selectedList.filter((r) => r.tools.length === 0 && r.seoGaps.length === 0).length;
  const auditWarning = usesAuditVars ? noAuditData + manualParsed.valid.length : 0;

  // WEBRIS契約者に「無料で試す」を送るのは明確な取り違えなので個別に警告する
  const webrisCustomersSelected = selectedList.filter((r) => r.kind === "webris").length;
  const webrisPitchToCustomer =
    /\{\{webris_url\}\}|無料プラン|無料で試す/.test(body) && webrisCustomersSelected > 0
      ? webrisCustomersSelected
      : 0;

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

  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
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
    fd.set("bodyFormat", format);
    if (previewTarget) {
      fd.set(
        "sample",
        JSON.stringify({
          name: previewTarget.name,
          website: previewTarget.website,
          tools: previewTarget.tools,
          seoGaps: previewTarget.seoGaps,
        }),
      );
    }
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
    if (totalToSend === 0) {
      setStatus({ kind: "error", text: "送信先を1件以上指定してください。" });
      return;
    }
    if (badVars.length > 0) {
      setStatus({ kind: "error", text: `未対応の差込変数があります: ${badVars.join("、")}` });
      return;
    }
    if (manualParsed.invalid.length > 0) {
      setStatus({ kind: "error", text: `手入力に不正なアドレスがあります: ${manualParsed.invalid.join("、")}` });
      return;
    }
    if (!confirm(`${totalToSend}件に送信します。取り消しはできません。よろしいですか？`)) return;

    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("body", body);
    fd.set("bodyFormat", format);
    fd.set("manualEmails", manualEmails);
    for (const r of selectedList) fd.append("recipientIds", r.id);

    startTransition(async () => {
      try {
        const r = await sendBulkOutreachAction(fd);
        const parts = [
          r.emailConfigured
            ? `${r.delivered}件に送信完了`
            : `${r.recorded}件を記録（配信基盤が未設定のため実際には届いていません）`,
        ];
        if (r.failed.length > 0) parts.push(`失敗 ${r.failed.length}件（${r.failed[0].reason}）`);
        setStatus({ kind: r.failed.length > 0 ? "error" : "ok", text: parts.join(" / ") });
        setSelected(new Set());
        setManualEmails("");
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
            「送信」を押してもDBに記録されるだけで、実際のメールは届きません（RESEND_API_KEY / MAIL_FROM）。
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
        {/* ---------- 左: エディタ + 宛先 ---------- */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--text-dim)]">形式</span>
              <div className="inline-flex p-0.5 rounded-full bg-[var(--surface-2)]">
                {(["text", "html"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      if (f === format) return;
                      // 記法を切り替えたら、その記法の既定テンプレートを読み込む。
                      // テキストのままHTMLに切り替えると、改行が消えたメールになる。
                      const preset = (f === "html" ? HTML_PRESETS : PRESETS)[0];
                      setFormat(f);
                      setSubject(preset.subject);
                      setBody(preset.body);
                      setStatus({
                        kind: "info",
                        text: f === "html" ? "HTML形式に切り替えました。" : "テキスト形式に切り替えました。",
                      });
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      format === f ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-dim)]"
                    }`}
                  >
                    {f === "text" ? "テキスト" : "HTML"}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-[var(--text-dim)]">
                {format === "html"
                  ? "HTMLで記述します。テキスト版も自動生成して同梱します。"
                  : "プレーンテキスト。新規開拓ではこちらの方が届きやすい傾向があります。"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[var(--text-dim)]">テンプレート</span>
              {activePresets.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setSubject(p.subject);
                    setBody(p.body);
                    setStatus({ kind: "info", text: `テンプレート「${p.name}」を読み込みました。` });
                  }}
                  className={chip(false)}
                >
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
              <div className="mb-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-dim)]">
                    本文{format === "html" && <span className="ml-1 font-normal">（HTML）</span>}
                  </span>
                  <span className="text-[11px] text-[var(--text-dim)]">クリックで差込変数を挿入</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => insertVariable(v.token)}
                      title={v.label}
                      className="px-2 py-1 rounded-md text-[11px] font-mono bg-[var(--accent-tint)] text-[var(--accent-strong)] hover:bg-[var(--accent)] hover:text-white transition-colors whitespace-nowrap"
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
                rows={15}
                spellCheck={format === "text"}
                className={`w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text)] leading-relaxed focus:outline-none focus:border-[var(--accent)] ${
                  format === "html" ? "font-mono text-[12px]" : ""
                }`}
              />
              <p className="mt-1.5 text-[11px] text-[var(--text-dim)]">
                特定電子メール法により、送信者情報と配信停止方法の記載が必要です。テンプレートには含まれています。
              </p>
              {format === "html" && (
                <p className="mt-1 text-[11px] text-[var(--text-dim)]">
                  画像は <code className="font-mono">{"<img src=\"https://hub.levan.jp/mail/xxx.png\">"}</code> のように
                  絶対URLで指定してください（メールソフトは相対パスを解決できません）。多くのメールソフトは既定で画像を
                  ブロックするため、重要な情報を画像内だけに置かないでください。
                </p>
              )}
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

          {/* ---------- 宛先 ---------- */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
            <div className="p-5 pb-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--text)]">
                  送信先
                  <span className="ml-2 font-normal text-[var(--text-dim)]">{totalToSend}件を送信</span>
                </h2>
                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-xs font-medium text-[var(--text-dim)] hover:text-[var(--text)]"
                  >
                    選択をすべて解除
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {KIND_TABS.map((t) => (
                  <button key={t.kind} type="button" onClick={() => setTab(t.kind)} className={chip(tab === t.kind)}>
                    {t.label} {counts.get(t.kind) ?? 0}
                  </button>
                ))}
                <button type="button" onClick={() => setTab("manual")} className={chip(tab === "manual")}>
                  手入力{manualParsed.valid.length > 0 ? ` ${manualParsed.valid.length}` : ""}
                </button>
                {tab !== "manual" && (
                  <>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="会社名・アドレスで絞り込み"
                      className="ml-auto text-sm rounded-full border border-[var(--line)] px-4 py-1.5 bg-[var(--surface)] text-[var(--text)] w-52 focus:outline-none focus:border-[var(--accent)]"
                    />
                    <button
                      type="button"
                      onClick={() => setSelected((prev) => new Set([...prev, ...visible.map((r) => r.id)]))}
                      className="text-xs font-medium text-[var(--accent)] whitespace-nowrap"
                    >
                      表示中を全選択
                    </button>
                  </>
                )}
              </div>
            </div>

            {tab === "manual" ? (
              <div className="px-5 pb-5 pt-3 border-t border-[var(--line)]">
                <textarea
                  value={manualEmails}
                  onChange={(e) => setManualEmails(e.target.value)}
                  rows={6}
                  placeholder={"送信したいアドレスを貼り付けてください。\n改行・カンマ・スペース区切り、「名前 <foo@example.com>」形式も可。"}
                  className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text)] font-mono focus:outline-none focus:border-[var(--accent)]"
                />
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[var(--accent-strong)]">有効 {manualParsed.valid.length}件</span>
                    {manualParsed.invalid.length > 0 && (
                      <span className="text-[var(--danger)]">
                        解釈できない入力 {manualParsed.invalid.length}件: {manualParsed.invalid.slice(0, 3).join("、")}
                      </span>
                    )}
                  </div>
                  <p className="text-[var(--text-dim)]">
                    手入力の宛先には会社データがないため、{"{{company}}"} はドメイン名に、
                    {"{{tools}}"} や {"{{seoGap}}"} は一般的な言い回しに置き換わります。
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto border-t border-[var(--line)] divide-y divide-[var(--line)]">
                {visible.map((r) => (
                  <label
                    key={r.id}
                    className="flex items-center gap-3 px-5 py-2.5 text-sm cursor-pointer hover:bg-[var(--surface-2)]/60"
                  >
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[var(--text)] truncate">
                        {r.name}
                        {r.alreadyContacted && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[var(--gold-tint)] text-[var(--gold)]">
                            送信済
                          </span>
                        )}
                      </span>
                      <span className="block text-[11px] text-[var(--text-dim)] truncate">{r.email}</span>
                    </span>
                    {r.meta && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${KIND_BADGE[r.kind]}`}>
                        {r.meta}
                      </span>
                    )}
                  </label>
                ))}
                {visible.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-[var(--text-dim)]">
                    {webrisError && tab === "webris"
                      ? webrisError
                      : "該当する宛先がありません。フィルタを変えるか、ダッシュボードでリサーチを実行してください。"}
                  </p>
                )}
              </div>
            )}

            {unreachableCount > 0 && (
              <p className="px-5 py-2.5 border-t border-[var(--line)] text-[11px] text-[var(--text-dim)]">
                アドレスが取得できず送信対象にできない相手が {unreachableCount} 件あります（問い合わせフォームのみのサイトなど）。
              </p>
            )}
          </section>
        </div>

        {/* ---------- 右: プレビュー + 送信 ---------- */}
        <div className="lg:sticky lg:top-6 space-y-4">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--line)] bg-[var(--surface-2)]/60">
              <div className="text-xs font-medium text-[var(--text)]">プレビュー</div>
              <div className="text-[11px] text-[var(--text-dim)] mt-0.5 truncate">
                {previewTarget ? `${previewTarget.name} の実データで差込` : "対象未選択（サンプル値で表示）"}
              </div>
            </div>
            <div className="p-4">
              <div className="text-[11px] text-[var(--text-dim)]">件名</div>
              <div className="text-sm font-medium text-[var(--text)] mt-0.5">{filledSubject}</div>
              <div className="mt-3 pt-3 border-t border-[var(--line)]">
                {format === "html" ? (
                  // 自作HTMLとはいえ、アプリのオリジンで実行させない。
                  // sandbox 無しの srcdoc はセッションを触れる状態になる。
                  <iframe
                    title="HTMLプレビュー"
                    sandbox=""
                    srcDoc={filledBody}
                    className="w-full h-[380px] rounded-lg border border-[var(--line)] bg-white"
                  />
                ) : (
                  <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--text-dim)] max-h-[380px] overflow-y-auto">
                    {filledBody}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm p-4 space-y-3">
            {badVars.length > 0 && (
              <div className="rounded-xl bg-[var(--danger-tint)] px-3.5 py-2.5 text-xs text-[var(--danger)] leading-relaxed">
                <span className="font-medium">未対応の差込変数: {badVars.join("、")}</span>
                <br />
                このまま送ると相手にそのままの文字列が届くため、送信をブロックしています。
              </div>
            )}

            {webrisPitchToCustomer > 0 && (
              <div className="rounded-xl bg-[var(--danger-tint)] px-3.5 py-2.5 text-xs text-[var(--danger)] leading-relaxed">
                <span className="font-medium">WEBRIS契約者 {webrisPitchToCustomer}件が宛先に入っています。</span>
                <br />
                本文がWEBRISの新規登録を勧める内容です。既に契約中の相手に送ると不自然になります。
              </div>
            )}

            {auditWarning > 0 && (
              <div className="rounded-xl bg-[var(--gold-tint)] px-3.5 py-2.5 text-xs text-[var(--gold)] leading-relaxed">
                <span className="font-medium">サイト解析データが無い宛先が {auditWarning} 件あります。</span>
                <br />
                {"{{tools}}"} や {"{{seoGap}}"} は一般的な言い回しに置き換わり、実際に調べた内容にはなりません。
              </div>
            )}

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
              disabled={isPending || totalToSend === 0 || badVars.length > 0}
              className="w-full text-sm font-medium px-4 py-2.5 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-40"
            >
              {isPending ? "処理中…" : totalToSend > 0 ? `${totalToSend}件に送信` : "送信先を選択してください"}
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
