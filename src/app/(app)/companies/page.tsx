import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createCompany } from "./actions";

export const dynamic = "force-dynamic";

const inputClass =
  "border border-[var(--line)] rounded-xl px-3.5 py-2.5 bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-dim)]";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const [companies, statuses, leadSources] = await Promise.all([
    prisma.company.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { nameKana: { contains: query, mode: "insensitive" } },
              { industry: { contains: query, mode: "insensitive" } },
              { contacts: { some: { name: { contains: query, mode: "insensitive" } } } },
              { contacts: { some: { email: { contains: query, mode: "insensitive" } } } },
            ],
          }
        : undefined,
      include: { status: true, leadSource: true, contacts: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.companyStatus.findMany({ orderBy: { order: "asc" } }),
    prisma.leadSource.findMany({ orderBy: { order: "asc" } }),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">顧客管理</h1>
        <p className="text-[var(--text-dim)] mt-1">会社単位で顧客情報・担当者・ステータスを管理します。</p>
      </div>

      <form method="get" className="flex gap-3">
        <input
          name="q"
          defaultValue={query}
          placeholder="会社名・担当者名・メール・業種で検索"
          className={`flex-1 ${inputClass}`}
        />
        <button type="submit" className="text-sm bg-[var(--surface-2)] hover:bg-[var(--line)] rounded-xl px-4 py-2 font-medium text-[var(--text)]">
          検索
        </button>
      </form>

      <details className="border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm p-5">
        <summary className="text-sm font-medium text-[var(--text)] cursor-pointer">新規顧客を登録</summary>
        <form action={createCompany} className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input name="name" placeholder="会社名" required className={inputClass} />
          <input name="website" placeholder="https://example.com" className={inputClass} />
          <input name="industry" placeholder="業種" className={inputClass} />
          <input name="location" placeholder="所在地" className={inputClass} />
          <select name="statusId" defaultValue={statuses.find((s) => s.isDefault)?.id ?? ""} className={inputClass}>
            <option value="">ステータス未設定</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select name="leadSourceId" defaultValue="" className={inputClass}>
            <option value="">流入経路未設定</option>
            {leadSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="submit" className="sm:col-span-4 justify-self-start bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white rounded-xl px-5 py-2.5 text-sm font-medium shadow-sm">
            登録
          </button>
        </form>
      </details>

      <div className="overflow-x-auto border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium tracking-wide text-[var(--text-dim)] border-b border-[var(--line)]">
              <th className="px-4 py-3">会社名</th>
              <th className="px-4 py-3">業種</th>
              <th className="px-4 py-3">ステータス</th>
              <th className="px-4 py-3">流入経路</th>
              <th className="px-4 py-3">担当者数</th>
              <th className="px-4 py-3">最終接点</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/companies/${c.id}`} className="font-medium text-[var(--text)] hover:text-[var(--accent)]">
                    {c.name}
                  </Link>
                  {c.website && <div className="text-xs text-[var(--text-dim)]">{c.website}</div>}
                </td>
                <td className="px-4 py-3 text-[var(--text-dim)]">{c.industry ?? "—"}</td>
                <td className="px-4 py-3">
                  {c.status ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--accent-tint)] text-[var(--accent-strong)]">
                      {c.status.name}
                    </span>
                  ) : (
                    <span className="text-[var(--text-dim)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--text-dim)]">{c.leadSource?.name ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums text-[var(--text)]">{c.contacts.length}</td>
                <td className="px-4 py-3 text-[var(--text-dim)]">
                  {c.lastContactAt ? c.lastContactAt.toLocaleDateString("ja-JP") : "—"}
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-dim)]">
                  {query ? "該当する顧客が見つかりません。" : "まだ顧客がありません。"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
