"use client";

import { useState, useTransition } from "react";
import { sendBulkOutreachAction, sendTestEmailAction } from "../actions";

type Candidate = {
  leadId: string;
  companyName: string;
  toolInterest: string | null;
  potentialScore: number | null;
};

const DEFAULT_SUBJECT = "【ご提案】{{company}}様のSEO・コンテンツ運用について";
const DEFAULT_BODY =
  "{{company}} ご担当者様\n\n" +
  "株式会社LEVANの営業担当です。貴社のSEO・コンテンツ運用に関する取り組みを拝見し、ご連絡いたしました。\n" +
  "弊社ではSEOコンテンツ制作の運用代行サービスを提供しております。よろしければ30分ほどお話させてください。\n\n" +
  "配信停止をご希望の場合は本メールへの返信でお伝えください。\n\n株式会社LEVAN\nhub.levan.jp";

export default function ComposeForm({ candidates }: { candidates: Candidate[] }) {
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allSelected = selected.size > 0 && selected.size === candidates.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(candidates.map((c) => c.leadId)));
  }

  function toggleOne(leadId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }

  function handleTestSend() {
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.set("subject", subject);
    formData.set("body", body);
    startTransition(async () => {
      const p = await sendTestEmailAction(formData);
      setPreview(p);
    });
  }

  function handleSend() {
    setError(null);
    setResult(null);
    if (selected.size === 0) {
      setError("送信先企業を1社以上選択してください。");
      return;
    }
    if (!confirm(`${selected.size}社に一斉送信します。よろしいですか？`)) return;

    const formData = new FormData();
    formData.set("subject", subject);
    formData.set("body", body);
    for (const leadId of selected) formData.append("leadIds", leadId);

    startTransition(async () => {
      try {
        const r = await sendBulkOutreachAction(formData);
        setResult(`${r.count}社に送信しました。`);
        setSelected(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "送信に失敗しました。");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm">
        <label className="block">
          <span className="text-xs font-medium text-[var(--text-dim)]">件名</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm bg-transparent text-[var(--text)]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--text-dim)]">本文</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm bg-transparent text-[var(--text)] font-mono"
          />
        </label>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleTestSend}
            disabled={isPending}
            className="text-sm font-medium px-4 py-2 rounded-full border border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
          >
            テスト送信
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending}
            className="text-sm font-medium px-4 py-2 rounded-full bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {selected.size > 0 ? `選択した${selected.size}社に送信` : "送信"}
          </button>
          {result && <span className="text-xs text-[var(--accent-strong)]">{result}</span>}
          {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
        </div>

        {preview && (
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm">
            <div className="text-xs text-[var(--text-dim)] mb-2">テストプレビュー（実際には送信されません）</div>
            <div className="font-medium text-[var(--text)]">{preview.subject}</div>
            <div className="mt-2 whitespace-pre-wrap text-[var(--text-dim)]">{preview.body}</div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text)]">送信先企業を選択</h2>
          <button type="button" onClick={toggleAll} className="text-xs font-medium text-[var(--accent)]">
            {allSelected ? "全解除" : "全選択"}
          </button>
        </div>
        <div className="border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm divide-y divide-[var(--line)] max-h-96 overflow-y-auto">
          {candidates.map((c) => (
            <label key={c.leadId} className="flex items-center gap-3 px-4 py-3 text-sm cursor-pointer hover:bg-[var(--surface-2)]">
              <input type="checkbox" checked={selected.has(c.leadId)} onChange={() => toggleOne(c.leadId)} />
              <span className="flex-1 text-[var(--text)]">{c.companyName}</span>
              <span className="text-xs text-[var(--text-dim)]">{c.toolInterest ?? "—"}</span>
              <span className="text-xs tabular-nums text-[var(--text-dim)] w-10 text-right">{c.potentialScore ?? "—"}</span>
            </label>
          ))}
          {candidates.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-[var(--text-dim)]">
              送信対象のリードがありません。ダッシュボードで「リサーチ実行」を行ってください。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
