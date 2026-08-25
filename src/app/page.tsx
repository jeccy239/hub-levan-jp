import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Always shows live counts — must never be statically prerendered at build
// time (would either bake in stale numbers or fail the build if the DB is
// unreachable from the build environment).
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totalLeads, qualified, pendingApprovals, decisions] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: { in: ["QUALIFIED", "CONTACTED", "REPLIED", "INTERESTED"] } } }),
    prisma.outreachMessage.count({ where: { direction: "OUTBOUND", approvalStatus: "PENDING" } }),
    prisma.aiDecisionLog.count(),
  ]);

  const totalCost = await prisma.aiDecisionLog.aggregate({ _sum: { costUsd: true } });

  const cards = [
    { label: "登録リード数", value: totalLeads.toLocaleString("ja-JP") },
    { label: "営業対象（調査済み以降）", value: qualified.toLocaleString("ja-JP") },
    { label: "承認待ちメッセージ", value: pendingApprovals.toLocaleString("ja-JP") },
    { label: "AI判断ログ件数", value: decisions.toLocaleString("ja-JP") },
    { label: "累計AIコスト（USD）", value: `$${(totalCost._sum.costUsd ?? 0).toString()}` },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">
          ダッシュボード
        </h1>
        <p className="text-[var(--text-dim)] mt-1">リード獲得〜営業承認フローの状況</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="text-xs text-[var(--text-dim)] mb-1">{c.label}</div>
            <div className="text-2xl font-semibold tabular-nums text-[var(--text)]">{c.value}</div>
          </div>
        ))}
      </div>

      {pendingApprovals > 0 && (
        <div className="border border-[var(--gold)]/30 bg-[var(--gold-tint)] rounded-2xl p-4">
          <p className="text-sm text-[var(--text)]">
            <strong>{pendingApprovals}件</strong> の営業メッセージが承認待ちです。
            <Link href="/leads" className="text-[var(--accent)] font-medium ml-1 hover:underline">
              リード一覧を確認
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
