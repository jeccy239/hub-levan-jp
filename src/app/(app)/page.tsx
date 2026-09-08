import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/authz";

// Always shows live counts — must never be statically prerendered at build
// time (would either bake in stale numbers or fail the build if the DB is
// unreachable from the build environment).
export const dynamic = "force-dynamic";

const CONTENT_STATUS_LABEL: Record<string, string> = {
  KEYWORD: "キーワード選定",
  DRAFTED: "執筆済み",
  QC_REVIEWED: "QC済み",
  HUMAN_REVIEW: "要人手レビュー",
  APPROVED: "承認済み",
  PUBLISHED: "公開済み",
};

const TASK_PRIORITY_LABEL: Record<string, string> = { HIGH: "高", MEDIUM: "中", LOW: "低" };
const TASK_PRIORITY_CLASS: Record<string, string> = {
  HIGH: "bg-red-500/10 text-red-600",
  MEDIUM: "bg-[var(--gold-tint)] text-[var(--gold)]",
  LOW: "bg-[var(--surface-2)] text-[var(--text-dim)]",
};

function fmtDate(d: Date) {
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function fmtDateTime(d: Date) {
  return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function jpy(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const renewalHorizon = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const [
    totalLeads,
    qualified,
    pendingMessages,
    pendingProposals,
    pendingUpsells,
    decisions,
    totalCost,
    activeContracts,
    activeContractSum,
    myTasks,
    upcomingRenewals,
    recentActivities,
    recentMessages,
    contentByStatus,
    monthMessagesSent,
    monthMessagesOpened,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: { in: ["QUALIFIED", "CONTACTED", "REPLIED", "INTERESTED"] } } }),
    prisma.outreachMessage.count({ where: { direction: "OUTBOUND", approvalStatus: "PENDING" } }),
    prisma.proposal.count({ where: { status: "PENDING" } }),
    prisma.upsellProposal.count({ where: { status: "PENDING" } }),
    prisma.aiDecisionLog.count(),
    prisma.aiDecisionLog.aggregate({ _sum: { costUsd: true } }),
    prisma.contract.count(),
    prisma.contract.aggregate({ _sum: { monthlyFeeJpy: true } }),
    prisma.task.findMany({
      where: { assigneeId: user.id, status: { not: "DONE" } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 6,
      include: { company: { select: { name: true } } },
    }),
    prisma.contract.findMany({
      where: { renewalDate: { lte: renewalHorizon } },
      orderBy: { renewalDate: "asc" },
      take: 5,
      include: { customer: { include: { company: { select: { name: true } } } } },
    }),
    prisma.activity.findMany({
      orderBy: { occurredAt: "desc" },
      take: 5,
      include: { company: { select: { name: true } }, user: { select: { name: true, email: true } } },
    }),
    prisma.outreachMessage.findMany({
      where: { direction: "OUTBOUND", sentAt: { not: null } },
      orderBy: { sentAt: "desc" },
      take: 5,
      include: { lead: { include: { company: { select: { name: true } } } }, company: { select: { name: true } } },
    }),
    prisma.contentItem.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.outreachMessage.count({
      where: { direction: "OUTBOUND", sentAt: { gte: monthStart } },
    }),
    prisma.outreachMessage.count({
      where: { direction: "OUTBOUND", sentAt: { gte: monthStart }, openedAt: { not: null } },
    }),
  ]);

  const pendingApprovalsTotal = pendingMessages + pendingProposals + pendingUpsells;
  const openRate = monthMessagesSent > 0 ? Math.round((monthMessagesOpened / monthMessagesSent) * 100) : null;

  const cards = [
    { label: "契約中の顧客", value: activeContracts.toLocaleString("ja-JP"), href: "/companies" },
    { label: "月次契約金額（MRR）", value: jpy(Number(activeContractSum._sum.monthlyFeeJpy ?? 0)), href: "/companies" },
    { label: "登録リード数", value: totalLeads.toLocaleString("ja-JP"), href: "/leads" },
    { label: "営業対象（調査済み以降）", value: qualified.toLocaleString("ja-JP"), href: "/leads" },
    { label: "承認待ち合計", value: pendingApprovalsTotal.toLocaleString("ja-JP"), href: "/leads" },
    { label: "今月のメール送信数", value: monthMessagesSent.toLocaleString("ja-JP"), href: "/sales-ai" },
    { label: "今月の開封率", value: openRate === null ? "—" : `${openRate}%`, href: "/sales-ai" },
    { label: "累計AIコスト（USD）", value: `$${(totalCost._sum.costUsd ?? 0).toString()}`, href: "/webris/claude-usage" },
  ];

  const contentStatusOrder = ["KEYWORD", "DRAFTED", "QC_REVIEWED", "HUMAN_REVIEW", "APPROVED", "PUBLISHED"];
  const contentCounts = new Map<string, number>(contentByStatus.map((c) => [c.status, c._count._all]));
  const contentTotal = contentByStatus.reduce((sum, c) => sum + c._count._all, 0);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">
          おかえりなさい、{user.name || user.email}さん
        </h1>
        <p className="text-[var(--text-dim)] mt-1">
          {now.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          　— リード獲得〜営業承認・既存顧客運用の状況
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="text-xs text-[var(--text-dim)] mb-1">{c.label}</div>
            <div className="text-2xl font-semibold tabular-nums text-[var(--text)]">{c.value}</div>
          </Link>
        ))}
      </div>

      {pendingApprovalsTotal > 0 && (
        <div className="border border-[var(--gold)]/30 bg-[var(--gold-tint)] rounded-2xl p-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--text)]">
          {pendingMessages > 0 && (
            <span>
              <strong>{pendingMessages}件</strong> の営業メッセージが承認待ち —{" "}
              <Link href="/leads" className="text-[var(--accent)] font-medium hover:underline">
                確認する
              </Link>
            </span>
          )}
          {pendingProposals > 0 && (
            <span>
              <strong>{pendingProposals}件</strong> の提案が承認待ち
            </span>
          )}
          {pendingUpsells > 0 && (
            <span>
              <strong>{pendingUpsells}件</strong> のアップセル提案が承認待ち
            </span>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* 自分のタスク */}
        <section className="border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="font-semibold text-[var(--text)]">自分の未完了タスク</h2>
            <Link href="/tasks" className="text-xs text-[var(--accent)] hover:underline">
              すべて見る
            </Link>
          </div>
          <div className="px-5 pb-5">
            {myTasks.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)] py-4">未完了のタスクはありません。</p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {myTasks.map((t) => {
                  const overdue = t.dueDate && t.dueDate < now;
                  return (
                    <li key={t.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--text)] truncate">{t.title}</p>
                        <p className="text-xs text-[var(--text-dim)] mt-0.5">
                          {t.company?.name ?? "—"}
                          {t.dueDate && (
                            <span className={overdue ? "text-red-600 font-medium ml-2" : "ml-2"}>
                              期限 {fmtDate(t.dueDate)}
                              {overdue ? "（期限超過）" : ""}
                            </span>
                          )}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${TASK_PRIORITY_CLASS[t.priority]}`}
                      >
                        {TASK_PRIORITY_LABEL[t.priority]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* 契約更新間近 */}
        <section className="border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="font-semibold text-[var(--text)]">契約更新が近い顧客（60日以内）</h2>
            <Link href="/companies" className="text-xs text-[var(--accent)] hover:underline">
              顧客一覧
            </Link>
          </div>
          <div className="px-5 pb-5">
            {upcomingRenewals.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)] py-4">60日以内の更新予定はありません。</p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {upcomingRenewals.map((c) => (
                  <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text)] truncate">{c.customer.company.name}</p>
                      <p className="text-xs text-[var(--text-dim)] mt-0.5">{c.plan}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-[var(--text)] tabular-nums">{fmtDate(c.renewalDate)}</p>
                      <p className="text-xs text-[var(--text-dim)] tabular-nums">
                        {jpy(Number(c.monthlyFeeJpy))}/月
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 最近のアクティビティ */}
        <section className="border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="font-semibold text-[var(--text)]">最近のアクティビティ</h2>
          </div>
          <div className="px-5 pb-5">
            {recentActivities.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)] py-4">記録された活動はまだありません。</p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {recentActivities.map((a) => (
                  <li key={a.id} className="py-3">
                    <p className="text-sm text-[var(--text)]">
                      <span className="font-medium">{a.company.name}</span>
                      <span className="text-[var(--text-dim)]"> ・ {a.type}</span>
                    </p>
                    <p className="text-xs text-[var(--text-dim)] mt-0.5 line-clamp-1">{a.content}</p>
                    <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
                      {a.user.name || a.user.email} ・ {fmtDateTime(a.occurredAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 最近の営業メール送信 */}
        <section className="border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="font-semibold text-[var(--text)]">最近の営業メール送信</h2>
            <Link href="/sales-ai" className="text-xs text-[var(--accent)] hover:underline">
              メール管理
            </Link>
          </div>
          <div className="px-5 pb-5">
            {recentMessages.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)] py-4">送信履歴はまだありません。</p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {recentMessages.map((m) => (
                  <li key={m.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text)] truncate">
                        {m.lead?.company.name ?? m.company?.name ?? m.toEmail ?? "—"}
                      </p>
                      <p className="text-xs text-[var(--text-dim)] mt-0.5 truncate">{m.subject}</p>
                    </div>
                    <div className="text-right shrink-0 text-[11px] text-[var(--text-dim)]">
                      <p>{m.sentAt && fmtDateTime(m.sentAt)}</p>
                      <p className="mt-0.5">
                        {m.clickedAt ? (
                          <span className="text-emerald-600 font-medium">クリック済み</span>
                        ) : m.openedAt ? (
                          <span className="text-[var(--accent)] font-medium">開封済み</span>
                        ) : (
                          "未開封"
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* コンテンツ制作パイプライン */}
      {contentTotal > 0 && (
        <section className="border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--text)]">コンテンツ制作パイプライン</h2>
            <span className="text-xs text-[var(--text-dim)]">全{contentTotal}件</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {contentStatusOrder.map((status) => {
              const count = contentCounts.get(status) ?? 0;
              return (
                <div key={status} className="border border-[var(--line)] rounded-xl p-3 bg-[var(--surface-2)]">
                  <div className="text-xs text-[var(--text-dim)] mb-1">{CONTENT_STATUS_LABEL[status]}</div>
                  <div className="text-xl font-semibold tabular-nums text-[var(--text)]">{count}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
