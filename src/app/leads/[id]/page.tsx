import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { approveMessage, declineMessage, generateOutreachDraft, submitReply } from "../actions";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      company: true,
      outreachMessages: { orderBy: { createdAt: "asc" } },
      decisionLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!lead) notFound();

  const pendingMessage = lead.outreachMessages.find(
    (m) => m.direction === "OUTBOUND" && m.approvalStatus === "PENDING",
  );
  const opportunities = Array.isArray(lead.seoOpportunities)
    ? (lead.seoOpportunities as string[])
    : [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
      <div className="flex items-start justify-between gap-6 border-b border-[var(--line)] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--accent-strong)]">{lead.company.name}</h1>
          <p className="text-[var(--text-dim)]">{lead.company.website}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--accent-tint)] text-[var(--accent-strong)]">
          {lead.status}
        </span>
      </div>

      <section className="grid grid-cols-2 gap-6">
        <div className="border border-[var(--line)] rounded-lg p-5 bg-[var(--surface)]">
          <div className="text-xs uppercase tracking-wide text-[var(--text-dim)] mb-1">
            SEOスコア
          </div>
          <div className="text-3xl font-bold tabular-nums">{lead.seoScore ?? "—"}</div>
        </div>
        <div className="border border-[var(--line)] rounded-lg p-5 bg-[var(--surface)]">
          <div className="text-xs uppercase tracking-wide text-[var(--text-dim)] mb-1">
            見込み度スコア（Agent 01）
          </div>
          <div className="text-3xl font-bold tabular-nums">{lead.potentialScore ?? "—"}</div>
        </div>
      </section>

      {opportunities.length > 0 && (
        <section>
          <h2 className="font-bold mb-2">SEO課題</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-dim)]">
            {opportunities.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
          {lead.reasonToContact && (
            <p className="text-sm mt-3">
              <span className="text-[var(--text-dim)]">営業理由: </span>
              {lead.reasonToContact}
            </p>
          )}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">営業メッセージ（Agent 02）</h2>
          {!pendingMessage && (
            <form action={generateOutreachDraft.bind(null, lead.id)}>
              <button
                type="submit"
                className="text-sm bg-[var(--accent)] text-white rounded-md px-3 py-1.5"
              >
                営業文を生成
              </button>
            </form>
          )}
        </div>

        <div className="space-y-3">
          {lead.outreachMessages.map((m) => (
            <div key={m.id} className="border border-[var(--line)] rounded-lg p-4 bg-[var(--surface)]">
              <div className="flex justify-between items-center text-xs text-[var(--text-dim)] mb-2">
                <span>{m.direction === "OUTBOUND" ? "送信（下書き）" : "受信"}</span>
                <span>{m.createdAt.toLocaleString("ja-JP")}</span>
              </div>
              {m.subject && <div className="font-medium mb-1">{m.subject}</div>}
              <p className="text-sm whitespace-pre-wrap">{m.body}</p>
              {m.direction === "OUTBOUND" && (
                <div className="mt-3 flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      m.approvalStatus === "APPROVED"
                        ? "bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                        : m.approvalStatus === "REJECTED"
                          ? "bg-[var(--danger-tint)] text-[var(--danger)]"
                          : "bg-[var(--gold-tint)] text-[var(--gold)]"
                    }`}
                  >
                    {m.approvalStatus}
                  </span>
                  {m.approvalStatus === "PENDING" && (
                    <>
                      <form action={approveMessage.bind(null, m.id, lead.id)}>
                        <button className="text-xs underline text-[var(--accent)]" type="submit">
                          承認して送信
                        </button>
                      </form>
                      <form action={declineMessage.bind(null, m.id, lead.id)}>
                        <button className="text-xs underline text-[var(--danger)]" type="submit">
                          却下
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}
              {m.replyCategory && (
                <div className="mt-2 text-xs text-[var(--text-dim)]">分類: {m.replyCategory}</div>
              )}
            </div>
          ))}
        </div>

        <details className="border border-[var(--line)] rounded-lg p-4 bg-[var(--surface)]">
          <summary className="text-sm cursor-pointer text-[var(--text-dim)]">
            返信を記録（テスト用シミュレーション）
          </summary>
          <form action={submitReply} className="mt-3 flex gap-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <textarea
              name="body"
              required
              placeholder="受信した返信本文を貼り付け"
              className="flex-1 border border-[var(--line)] rounded-md px-3 py-2 text-sm bg-transparent"
              rows={2}
            />
            <button type="submit" className="text-sm bg-[var(--surface-2)] rounded-md px-3 py-2 self-start">
              記録して分類
            </button>
          </form>
        </details>
      </section>

      <section>
        <h2 className="font-bold mb-3">AI Decision Log</h2>
        <div className="space-y-2">
          {lead.decisionLogs.map((log) => (
            <div key={log.id} className="border border-[var(--line)] rounded-lg p-4 text-sm bg-[var(--surface)]">
              <div className="flex justify-between text-xs text-[var(--text-dim)] mb-1">
                <span className="font-mono">{log.agentName}</span>
                <span>{log.createdAt.toLocaleString("ja-JP")}</span>
              </div>
              <div className="font-medium">{log.decision}</div>
              <div className="text-[var(--text-dim)] mt-1">{log.reason}</div>
              <div className="text-xs text-[var(--text-dim)] mt-2 font-mono">
                {log.model} · {log.tokensUsed} tokens · ${log.costUsd.toString()}
              </div>
            </div>
          ))}
          {lead.decisionLogs.length === 0 && (
            <p className="text-sm text-[var(--text-dim)]">まだ記録がありません。</p>
          )}
        </div>
      </section>
    </div>
  );
}
