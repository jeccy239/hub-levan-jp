import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  approveContent,
  approveUpsellAction,
  generateDraft,
  generateKeywords,
  generateReport,
  generateUpsell,
  presentUpsellAction,
  publishContent,
  rejectUpsellAction,
  runQc,
  sendBackToDraft,
  sendReport,
} from "../actions";
import { CONTENT_STATUS_LABEL, SEND_STATUS_LABEL, UPSELL_STATUS_LABEL } from "@/lib/labels";

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
      customer: { include: { company: true, upsellProposals: { orderBy: { createdAt: "desc" } } } },
      contentItems: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
      reports: { orderBy: { period: "desc" } },
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

      <section className="space-y-4 border-t border-[var(--line)] pt-8">
        <h2 className="font-semibold text-[var(--text)]">月次レポート（Agent 09）</h2>

        <form action={generateReport} className={`${card} grid grid-cols-2 sm:grid-cols-4 gap-3`}>
          <input type="hidden" name="projectId" value={project.id} />
          <input
            name="period"
            placeholder="対象月（例: 2026-08）"
            required
            className="col-span-2 border border-[var(--line)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)]"
          />
          <input
            name="pageViews"
            type="number"
            placeholder="PV数"
            required
            className="border border-[var(--line)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)]"
          />
          <input
            name="users"
            type="number"
            placeholder="ユーザー数"
            required
            className="border border-[var(--line)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)]"
          />
          <input
            name="avgRanking"
            type="number"
            placeholder="平均検索順位"
            required
            className="border border-[var(--line)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)]"
          />
          <input
            name="ctr"
            type="number"
            step="0.1"
            placeholder="CTR（%）"
            required
            className="border border-[var(--line)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)]"
          />
          <input
            name="conversions"
            type="number"
            placeholder="コンバージョン数"
            required
            className="border border-[var(--line)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)]"
          />
          <input
            name="cvr"
            type="number"
            step="0.1"
            placeholder="CVR（%）"
            required
            className="border border-[var(--line)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)]"
          />
          <input
            name="topQueries"
            placeholder="主要検索クエリ（カンマ区切り）"
            className="col-span-4 border border-[var(--line)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)]"
          />
          <button type="submit" className={`col-span-4 ${primaryButton} justify-self-start`}>
            レポートを生成
          </button>
        </form>

        <div className="space-y-3">
          {project.reports.map((report) => (
            <div key={report.id} className={`${card} space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--text)]">{report.period} 月次レポート</span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    report.status === "SENT"
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--gold-tint)] text-[var(--gold)]"
                  }`}
                >
                  {SEND_STATUS_LABEL[report.status] ?? report.status}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap text-[var(--text)]">{report.summaryText}</p>
              {report.status === "DRAFT" && (
                <form action={sendReport.bind(null, report.id, project.id)}>
                  <button type="submit" className={linkButton("accent")}>
                    承認して顧客に送信
                  </button>
                </form>
              )}
              {report.sentAt && (
                <p className="text-xs text-[var(--text-dim)]">
                  送信日: {report.sentAt.toLocaleDateString("ja-JP")}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 border-t border-[var(--line)] pt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text)]">アップセル提案（Agent 10）</h2>
          <form action={generateUpsell.bind(null, project.customer.id, project.id)}>
            <button type="submit" className={primaryButton}>
              提案候補を抽出
            </button>
          </form>
        </div>

        <div className="space-y-3">
          {project.customer.upsellProposals.map((u) => (
            <div key={u.id} className={`${card} space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--text)]">{u.category}</span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    u.status === "PRESENTED"
                      ? "bg-[var(--accent)] text-white"
                      : u.status === "APPROVED"
                        ? "bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                        : u.status === "REJECTED"
                          ? "bg-[var(--danger-tint)] text-[var(--danger)]"
                          : "bg-[var(--gold-tint)] text-[var(--gold)]"
                  }`}
                >
                  {UPSELL_STATUS_LABEL[u.status] ?? u.status}
                </span>
              </div>
              <p className="text-sm text-[var(--text)]">{u.rationale}</p>
              {u.status === "PENDING" && (
                <div className="flex gap-2">
                  <form action={approveUpsellAction.bind(null, u.id, project.id)}>
                    <button type="submit" className={linkButton("accent")}>
                      承認
                    </button>
                  </form>
                  <form action={rejectUpsellAction.bind(null, u.id, project.id)}>
                    <button type="submit" className={linkButton("danger")}>
                      却下
                    </button>
                  </form>
                </div>
              )}
              {u.status === "APPROVED" && (
                <form action={presentUpsellAction.bind(null, u.id, project.id)}>
                  <button type="submit" className={linkButton("accent")}>
                    顧客に提案済みにする
                  </button>
                </form>
              )}
            </div>
          ))}
          {project.customer.upsellProposals.length === 0 && (
            <p className="text-sm text-[var(--text-dim)]">まだ提案候補がありません。</p>
          )}
        </div>
      </section>
    </div>
  );
}
