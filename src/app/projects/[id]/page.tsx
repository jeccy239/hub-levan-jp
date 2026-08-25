import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  approveContent,
  generateDraft,
  generateKeywords,
  publishContent,
  runQc,
  sendBackToDraft,
} from "../actions";
import { CONTENT_STATUS_LABEL } from "@/lib/labels";

const primaryButton =
  "text-sm bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white rounded-xl px-4 py-2 font-medium shadow-sm";
const linkButton = (color: "accent" | "danger" | "neutral") =>
  `text-xs font-medium rounded-full px-3 py-1 ${
    color === "accent"
      ? "text-[var(--accent)] hover:bg-[var(--accent-tint)]"
      : color === "danger"
        ? "text-[var(--danger)] hover:bg-[var(--danger-tint)]"
        : "text-[var(--text-dim)] hover:bg-[var(--surface-2)]"
  }`;
const card = "border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm";

const STATUS_STYLE: Record<string, string> = {
  KEYWORD: "bg-[var(--surface-2)] text-[var(--text-dim)]",
  DRAFTED: "bg-[var(--gold-tint)] text-[var(--gold)]",
  QC_REVIEWED: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
  HUMAN_REVIEW: "bg-[var(--danger-tint)] text-[var(--danger)]",
  APPROVED: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
  PUBLISHED: "bg-[var(--accent)] text-white",
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      customer: { include: { company: true } },
      contentItems: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!project) notFound();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-start justify-between gap-6 border-b border-[var(--line)] pb-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-[var(--text)]">
            {project.customer.company.name}
          </h1>
          <p className="text-[var(--text-dim)]">{project.customer.company.website}</p>
        </div>
        {project.contentItems.length === 0 && (
          <form action={generateKeywords.bind(null, project.id)}>
            <button type="submit" className={primaryButton}>
              SEO戦略を生成（Agent 06）
            </button>
          </form>
        )}
      </div>

      <div className="space-y-4">
        {project.contentItems.map((item) => {
          const outline = Array.isArray(item.outlineJson) ? (item.outlineJson as string[]) : [];
          const links = Array.isArray(item.internalLinkCandidates)
            ? (item.internalLinkCandidates as string[])
            : [];
          const issues = Array.isArray(item.qcIssues) ? (item.qcIssues as string[]) : [];

          return (
            <div key={item.id} className={`${card} space-y-3`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-[var(--text-dim)]">
                    優先度 {item.priority ?? "—"} ・ 検索意図: {item.searchIntent ?? "—"}
                  </div>
                  <div className="font-medium text-[var(--text)]">{item.title ?? item.keyword}</div>
                </div>
                <span
                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${
                    STATUS_STYLE[item.status] ?? ""
                  }`}
                >
                  {CONTENT_STATUS_LABEL[item.status] ?? item.status}
                </span>
              </div>

              {item.status === "KEYWORD" && (
                <form action={generateDraft.bind(null, item.id, project.id)}>
                  <button type="submit" className={primaryButton}>
                    記事を生成（Agent 07）
                  </button>
                </form>
              )}

              {item.draftBody && (
                <div className="text-sm text-[var(--text)] space-y-2">
                  {outline.length > 0 && (
                    <p className="text-[var(--text-dim)]">構成: {outline.join(" / ")}</p>
                  )}
                  <p className="whitespace-pre-wrap">{item.draftBody}</p>
                  {links.length > 0 && (
                    <p className="text-[var(--text-dim)] text-xs">
                      内部リンク候補: {links.join(" / ")}
                    </p>
                  )}
                  {item.cta && <p className="text-xs text-[var(--text-dim)]">CTA: {item.cta}</p>}
                </div>
              )}

              {item.status === "DRAFTED" && (
                <form action={runQc.bind(null, item.id, project.id)}>
                  <button type="submit" className={primaryButton}>
                    品質チェックを実行（Agent 08）
                  </button>
                </form>
              )}

              {item.qcScore !== null && (
                <div className="text-sm border-t border-[var(--line)] pt-3">
                  <span className="text-[var(--text-dim)]">QCスコア: </span>
                  <span className="font-medium text-[var(--text)]">{item.qcScore}点</span>
                  {item.ymylFlag && (
                    <span className="ml-2 text-xs text-[var(--danger)] font-medium">YMYL該当</span>
                  )}
                  {issues.length > 0 && (
                    <ul className="list-disc pl-5 mt-1 text-[var(--text-dim)]">
                      {issues.map((iss, i) => (
                        <li key={i}>{iss}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {(item.status === "QC_REVIEWED" || item.status === "HUMAN_REVIEW") && (
                <div className="flex gap-2">
                  <form action={approveContent.bind(null, item.id, project.id)}>
                    <button type="submit" className={linkButton("accent")}>
                      承認
                    </button>
                  </form>
                  <form action={sendBackToDraft.bind(null, item.id, project.id)}>
                    <button type="submit" className={linkButton("neutral")}>
                      差し戻し
                    </button>
                  </form>
                </div>
              )}

              {item.status === "APPROVED" && (
                <form action={publishContent.bind(null, item.id, project.id)}>
                  <button type="submit" className={primaryButton}>
                    CMSに入稿して公開
                  </button>
                </form>
              )}

              {item.status === "PUBLISHED" && item.publishedUrl && (
                <div className="text-xs text-[var(--text-dim)]">
                  公開URL:{" "}
                  <a href={item.publishedUrl} className="text-[var(--accent)] hover:underline">
                    {item.publishedUrl}
                  </a>
                  {item.publishedAt && ` （${item.publishedAt.toLocaleDateString("ja-JP")}）`}
                </div>
              )}
            </div>
          );
        })}

        {project.contentItems.length === 0 && (
          <p className="text-sm text-[var(--text-dim)]">
            まだキーワード計画がありません。上のボタンからAgent 06を実行してください。
          </p>
        )}
      </div>
    </div>
  );
}
