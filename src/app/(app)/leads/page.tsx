import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createLead } from "./actions";
import { LEAD_STATUS_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  NEW: "bg-[var(--surface-2)] text-[var(--text-dim)]",
  RESEARCHED: "bg-[var(--surface-2)] text-[var(--text-dim)]",
  QUALIFIED: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
  CONTACTED: "bg-[var(--gold-tint)] text-[var(--gold)]",
  REPLIED: "bg-[var(--gold-tint)] text-[var(--gold)]",
  INTERESTED: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
  MEETING: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
  PROPOSAL: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
  NEGOTIATION: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
  WON: "bg-[var(--accent)] text-white",
  LOST: "bg-[var(--danger-tint)] text-[var(--danger)]",
};

const inputClass =
  "border border-[var(--line)] rounded-xl px-3.5 py-2.5 bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-dim)]";

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({
    include: { company: true },
    orderBy: [{ potentialScore: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">
          リード管理
        </h1>
        <p className="text-[var(--text-dim)] mt-1">
          企業リード登録 → Agent 01 が自動でSEO分析・見込みスコアリングを実行します。
        </p>
      </div>

      <form
        action={createLead}
        className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 shadow-sm"
      >
        <input name="name" placeholder="会社名" required className={inputClass} />
        <input name="website" placeholder="https://example.com" required className={inputClass} />
        <input name="industry" placeholder="業種" className={inputClass} />
        <input name="location" placeholder="所在地" className={inputClass} />
        <button
          type="submit"
          className="sm:col-span-4 justify-self-start bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white rounded-xl px-5 py-2.5 text-sm font-medium shadow-sm"
        >
          リード登録してAgent 01を実行
        </button>
      </form>

      <div className="overflow-x-auto border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium tracking-wide text-[var(--text-dim)] border-b border-[var(--line)]">
              <th className="px-4 py-3">会社名</th>
              <th className="px-4 py-3">業種</th>
              <th className="px-4 py-3">SEOスコア</th>
              <th className="px-4 py-3">見込み度</th>
              <th className="px-4 py-3">ステータス</th>
              <th className="px-4 py-3">最終接触</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)] transition-colors"
              >
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="font-medium text-[var(--text)] hover:text-[var(--accent)]">
                    {lead.company.name}
                  </Link>
                  <div className="text-xs text-[var(--text-dim)]">{lead.company.website}</div>
                </td>
                <td className="px-4 py-3 text-[var(--text-dim)]">{lead.company.industry ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums text-[var(--text)]">{lead.seoScore ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums font-medium text-[var(--text)]">
                  {lead.potentialScore ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      STATUS_STYLE[lead.status] ?? ""
                    }`}
                  >
                    {LEAD_STATUS_LABEL[lead.status] ?? lead.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--text-dim)]">
                  {lead.lastContactedAt ? lead.lastContactedAt.toLocaleDateString("ja-JP") : "—"}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-dim)]">
                  リードがまだありません。上のフォームから登録してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
