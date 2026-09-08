"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { draftTemplateAction, sendBulkOutreachAction, sendTestEmailAction } from "../actions";

export type Candidate = {
  leadId: string;
  companyName: string;
  website: string;
  category: string | null;
  potentialScore: number | null;
  recipient: string | null;
  tools: string[];
  seoGaps: string[];
  alreadyContacted: boolean;
};

const VARIABLES = [
  { token: "{{company}}", label: "会社名" },
  { token: "{{website}}", label: "相手サイトURL" },
  { token: "{{tools}}", label: "導入済みツール" },
  { token: "{{seoGap}}", label: "SEO上の不足" },
  { token: "{{seoOpportunity}}", label: "改善提案文" },
  { token: "{{sender}}", label: "差出人名" },
  { token: "{{webris_url}}", label: "WEBRIS計測リンク" },
  { token: "{{company_address}}", label: "LEVANの住所（法定表示）" },
];

const WEBRIS_PRESET_BODY =
  "{{company}} ご担当者様\n\n" +
  "突然のご連絡失礼いたします。株式会社LEVANの{{sender}}と申します。\n\n" +
  "貴社サイト（{{website}}）を拝見し、{{tools}}などの計測環境を活用されていることを確認しました。\n\n" +
  "一方でSEOの観点で見ると「{{seoGap}}」という点があり、{{seoOpportunity}}\n\n" +
  "せっかく計測環境が整っているので、「データを見る」だけでなく「次に何を改善すべきか」まで分かると、" +
  "運用がもっと楽になるのではと思いご連絡しました。\n\n" +
  "弊社が開発しているAI SEOツール「WEBRIS」は、サイトのSEO状態をAIが分析し、" +
  "優先して取り組むべき改善点を自動で提示します。無料プランで貴社サイトをそのまま分析できます。\n\n" +
  "▼ WEBRISを無料で試す\n{{webris_url}}\n\n" +
  "「自社サイトのどこが改善できるのか」を見るだけでも構いません。\n\n" +
  "――――――――――\n{{company_address}}\nWEBRIS\n{{sender}}\n\n" +
  "配信停止をご希望の場合は、本メールにご返信いただければ以後お送りいたしません。";

const PRESETS = [
  {
    name: "WEBRIS無料プラン訴求",
    subject: "{{company}}様のSEOで1点気になった点があります",
    body: WEBRIS_PRESET_BODY,
  },
  {
    name: "短縮版（推奨）",
    subject: "{{company}}様のSEOで1点気になった点が",
    body:
      "{{company}} ご担当者様\n\n" +
      "突然のご連絡失礼いたします。株式会社LEVANの{{sender}}と申します。\n\n" +
      "貴社サイト（{{website}}）を拝見し、{{tools}}をお使いなのを確認しました。\n" +
      "一方で「{{seoGap}}」という点があり、{{seoOpportunity}}\n\n" +
      "計測環境が整っているぶん、「次に何を直すべきか」まで分かると運用が楽になるはずです。\n" +
      "弊社のAI SEOツール「WEBRIS」は、そこをAIが自動で洗い出します。無料で貴社サイトを分析できます。\n\n" +
      "▼ 無料で試す\n{{webris_url}}\n\n" +
      "――――――――――\n{{company_address}}\nWEBRIS {{sender}}\n" +
      "配信停止をご希望の場合は本メールにご返信ください。",
  },
  {
    name: "広告代理店向け（協業提案）",
    subject: "{{company}}様へ｜クライアント様向けAI SEOツールのご案内",
    body:
      "{{company}} ご担当者様\n\n" +
      "株式会社LEVANの{{sender}}と申します。貴社の支援領域を拝見しご連絡いたしました。\n\n" +
      "弊社はAI SEOツール「WEBRIS」を開発しており、代理店様がクライアント様のサイト診断・" +
      "改善提案を行う際のツールとしてご利用いただくケースが増えています。\n\n" +
      "▼ 無料で試す\n{{webris_url}}\n\n" +
      "――――――――――\n{{company_address}}\nWEBRIS {{sender}}\n" +
      "配信停止をご希望の場合は本メールにご返信ください。",
  },
];

const CATEGORIES = ["SEOツール利用企業", "ヒートマップツール利用企業", "LLMOツール利用企業", "広告代理店"];

const OPPORTUNITY_BY_GAP: Record<string, string> = {
  "meta descriptionが無い": "検索結果に出る説明文が自動生成に任されている状態で、クリック率を取りこぼしている可能性があります。",
  "構造化データ(JSON-LD)が無い": "検索エンジンや生成AIにページ内容が構造として伝わっておらず、AI検索での引用機会を逃している可能性があります。",
  "h1見出しが無い": "ページの主題が検索エンジンに伝わりにくく、評価が分散している可能性があります。",
  "titleタグが短い（15文字未満）": "titleに検索キーワードを含める余地が残っており、上位表示の機会を活かしきれていない可能性があります。",
  "titleタグが無い": "titleが未設定のため、検索結果での表示が不安定になっている可能性があります。",
  "canonicalタグが無い": "URLの重複がある場合に評価が分散し、本来の評価を受け取れていない可能性があります。",
  "OGP設定が無い": "SNSでシェアされた際に情報が正しく表示されず、流入機会を損ねている可能性があります。",
  "オウンドメディア/ブログ導線が見当たらない": "継続的に検索流入を集める入り口が不足しており、指名検索以外の接点が限られている可能性があります。",
};

/** サーバ側 src/lib/mailTemplate.ts と同じ規則でプレビューする。 */
function fill(template: string, c: Candidate | null, sender: string) {
  const tools = c && c.tools.length > 0 ? c.tools.join("・") : "アクセス解析ツール";
  const gaps = c?.seoGaps ?? [];
  const seoGap = gaps.length > 0 ? gaps.slice(0, 2).join("・") : "コンテンツ更新頻度";
  const primary = gaps.find((g) => OPPORTUNITY_BY_GAP[g]);
  const opportunity = primary
    ? OPPORTUNITY_BY_GAP[primary]
    : gaps.length > 0
      ? `${gaps[0]}という点で改善の余地がありそうです。`
      : "サイト全体の構成を見直すことで、検索流入を伸ばせる可能性があります。";

  return template
    .replaceAll("{{company}}", c?.companyName ?? "サンプル株式会社")
    .replaceAll("{{website}}", c?.website ?? "https://example.co.jp")
    .replaceAll("{{tools}}", tools)
    .replaceAll("{{seoGap}}", seoGap)
    .replaceAll("{{seoOpportunity}}", opportunity)
    .replaceAll("{{sender}}", sender)
    .replaceAll("{{webris_url}}", "https://webris.levan.jp")
    .replaceAll("{{company_address}}", "株式会社LEVAN\n〒454-0867 愛知県名古屋市中川区広田町2丁目71番地");
}

function unresolved(filled: string): string[] {
  return [...new Set(filled.match(/\{\{[^}\n]{1,40}\}\}/g) ?? [])];
}

export default function ComposeForm({
  candidates,
  emailConfigured,
  senderName,
}: {
  candidates: Candidate[];
  emailConfigured: boolean;
  senderName: string;
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

  const filledSubject = fill(subject, previewTarget, senderName);
  const filledBody = fill(body, previewTarget, senderName);
  // 未対応の差込変数が残った文面はサーバ側でも送信を拒否される。押す前に見せる。
  const badVars = [...new Set([...unresolved(filledSubject), ...unresolved(filledBody)])];

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
    if (badVars.length > 0) {
      setStatus({ kind: "error", text: `未対応の差込変数があります: ${badVars.join("、")}` });
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
              <div className="mb-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-dim)]">本文</span>
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
              <div className="text-sm font-medium text-[var(--text)] mt-0.5">{filledSubject}</div>
              <div className="mt-3 pt-3 border-t border-[var(--line)] text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--text-dim)] max-h-[420px] overflow-y-auto">
                {filledBody}
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
              disabled={isPending || selected.size === 0 || badVars.length > 0}
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
