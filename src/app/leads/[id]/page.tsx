import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  approveMessage,
  approveProposalAction,
  declineMessage,
  generateBriefing,
  generateOutreachDraft,
  rejectProposalAction,
  signContractAction,
  submitMeetingTranscript,
  submitReply,
} from "../actions";
import {
  AGENT_NAME_LABEL,
  APPROVAL_STATUS_LABEL,
  LEAD_STATUS_LABEL,
  REPLY_CATEGORY_LABEL,
  formatYen,
} from "@/lib/labels";

const READY_FOR_MEETING: string[] = ["INTERESTED", "MEETING", "PROPOSAL", "NEGOTIATION", "WON"];

const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  PENDING: "承認待ち",
  APPROVED: "承認済み",
  REJECTED: "却下",
};

const primaryButton =
  "text-sm bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white rounded-xl px-4 py-2 font-medium shadow-sm";
const secondaryButton =
  "text-sm bg-[var(--surface-2)] hover:bg-[var(--line)] text-[var(--text)] rounded-xl px-4 py-2 font-medium";
const linkButton = (color: "accent" | "danger") =>
  `text-xs font-medium rounded-full px-3 py-1 ${
    color === "accent"
      ? "text-[var(--accent)] hover:bg-[var(--accent-tint)]"
      : "text-[var(--danger)] hover:bg-[var(--danger-tint)]"
  }`;
const textInput =
  "border border-[var(--line)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-dim)]";
const card = "border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      company: true,
      outreachMessages: { orderBy: { createdAt: "asc" } },
      decisionLogs: { orderBy: { createdAt: "desc" } },
      meetings: { orderBy: { createdAt: "asc" }, include: { proposals: true } },
      proposals: { orderBy: { createdAt: "asc" } },
      contract: true,
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
          <h1 className="text-[26px] font-semibold tracking-tight text-[var(--text)]">
            {lead.company.name}
          </h1>
          <p className="text-[var(--text-dim)]">{lead.company.website}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--accent-tint)] text-[var(--accent-strong)]">
          {LEAD_STATUS_LABEL[lead.status] ?? lead.status}
        </span>
      </div>

      <section className="grid grid-cols-2 gap-6">
        <div className={card}>
          <div className="text-xs text-[var(--text-dim)] mb-1">SEOスコア</div>
          <div className="text-3xl font-semibold tabular-nums text-[var(--text)]">
            {lead.seoScore ?? "—"}
          </div>
        </div>
        <div className={card}>
          <div className="text-xs text-[var(--text-dim)] mb-1">見込み度スコア（Agent 01）</div>
          <div className="text-3xl font-semibold tabular-nums text-[var(--text)]">
            {lead.potentialScore ?? "—"}
          </div>
        </div>
      </section>

      {opportunities.length > 0 && (
        <section>
          <h2 className="font-semibold text-[var(--text)] mb-2">SEO課題</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-dim)]">
            {opportunities.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
          {lead.reasonToContact && (
            <p className="text-sm mt-3 text-[var(--text)]">
              <span className="text-[var(--text-dim)]">営業理由: </span>
              {lead.reasonToContact}
            </p>
          )}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text)]">営業メッセージ（Agent 02）</h2>
          {!pendingMessage && (
            <form action={generateOutreachDraft.bind(null, lead.id)}>
              <button type="submit" className={primaryButton}>
                営業文を生成
              </button>
            </form>
          )}
        </div>

        <div className="space-y-3">
          {lead.outreachMessages.map((m) => (
            <div key={m.id} className={card}>
              <div className="flex justify-between items-center text-xs text-[var(--text-dim)] mb-2">
                <span>{m.direction === "OUTBOUND" ? "送信（下書き）" : "受信"}</span>
                <span>{m.createdAt.toLocaleString("ja-JP")}</span>
              </div>
              {m.subject && <div className="font-medium mb-1 text-[var(--text)]">{m.subject}</div>}
              <p className="text-sm whitespace-pre-wrap text-[var(--text)]">{m.body}</p>
              {m.direction === "OUTBOUND" && (
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      m.approvalStatus === "APPROVED"
                        ? "bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                        : m.approvalStatus === "REJECTED"
                          ? "bg-[var(--danger-tint)] text-[var(--danger)]"
                          : "bg-[var(--gold-tint)] text-[var(--gold)]"
                    }`}
                  >
                    {m.approvalStatus ? APPROVAL_STATUS_LABEL[m.approvalStatus] : ""}
                  </span>
                  {m.approvalStatus === "PENDING" && (
                    <>
                      <form action={approveMessage.bind(null, m.id, lead.id)}>
                        <button className={linkButton("accent")} type="submit">
                          承認して送信
                        </button>
                      </form>
                      <form action={declineMessage.bind(null, m.id, lead.id)}>
                        <button className={linkButton("danger")} type="submit">
                          却下
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}
              {m.replyCategory && (
                <div className="mt-2 text-xs text-[var(--text-dim)]">
                  分類: {REPLY_CATEGORY_LABEL[m.replyCategory] ?? m.replyCategory}
                </div>
              )}
            </div>
          ))}
        </div>

        <details className={card}>
          <summary className="text-sm cursor-pointer text-[var(--text-dim)]">
            返信を記録（テスト用シミュレーション）
          </summary>
          <form action={submitReply} className="mt-3 flex gap-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <textarea
              name="body"
              required
              placeholder="受信した返信本文を貼り付け"
              className={`flex-1 ${textInput}`}
              rows={2}
            />
            <button type="submit" className={`${secondaryButton} self-start`}>
              記録して分類
            </button>
          </form>
        </details>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text)]">商談〜契約</h2>
          {READY_FOR_MEETING.includes(lead.status) && lead.meetings.length === 0 && (
            <form action={generateBriefing.bind(null, lead.id)}>
              <button type="submit" className={primaryButton}>
                商談ブリーフィングを生成（Agent 03）
              </button>
            </form>
          )}
        </div>

        {lead.meetings.map((meeting) => {
          const briefing = meeting.briefing as {
            companySummary?: string;
            competitors?: string[];
            currentIssues?: string[];
            assumedNeeds?: string[];
            proposedApproach?: string;
          } | null;

          return (
            <div key={meeting.id} className={`${card} space-y-3`}>
              <div className="flex justify-between items-center text-xs text-[var(--text-dim)]">
                <span>商談ブリーフィング</span>
                <span>{meeting.createdAt.toLocaleString("ja-JP")}</span>
              </div>
              {briefing && (
                <div className="text-sm space-y-2 text-[var(--text)]">
                  <p>{briefing.companySummary}</p>
                  {!!briefing.currentIssues?.length && (
                    <p>
                      <span className="text-[var(--text-dim)]">課題: </span>
                      {briefing.currentIssues.join(" / ")}
                    </p>
                  )}
                  {!!briefing.assumedNeeds?.length && (
                    <p>
                      <span className="text-[var(--text-dim)]">想定ニーズ: </span>
                      {briefing.assumedNeeds.join(" / ")}
                    </p>
                  )}
                  <p>
                    <span className="text-[var(--text-dim)]">提案方針: </span>
                    {briefing.proposedApproach}
                  </p>
                </div>
              )}

              {meeting.status === "BRIEFED" && (
                <form action={submitMeetingTranscript} className="space-y-2">
                  <input type="hidden" name="meetingId" value={meeting.id} />
                  <input type="hidden" name="leadId" value={lead.id} />
                  <textarea
                    name="transcript"
                    required
                    placeholder="商談の書き起こし・メモを貼り付け（テスト用シミュレーション）"
                    className={`w-full ${textInput}`}
                    rows={3}
                  />
                  <button type="submit" className={secondaryButton}>
                    議事録を記録して提案書を生成（Agent 04）
                  </button>
                </form>
              )}

              {meeting.minutesSummary && (
                <div className="text-sm border-t border-[var(--line)] pt-3 text-[var(--text)]">
                  <span className="text-[var(--text-dim)]">議事録要約: </span>
                  {meeting.minutesSummary}
                </div>
              )}

              {meeting.proposals.map((p) => (
                <div key={p.id} className="border-t border-[var(--line)] pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text)]">
                      提案: 月額 {formatYen(p.amountJpy.toString())}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        p.status === "APPROVED"
                          ? "bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                          : p.status === "REJECTED"
                            ? "bg-[var(--danger-tint)] text-[var(--danger)]"
                            : "bg-[var(--gold-tint)] text-[var(--gold)]"
                      }`}
                    >
                      {PROPOSAL_STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </div>
                  <ul className="list-disc pl-5 text-sm text-[var(--text-dim)]">
                    {(Array.isArray(p.scopeJson) ? (p.scopeJson as string[]) : []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                  {p.status === "PENDING" && (
                    <div className="flex gap-2">
                      <form action={approveProposalAction.bind(null, p.id, lead.id)}>
                        <button className={linkButton("accent")} type="submit">
                          承認
                        </button>
                      </form>
                      <form action={rejectProposalAction.bind(null, p.id, lead.id)}>
                        <button className={linkButton("danger")} type="submit">
                          却下
                        </button>
                      </form>
                    </div>
                  )}
                  {p.status === "APPROVED" && !lead.contract && (
                    <form action={signContractAction} className="grid grid-cols-3 gap-2 pt-2">
                      <input type="hidden" name="proposalId" value={p.id} />
                      <input type="hidden" name="leadId" value={lead.id} />
                      <input
                        name="plan"
                        required
                        defaultValue="SEO運用代行 基本プラン"
                        className={`col-span-2 ${textInput}`}
                      />
                      <input
                        name="monthlyFeeJpy"
                        type="number"
                        required
                        defaultValue={p.amountJpy.toString()}
                        className={textInput}
                      />
                      <button type="submit" className={`col-span-3 ${primaryButton}`}>
                        契約を記録（成約にする）
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {lead.contract && (
          <div className="border border-[var(--accent)]/30 rounded-2xl p-5 bg-[var(--accent-tint)] text-sm space-y-1">
            <div className="font-semibold text-[var(--accent-strong)]">契約済み</div>
            <div className="text-[var(--text)]">プラン: {lead.contract.plan}</div>
            <div className="text-[var(--text)]">
              月額: {formatYen(lead.contract.monthlyFeeJpy.toString())}
            </div>
            <div className="text-[var(--text)]">
              契約開始: {lead.contract.startDate.toLocaleDateString("ja-JP")}
            </div>
            <div className="text-[var(--text)]">
              更新日: {lead.contract.renewalDate.toLocaleDateString("ja-JP")}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-[var(--text)] mb-3">AI判断ログ</h2>
        <div className="space-y-2">
          {lead.decisionLogs.map((log) => (
            <div key={log.id} className={`${card} text-sm`}>
              <div className="flex justify-between text-xs text-[var(--text-dim)] mb-1">
                <span>{AGENT_NAME_LABEL[log.agentName] ?? log.agentName}</span>
                <span>{log.createdAt.toLocaleString("ja-JP")}</span>
              </div>
              <div className="font-medium text-[var(--text)]">{log.decision}</div>
              <div className="text-[var(--text-dim)] mt-1">{log.reason}</div>
              <div className="text-xs text-[var(--text-dim)] mt-2">
                使用モデル: {log.model === "stub" ? "スタブ応答（APIキー未設定）" : log.model} ・
                トークン数: {log.tokensUsed.toLocaleString("ja-JP")} ・ コスト: $
                {log.costUsd.toString()}
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
