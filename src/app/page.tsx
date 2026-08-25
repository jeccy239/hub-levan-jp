import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const [totalLeads, qualified, pendingApprovals, decisions] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: { in: ["QUALIFIED", "CONTACTED", "REPLIED", "INTERESTED"] } } }),
    prisma.outreachMessage.count({ where: { direction: "OUTBOUND", approvalStatus: "PENDING" } }),
    prisma.aiDecisionLog.count(),
  ]);

  const totalCost = await prisma.aiDecisionLog.aggregate({ _sum: { costUsd: true } });

  const cards = [
    { label: "登録リード数", value: totalLeads },
    { label: "営業対象（QUALIFIED以降）", value: qualified },
    { label: "承認待ちメッセージ", value: pendingApprovals },
    { label: "AI判断ログ件数", value: decisions },
    { label: "累計AIコスト", value: `$${(totalCost._sum.costUsd ?? 0).toString()}` },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--accent-strong)]">Dashboard</h1>
        <p className="text-[var(--text-dim)] mt-1">Phase 1 MVP — リード獲得〜営業承認フロー</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="border border-[var(--line)] rounded-lg p-5 bg-[var(--surface)]">
            <div className="text-xs text-[var(--text-dim)] mb-1">{c.label}</div>
            <div className="text-2xl font-bold tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>

      {pendingApprovals > 0 && (
        <div className="border-l-4 border-[var(--gold)] bg-[var(--gold-tint)] rounded-r-lg p-4">
          <p className="text-sm">
            <strong>{pendingApprovals}件</strong> の営業メッセージが承認待ちです。
            <Link href="/leads" className="underline ml-1">
              Lead一覧を確認
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
