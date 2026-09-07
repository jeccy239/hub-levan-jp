import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { LeadStatus } from "@/generated/prisma/client";
import { fetchWebrisOrganizations } from "@/lib/webris";
import { TOOL_INTEREST_CATEGORIES } from "@/agents/leadResearchAgent";
import ProspectingButton from "./ProspectingButton";

export const dynamic = "force-dynamic";

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end };
}

const card = "border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm";

export default async function SalesAiPage() {
  const { start, end } = todayRange();

  const [scheduled, analyzed, mailed, opened, clicked, webrisOrgs] = await Promise.all([
    prisma.lead.count({ where: { status: LeadStatus.QUALIFIED } }),
    prisma.lead.count({ where: { seoScore: { not: null } } }),
    prisma.outreachMessage.count({ where: { direction: "OUTBOUND", sentAt: { gte: start, lt: end } } }),
    prisma.outreachMessage.count({ where: { openedAt: { gte: start, lt: end } } }),
    prisma.outreachMessage.count({ where: { clickedAt: { gte: start, lt: end } } }),
    fetchWebrisOrganizations().catch(() => []),
  ]);

  const freeSignupsToday = webrisOrgs.filter(
    (o) => o.planCode === "free" && new Date(o.createdAt) >= start && new Date(o.createdAt) < end,
  ).length;
  const paidTotal = webrisOrgs.filter((o) => o.planCode !== "free").length;

  const stats = [
    { label: "送信予定", value: scheduled, unit: "社" },
    { label: "分析完了", value: analyzed, unit: "社" },
    { label: "メール送信", value: mailed, unit: "社" },
    { label: "開封", value: opened, unit: "社" },
    { label: "クリック", value: clicked, unit: "社" },
    { label: "Free登録", value: freeSignupsToday, unit: "社" },
    { label: "有料化", value: paidTotal, unit: "社" },
  ];

  const qualifiedLeads = await prisma.lead.findMany({
    where: { status: { in: [LeadStatus.QUALIFIED, LeadStatus.CONTACTED] } },
    include: { company: true },
    orderBy: { potentialScore: "desc" },
    take: 20,
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">WEBRIS SALES AI</h1>
          <p className="text-[var(--text-dim)] mt-1">
            SEOツール・ヒートマップツール・LLMOツール利用企業や広告代理店を自動リサーチし、営業メールを一斉配信します。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProspectingButton />
          <Link
            href="/sales-ai/compose"
            className="text-sm font-medium px-4 py-2 rounded-full bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
          >
            メール作成・一斉配信
          </Link>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-medium text-[var(--text-dim)] mb-3">本日の営業</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {stats.map((s) => (
            <div key={s.label} className={card}>
              <div className="text-xs text-[var(--text-dim)] mb-1">{s.label}</div>
              <div className="text-2xl font-semibold tabular-nums text-[var(--text)]">
                {s.value.toLocaleString("ja-JP")}
                <span className="text-sm font-normal text-[var(--text-dim)] ml-0.5">{s.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--text-dim)]">リサーチ対象カテゴリ</h2>
        <div className="flex flex-wrap gap-2">
          {TOOL_INTEREST_CATEGORIES.map((c) => (
            <span key={c} className="px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--surface-2)] text-[var(--text-dim)]">
              {c}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-[var(--text)]">営業対象リード（見込み度順）</h2>
        <div className="overflow-x-auto border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium tracking-wide text-[var(--text-dim)] border-b border-[var(--line)]">
                <th className="px-4 py-3">会社名</th>
                <th className="px-4 py-3">カテゴリ</th>
                <th className="px-4 py-3">見込み度</th>
                <th className="px-4 py-3">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {qualifiedLeads.map((lead) => (
                <tr key={lead.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-[var(--text)] hover:text-[var(--accent)]">
                      {lead.company.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-dim)]">{lead.company.toolInterest ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-[var(--text)]">{lead.potentialScore ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--text-dim)]">{lead.status}</td>
                </tr>
              ))}
              {qualifiedLeads.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-dim)]">
                    営業対象のリードがまだありません。「リサーチ実行」から候補企業を発掘してください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
