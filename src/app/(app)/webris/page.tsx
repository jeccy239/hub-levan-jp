import Link from "next/link";
import {
  fetchWebrisOrganizations,
  fetchWebrisPlanChanges,
  WEBRIS_PLAN_LABEL,
  WebrisApiError,
  WebrisNotConfiguredError,
} from "@/lib/webris";
import { formatYen } from "@/lib/labels";

export const dynamic = "force-dynamic";

const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  active: "有効",
  trialing: "トライアル中",
  past_due: "支払い遅延",
  canceled: "解約済み",
  incomplete: "決済未完了",
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
  trialing: "bg-[var(--gold-tint)] text-[var(--gold)]",
  past_due: "bg-[var(--danger-tint)] text-[var(--danger)]",
  canceled: "bg-[var(--surface-2)] text-[var(--text-dim)]",
  incomplete: "bg-[var(--danger-tint)] text-[var(--danger)]",
};

function monthBounds(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(first), to: fmt(last) };
}

// Quick-switch buttons: 6 months back through 1 month ahead, so a plan
// signed this week still has a working "next month" button.
function buildMonthOptions() {
  const now = new Date();
  const options: { label: string; from: string; to: string }[] = [];
  for (let offset = -6; offset <= 1; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const { from, to } = monthBounds(d.getFullYear(), d.getMonth());
    options.push({ label: `${d.getFullYear()}年${d.getMonth() + 1}月`, from, to });
  }
  return options;
}

export default async function WebrisCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const monthOptions = buildMonthOptions();
  const currentMonth = monthOptions[6]; // offset 0
  const from = params.from || currentMonth.from;
  const to = params.to || currentMonth.to;

  let organizations: Awaited<ReturnType<typeof fetchWebrisOrganizations>> = [];
  let planChanges: Awaited<ReturnType<typeof fetchWebrisPlanChanges>> = [];
  let error: string | null = null;

  try {
    organizations = await fetchWebrisOrganizations();
    planChanges = await fetchWebrisPlanChanges().catch(() => []);
  } catch (e) {
    error =
      e instanceof WebrisNotConfiguredError || e instanceof WebrisApiError
        ? e.message
        : "WEBRIS顧客情報の取得中に予期しないエラーが発生しました。";
  }

  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59`);
  const inRange = organizations.filter((org) => {
    const created = new Date(org.createdAt);
    return created >= fromDate && created <= toDate;
  });
  const displayedRevenue = inRange.reduce((sum, org) => sum + org.monthlyPriceJpy, 0);

  const byPlan = new Map<string, { planName: string; count: number; monthlyPriceJpy: number }>();
  for (const org of organizations) {
    const entry = byPlan.get(org.planCode) ?? { planName: org.planName, count: 0, monthlyPriceJpy: org.monthlyPriceJpy };
    entry.count += 1;
    byPlan.set(org.planCode, entry);
  }
  const planSummaries = [...byPlan.values()].sort((a, b) => a.monthlyPriceJpy - b.monthlyPriceJpy);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">
          WEBRIS顧客管理
        </h1>
        <p className="text-[var(--text-dim)] mt-1">
          webris.levan.jp に登録されている顧客(Organization)をLEVAN HUBから確認します。
        </p>
      </div>

      {error && (
        <div className="border border-[var(--gold)]/30 bg-[var(--gold-tint)] rounded-2xl p-5 text-sm text-[var(--text)]">
          <p className="font-medium mb-1">WEBRISとの連携が完了していません</p>
          <p className="text-[var(--text-dim)]">{error}</p>
        </div>
      )}

      {!error && (
        <>
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {planSummaries.map((p) => (
              <div key={p.planName} className="border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm">
                <div className="text-xs text-[var(--text-dim)] mb-1">{p.planName}プラン</div>
                <div className="text-2xl font-semibold tabular-nums text-[var(--text)]">
                  {p.count.toLocaleString("ja-JP")}社
                </div>
                <div className="text-xs text-[var(--text-dim)] mt-1">
                  月間売上 {formatYen(p.count * p.monthlyPriceJpy)}（概算・現在の契約に基づく）
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <div className="inline-flex flex-wrap gap-1 p-1 rounded-full bg-[var(--surface)]/50 backdrop-blur-xl backdrop-saturate-150 border border-white/40 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
              {monthOptions.map((m) => {
                const isActive = m.from === from && m.to === to;
                return (
                  <Link
                    key={m.from}
                    href={`/webris?from=${m.from}&to=${m.to}`}
                    className={`text-sm px-3.5 py-1.5 rounded-full font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-[var(--accent)]/80 text-white backdrop-blur-xl shadow-sm"
                        : "text-[var(--text-dim)] hover:bg-white/50 hover:text-[var(--text)]"
                    }`}
                  >
                    {m.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center justify-between border border-[var(--line)] rounded-2xl px-5 py-4 bg-[var(--surface)] shadow-sm">
              <div>
                <div className="text-xs text-[var(--text-dim)]">
                  表示中の期間（{new Date(from).toLocaleDateString("ja-JP")} 〜 {new Date(to).toLocaleDateString("ja-JP")}）に契約した顧客
                </div>
                <div className="text-xl font-semibold tabular-nums text-[var(--text)] mt-1">
                  {inRange.length.toLocaleString("ja-JP")}社
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[var(--text-dim)]">表示中の売上（月額合計）</div>
                <div className="text-xl font-semibold tabular-nums text-[var(--text)] mt-1">
                  {formatYen(displayedRevenue)}
                </div>
              </div>
            </div>
          </section>

          <div className="overflow-x-auto border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium tracking-wide text-[var(--text-dim)] border-b border-[var(--line)]">
                  <th className="px-4 py-3">会社名</th>
                  <th className="px-4 py-3">担当者</th>
                  <th className="px-4 py-3">プラン</th>
                  <th className="px-4 py-3">月額</th>
                  <th className="px-4 py-3">ステータス</th>
                  <th className="px-4 py-3">契約日</th>
                  <th className="px-4 py-3">次回更新日</th>
                </tr>
              </thead>
              <tbody>
                {inRange.map((org) => (
                  <tr key={org.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/webris/${org.id}`} className="font-medium text-[var(--text)] hover:text-[var(--accent)]">
                        {org.name}
                      </Link>
                      {org.websiteUrl && <div className="text-xs text-[var(--text-dim)]">{org.websiteUrl}</div>}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-dim)]">
                      <div>{org.ownerName ?? "—"}</div>
                      <div className="text-xs">{org.ownerEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text)]">{org.planName}</td>
                    <td className="px-4 py-3 tabular-nums text-[var(--text)]">{formatYen(org.monthlyPriceJpy)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          org.subscriptionStatus ? (STATUS_STYLE[org.subscriptionStatus] ?? "") : "bg-[var(--surface-2)] text-[var(--text-dim)]"
                        }`}
                      >
                        {org.subscriptionStatus ? (SUBSCRIPTION_STATUS_LABEL[org.subscriptionStatus] ?? org.subscriptionStatus) : "無料プラン"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-dim)]">{new Date(org.createdAt).toLocaleDateString("ja-JP")}</td>
                    <td className="px-4 py-3 text-[var(--text-dim)]">
                      {org.currentPeriodEnd ? new Date(org.currentPeriodEnd).toLocaleDateString("ja-JP") : "—"}
                    </td>
                  </tr>
                ))}
                {inRange.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-dim)]">
                      この期間に契約した顧客はいません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <section className="space-y-3">
            <h2 className="font-semibold text-[var(--text)]">プラン変更履歴</h2>
            <div className="border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm divide-y divide-[var(--line)]">
              {planChanges.map((c, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div className="text-[var(--text)]">
                    <Link href={`/webris/${c.organizationId}`} className="font-medium hover:text-[var(--accent)]">
                      {c.organizationName}
                    </Link>
                    <span className="text-[var(--text-dim)] mx-2">
                      {c.from ? WEBRIS_PLAN_LABEL[c.from] ?? c.from : "—"} → {c.to ? WEBRIS_PLAN_LABEL[c.to] ?? c.to : "—"}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-dim)]">
                    {new Date(c.changedAt).toLocaleString("ja-JP")}
                  </div>
                </div>
              ))}
              {planChanges.length === 0 && (
                <p className="px-5 py-6 text-center text-sm text-[var(--text-dim)]">
                  まだプラン変更の記録がありません（この機能の導入以降の変更のみ記録されます）。
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
