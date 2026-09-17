import { DashLink } from "../../LoadingBar";
import { notFound } from "next/navigation";
import { fmtDate, fmtDateTime, fmtInt, fmtJpy } from "@/lib/webrisAnalytics/format";
import { sectionData } from "@/lib/webrisAnalytics/metrics";
import { resolveRange } from "@/lib/webrisAnalytics/range";
import { getDashboardData } from "@/lib/webrisAnalytics/webrisService";
import { Panel, SectionNotice } from "../../ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "有効",
  trialing: "トライアル中",
  past_due: "支払い遅延",
  canceled: "解約済み",
  incomplete: "決済未完了",
};

function Row({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] sm:grid-cols-[12rem_1fr] gap-3 py-2.5">
      <dt className="text-xs text-[var(--text-dim)]">{label}</dt>
      <dd className="text-sm text-[var(--text)] tabular-nums">
        {children}
        {note && <span className="block text-[11px] text-[var(--text-dim)]">{note}</span>}
      </dd>
    </div>
  );
}

/**
 * アカウント単位の利用状況（匿名化した詳細）。
 * 一覧と同じ取得結果（既定の28日間）から該当アカウントを引く。
 * 氏名・メール・決済手段などはここでは扱わない。
 */
export default async function WebrisAccountInsightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDashboardData(resolveRange({}));
  const product = data.payload ? sectionData(data.payload.product) : null;

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <DashLink href="/webris/dashboard?tab=users" className="text-xs text-[var(--accent)] hover:underline">
          ← ユーザー一覧へ
        </DashLink>
        {data.payload ? (
          <SectionNotice section={data.payload.product} name="WEBRIS DB" />
        ) : (
          <SectionNotice section={{ status: "error", message: data.error ?? "WEBRISのデータを取得できませんでした。" }} name="WEBRIS" />
        )}
      </div>
    );
  }

  const a = product.accounts.find((x) => x.id === id);
  if (!a) notFound();

  const steps = [
    { label: "無料登録", at: a.createdAt, done: true },
    { label: "URL登録", at: a.firstUrlAt, done: a.sites > 0 },
    { label: "サイト分析", at: a.lastAuditAt, done: a.audits > 0 },
    { label: "AI利用", at: a.lastAiAt, done: a.aiRuns > 0 },
    { label: "レポート作成", at: null, done: a.reports > 0 },
    { label: "有料契約", at: a.paidSince, done: a.isPaid },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <DashLink href="/webris/dashboard?tab=users" className="text-xs text-[var(--accent)] hover:underline">
        ← ユーザー一覧へ
      </DashLink>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]">アカウントの利用状況</h1>
          <p className="mt-1 font-mono text-xs text-[var(--text-dim)]">ID: {a.id}</p>
        </div>
        <p className="text-[11px] text-[var(--text-dim)]">Last updated {fmtDateTime(data.fetchedAt)}</p>
      </header>

      <Panel title="到達ステップ" source="WEBRIS DB">
        <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {steps.map((s) => (
            <li
              key={s.label}
              className={`rounded-xl border px-3 py-2 ${s.done ? "border-[var(--accent)]/30 bg-[var(--accent-tint)]" : "border-[var(--line)] bg-[var(--surface-2)]"}`}
            >
              <div className={`text-xs font-medium ${s.done ? "text-[var(--accent-strong)]" : "text-[var(--text-dim)]"}`}>
                {s.done ? "✓ " : ""}
                {s.label}
              </div>
              <div className="text-[10px] tabular-nums text-[var(--text-dim)]">{s.done ? fmtDate(s.at) : "未到達"}</div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="詳細">
        <dl className="divide-y divide-[var(--line)]">
          <Row label="初回訪問日時" note="WEBRISは登録前の訪問をアカウントに紐づけて保存していないため取得できません">
            —
          </Row>
          <Row label="流入元" note="登録時の参照元・UTMはWEBRISに保存されていません">
            —
          </Row>
          <Row label="セッション数 / 閲覧ページ" note="GA4はアカウントIDと紐づいていないため取得できません">
            —
          </Row>
          <Row label="登録日時">{fmtDateTime(a.createdAt)}</Row>
          <Row label="最終利用日時" note="診断・AI利用・レポート作成・URL登録のうち最新">
            {fmtDateTime(a.lastActivityAt)}
          </Row>
          <Row label="URL登録">{a.sites > 0 ? `${fmtInt(a.sites)}サイト（初回 ${fmtDateTime(a.firstUrlAt)}）` : "未登録"}</Row>
          <Row label="サイト分析">{a.audits > 0 ? `${fmtInt(a.audits)}回（最新 ${fmtDateTime(a.lastAuditAt)}）` : "未実行"}</Row>
          <Row label="AI利用">{a.aiRuns > 0 ? `${fmtInt(a.aiRuns)}回（最新 ${fmtDateTime(a.lastAiAt)}）` : "未利用"}</Row>
          <Row label="レポート作成">{fmtInt(a.reports)}件</Row>
          <Row label="外部連携">
            Search Console {a.gscConnected ? "連携済み" : "未連携"} / GA4 {a.ga4Connected ? "連携済み" : "未連携"}
          </Row>
          <Row label="メンバー数">{fmtInt(a.members)}人</Row>
          <Row label="プラン">
            {a.planName}
            {a.monthlyPriceJpy > 0 && `（${fmtJpy(a.monthlyPriceJpy)}/月）`}
          </Row>
          <Row label="課金状態">
            {a.isPaid ? "課金中" : "無料"}
            {a.subscriptionStatus && `（${STATUS_LABEL[a.subscriptionStatus] ?? a.subscriptionStatus}）`}
          </Row>
          <Row label="有料化日時" note="WEBRISがプラン変更の記録を始めて以降のみ">
            {fmtDateTime(a.paidSince)}
          </Row>
        </dl>
      </Panel>

      <p className="text-[11px] text-[var(--text-dim)]">
        氏名・連絡先・契約操作が必要な場合は{" "}
        <DashLink href={`/webris/${a.id}`} className="text-[var(--accent)] hover:underline">
          顧客管理の詳細画面
        </DashLink>{" "}
        を開いてください（個人情報を含みます）。
      </p>
    </div>
  );
}
