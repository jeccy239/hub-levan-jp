import Link from "next/link";
import { fetchWebrisOrganizations, WebrisApiError, WebrisNotConfiguredError } from "@/lib/webris";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "オーナー",
  EDITOR: "編集者",
  VIEWER: "閲覧者",
};

export default async function WebrisManagerAccountsPage() {
  let managers: Awaited<ReturnType<typeof fetchWebrisOrganizations>> = [];
  let error: string | null = null;

  try {
    const organizations = await fetchWebrisOrganizations();
    managers = organizations.filter((o) => o.accountType === "manager");
  } catch (e) {
    error =
      e instanceof WebrisNotConfiguredError || e instanceof WebrisApiError
        ? e.message
        : "WEBRIS顧客情報の取得中に予期しないエラーが発生しました。";
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div>
        <Link href="/webris" className="text-sm text-[var(--accent)] hover:underline">
          ← WEBRIS顧客一覧
        </Link>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)] mt-2">
          顧客一覧（管理者アカウント）
        </h1>
        <p className="text-[var(--text-dim)] mt-1">
          企業アカウントを自分で持たず、招待コードで企業に参加する（または参加待ちの）WEBRISユーザーです。プランという概念は持ちません。
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
                <th className="px-4 py-3">氏名</th>
                <th className="px-4 py-3">メールアドレス</th>
                <th className="px-4 py-3">参加している企業</th>
                <th className="px-4 py-3">登録日</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((manager) => (
                <tr key={manager.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--text)]">{manager.ownerName ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--text-dim)]">{manager.ownerEmail}</td>
                  <td className="px-4 py-3 text-[var(--text)]">
                    {manager.memberships && manager.memberships.length > 0 ? (
                      <div className="space-y-1">
                        {manager.memberships.map((m) => (
                          <div key={m.organizationId}>
                            <Link href={`/webris/${m.organizationId}`} className="hover:text-[var(--accent)]">
                              {m.organizationName}
                            </Link>
                            <span className="text-xs text-[var(--text-dim)] ml-1">（{ROLE_LABEL[m.role] ?? m.role}）</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[var(--text-dim)]">未参加（招待コード待ち）</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-dim)]">{new Date(manager.createdAt).toLocaleDateString("ja-JP")}</td>
                </tr>
              ))}
              {managers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-dim)]">
                    管理者アカウントはいません。
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
