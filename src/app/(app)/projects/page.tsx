import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    include: {
      customer: { include: { company: true } },
      contentItems: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">案件管理</h1>
        <p className="text-[var(--text-dim)] mt-1">
          契約成立と同時に自動作成される、顧客ごとのSEO制作案件です。
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {projects.map((project) => {
          const published = project.contentItems.filter((c) => c.status === "PUBLISHED").length;
          const needsReview = project.contentItems.filter((c) => c.status === "HUMAN_REVIEW").length;

          return (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="font-semibold text-[var(--text)]">{project.customer.company.name}</div>
              <div className="text-xs text-[var(--text-dim)] mb-3">{project.customer.company.website}</div>
              <div className="flex gap-4 text-sm">
                <span className="text-[var(--text-dim)]">
                  記事 <span className="text-[var(--text)] font-medium">{project.contentItems.length}</span>
                </span>
                <span className="text-[var(--text-dim)]">
                  公開済み <span className="text-[var(--text)] font-medium">{published}</span>
                </span>
                {needsReview > 0 && (
                  <span className="text-[var(--danger)] font-medium">要レビュー {needsReview}</span>
                )}
              </div>
            </Link>
          );
        })}
        {projects.length === 0 && (
          <p className="text-sm text-[var(--text-dim)]">
            まだ案件がありません。リードが成約すると自動的にここに表示されます。
          </p>
        )}
      </div>
    </div>
  );
}
