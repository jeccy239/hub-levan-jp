import Link from "next/link";
import { DASH, fmtDate, fmtInt, fmtJpy, shortId } from "@/lib/webrisAnalytics/format";
import { sectionData } from "@/lib/webrisAnalytics/metrics";
import { EmptyRow, Pager, Panel, SectionNotice, numClass, tdClass, thClass } from "../ui";
import { pageNumber, type TabContext } from "./context";

const PER_PAGE = 30;
const FILTERS = [
  { key: "", label: "すべて" },
  { key: "paid", label: "有料" },
  { key: "free", label: "無料" },
  { key: "new", label: "期間内に登録" },
  { key: "stalled", label: "URL未登録" },
] as const;

function Check({ on }: { on: boolean }) {
  return on ? <span className="text-[#1b7f3b]">●</span> : <span className="text-[var(--line)]">○</span>;
}

export default function UsersTab({ payload, range, href, sp }: TabContext) {
  const product = sectionData(payload.product);
  if (!product) return <SectionNotice section={payload.product} name="WEBRIS DB" />;

  const start = new Date(`${range.current.start}T00:00:00+09:00`);
  const end = new Date(new Date(`${range.current.end}T00:00:00+09:00`).getTime() + 86_400_000);
  const filter = FILTERS.some((f) => f.key === sp.plan) ? (sp.plan as string) : "";
  const rows = product.accounts.filter((a) => {
    if (filter === "paid") return a.isPaid;
    if (filter === "free") return !a.isPaid;
    if (filter === "new") return new Date(a.createdAt) >= start && new Date(a.createdAt) < end;
    if (filter === "stalled") return a.sites === 0;
    return true;
  });
  const pages = Math.max(Math.ceil(rows.length / PER_PAGE), 1);
  const page = Math.min(pageNumber(sp.page), pages);
  const visible = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <Panel
      title="アカウント単位の利用状況"
      source="WEBRIS DB"
      description="個人情報（氏名・メール・決済情報）は表示しません。IDはWEBRIS内部の企業アカウントIDです。初回訪問・流入元はWEBRISが登録時に保存していないため表示できません。"
    >
      <nav className="flex flex-wrap gap-1 mb-3" aria-label="絞り込み">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href({ plan: f.key || undefined, page: undefined })}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              filter === f.key ? "bg-[var(--text)] text-white" : "bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            {f.label}
          </Link>
        ))}
        <span className="ml-auto self-center text-xs text-[var(--text-dim)] tabular-nums">{fmtInt(rows.length)}件</span>
      </nav>
      <div className="overflow-x-auto -mx-5">
        <table className="w-full min-w-[1040px]">
          <thead className="border-b border-[var(--line)]">
            <tr>
              <th className={thClass}>ID</th>
              <th className={thClass}>登録日</th>
              <th className={thClass}>最終利用</th>
              <th className={thClass}>プラン</th>
              <th className={`${thClass} text-center`}>URL登録</th>
              <th className={`${thClass} text-right`}>サイト</th>
              <th className={`${thClass} text-right`}>診断</th>
              <th className={`${thClass} text-right`}>AI利用</th>
              <th className={`${thClass} text-right`}>レポート</th>
              <th className={`${thClass} text-center`}>GSC</th>
              <th className={`${thClass} text-center`}>GA4</th>
              <th className={`${thClass} text-right`}>メンバー</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {visible.map((a) => (
              <tr key={a.id} className="hover:bg-[var(--surface-2)]/50">
                <td className={`${tdClass} font-mono text-[12px]`}>
                  <Link href={`/webris/dashboard/accounts/${a.id}`} className="hover:text-[var(--accent)]">
                    {shortId(a.id)}
                  </Link>
                </td>
                <td className={`${tdClass} tabular-nums`}>{fmtDate(a.createdAt)}</td>
                <td className={`${tdClass} tabular-nums text-[var(--text-dim)]`}>{fmtDate(a.lastActivityAt)}</td>
                <td className={tdClass}>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      a.isPaid ? "bg-[var(--accent-tint)] text-[var(--accent-strong)]" : "bg-[var(--surface-2)] text-[var(--text-dim)]"
                    }`}
                  >
                    {a.planName}
                  </span>
                  {a.isPaid && <span className="ml-1.5 text-[11px] tabular-nums text-[var(--text-dim)]">{fmtJpy(a.monthlyPriceJpy)}</span>}
                </td>
                <td className={`${tdClass} text-center`}>
                  <Check on={a.sites > 0} />
                </td>
                <td className={`${tdClass} ${numClass}`}>{fmtInt(a.sites)}</td>
                <td className={`${tdClass} ${numClass}`}>{fmtInt(a.audits)}</td>
                <td className={`${tdClass} ${numClass}`}>{fmtInt(a.aiRuns)}</td>
                <td className={`${tdClass} ${numClass}`}>{fmtInt(a.reports)}</td>
                <td className={`${tdClass} text-center`}>
                  <Check on={a.gscConnected} />
                </td>
                <td className={`${tdClass} text-center`}>
                  <Check on={a.ga4Connected} />
                </td>
                <td className={`${tdClass} ${numClass}`}>{fmtInt(a.members)}</td>
                <td className={`${tdClass} text-right`}>
                  <Link href={`/webris/dashboard/accounts/${a.id}`} className="text-xs text-[var(--accent)] hover:underline">
                    詳細
                  </Link>
                </td>
              </tr>
            ))}
            {visible.length === 0 && <EmptyRow colSpan={13}>該当するアカウントはありません</EmptyRow>}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} hrefFor={(p) => href({ page: String(p) })} />
      <p className="mt-2 text-[11px] text-[var(--text-dim)]">
        最終利用 = 診断・AI利用・レポート作成・URL登録のうち最も新しい日時（ログイン履歴はWEBRISに保存されていないため含みません）。{DASH} は記録なし。
      </p>
    </Panel>
  );
}
