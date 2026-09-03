import { fetchWebrisOrganizations, WebrisApiError, WebrisNotConfiguredError } from "@/lib/webris";
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

export default async function WebrisCustomersPage() {
  let organizations: Awaited<ReturnType<typeof fetchWebrisOrganizations>> = [];
  let error: string | null = null;

  try {
    organizations = await fetchWebrisOrganizations();
  } catch (e) {
    if (e instanceof WebrisNotConfiguredError || e instanceof WebrisApiError) {
      error = e.message;
    } else {
      error = "WEBRIS顧客情報の取得中に予期しないエラーが発生しました。";
    }
  }

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
              {organizations.map((org) => (
                <tr key={org.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text)]">{org.name}</div>
                    {org.websiteUrl && (
                      <div className="text-xs text-[var(--text-dim)]">{org.websiteUrl}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-dim)]">
                    <div>{org.ownerName ?? "—"}</div>
                    <div className="text-xs">{org.ownerEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text)]">{org.planName}</td>
                  <td className="px-4 py-3 tabular-nums text-[var(--text)]">
                    {formatYen(org.monthlyPriceJpy)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        org.subscriptionStatus ? (STATUS_STYLE[org.subscriptionStatus] ?? "") : "bg-[var(--surface-2)] text-[var(--text-dim)]"
                      }`}
                    >
                      {org.subscriptionStatus
                        ? (SUBSCRIPTION_STATUS_LABEL[org.subscriptionStatus] ?? org.subscriptionStatus)
                        : "無料プラン"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-dim)]">
                    {new Date(org.createdAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-dim)]">
                    {org.currentPeriodEnd
                      ? new Date(org.currentPeriodEnd).toLocaleDateString("ja-JP")
                      : "—"}
                  </td>
                </tr>
              ))}
              {organizations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-dim)]">
                    まだ顧客が登録されていません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
