import Link from "next/link";
import {
  fetchWebrisOrganizations,
  fetchWebrisPlanChanges,
  WEBRIS_PLAN_LABEL,
  WebrisApiError,
  WebrisNotConfiguredError,
} from "@/lib/webris";
import type { WebrisOrganization } from "@/lib/webris";
import { formatYen } from "@/lib/labels";
import Avatar from "@/components/Avatar";
import { faviconUrl, gravatarUrl } from "@/lib/avatar";

type WebrisOrg = WebrisOrganization;

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "オーナー",
  EDITOR: "編集者",
  VIEWER: "閲覧者",
};

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

const ACCOUNT_TYPE_BADGE: Record<WebrisOrg["accountType"], string> = {
  company: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
  manager: "bg-[var(--gold-tint)] text-[var(--gold)]",
};
const ACCOUNT_TYPE_LABEL: Record<WebrisOrg["accountType"], string> = {
  company: "企業アカウント",
  manager: "管理者アカウント",
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

function buildQuery(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function WebrisCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    type?: string;
    plan?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const monthOptions = buildMonthOptions();
  const currentMonth = monthOptions[6]; // offset 0

  const isAllTime = params.from === "all";
  const from = isAllTime ? null : params.from || currentMonth.from;
  const to = isAllTime ? null : params.to || currentMonth.to;

  const typeFilter = params.type === "company" || params.type === "manager" ? params.type : "";
  const planFilter = params.plan ?? "";
  const search = (params.q ?? "").trim();

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

  const inPeriod = (org: WebrisOrg) => {
    if (isAllTime) return true;
    const created = new Date(org.createdAt);
    return created >= new Date(`${from}T00:00:00`) && created <= new Date(`${to}T23:59:59`);
  };
  const inRange = organizations.filter(inPeriod);
  const displayedRevenue = inRange.reduce((sum, org) => sum + org.monthlyPriceJpy, 0);

  const byPlan = new Map<string, { planName: string; count: number; monthlyPriceJpy: number }>();
  for (const org of organizations) {
    if (org.accountType === "manager") continue; // 管理者アカウントにはプランが無いので集計から除外
    const entry = byPlan.get(org.planCode) ?? { planName: org.planName, count: 0, monthlyPriceJpy: org.monthlyPriceJpy };
    entry.count += 1;
    byPlan.set(org.planCode, entry);
  }
  const planSummaries = [...byPlan.values()].sort((a, b) => a.monthlyPriceJpy - b.monthlyPriceJpy);
  // プラン絞り込みのプルダウン用。契約が1件も無いプランは出さない。
  const planFilterOptions = [...byPlan.entries()]
    .map(([code, v]) => ({ code, name: v.planName, price: v.monthlyPriceJpy }))
    .sort((a, b) => a.price - b.price);

  // 同じ担当者アカウント（メール）が複数の組織を運用しているケースがある
  // （例: gi@rojam.jp が株式会社ROJAMとROJAMオンラインの両方を運用）。
  // 実際に課金されている契約は1つのアカウントに1本のことが多く、他の
  // 組織はその契約の下で無料運用されているだけ。個々の組織が自分の
  // planCode（大半はFree）をそのまま出すと「契約者は本当はProなのに
  // Freeと表示される」ことになるため、同じメールの中で最も高額な契約を
  // 持つ組織を「契約主体」とみなし、その他の組織にはその契約の
  // プラン・月額・ステータスを表示する。
  // 契約の紐付けは「企業アカウント（＝Organization）」同士の間でのみ意味を
  // 持つ。管理者アカウントはまだどの組織にも参加していない状態のユーザー
  // で、契約という概念自体がまだ存在しないため、この束ね処理には含めない。
  const orgsByOwnerEmail = new Map<string, WebrisOrg[]>();
  for (const org of organizations) {
    if (org.accountType === "manager") continue;
    const list = orgsByOwnerEmail.get(org.ownerEmail) ?? [];
    list.push(org);
    orgsByOwnerEmail.set(org.ownerEmail, list);
  }
  const contractOrgByEmail = new Map<string, WebrisOrg>();
  for (const [email, orgs] of orgsByOwnerEmail) {
    const paidOrgs = orgs.filter((o) => o.monthlyPriceJpy > 0);
    if (paidOrgs.length === 0) continue;
    const contract = paidOrgs.reduce((best, o) => (o.monthlyPriceJpy > best.monthlyPriceJpy ? o : best), paidOrgs[0]);
    contractOrgByEmail.set(email, contract);
  }

  function resolveContract(org: WebrisOrg): WebrisOrg {
    if (org.accountType === "manager") return org; // 管理者アカウントは契約の束ね対象外
    if (org.monthlyPriceJpy > 0) return org; // 自身が課金契約なら、そのまま
    return contractOrgByEmail.get(org.ownerEmail) ?? org;
  }

  // 一覧テーブルは「期間 → アカウント種別 → プラン → キーワード検索」の
  // AND で絞り込む。
  const needle = search.toLowerCase();
  const rows = inRange.filter((org) => {
    if (typeFilter && org.accountType !== typeFilter) return false;

    const contract = resolveContract(org);
    if (planFilter) {
      if (org.accountType === "manager") return false; // 管理者にはプランが無い
      if (contract.planCode !== planFilter) return false;
    }

    if (needle) {
      const haystack = [
        org.name,
        contract.name,
        org.ownerName ?? "",
        org.ownerEmail,
        ...(org.memberships?.map((m) => m.organizationName) ?? []),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const filtersActive = Boolean(typeFilter || planFilter || search);
  const periodParam = isAllTime ? { from: "all" } : { from: from ?? undefined, to: to ?? undefined };
  const currentParams = {
    ...periodParam,
    type: typeFilter || undefined,
    plan: planFilter || undefined,
    q: search || undefined,
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">
          WEBRIS顧客管理
        </h1>
        <p className="text-[var(--text-dim)] mt-1">
          webris.levan.jp に登録されている顧客（企業アカウント／管理者アカウント）をLEVAN HUBから確認します。
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
            <div className="inline-flex flex-wrap gap-1 p-1 rounded-full bg-black/[0.05] backdrop-blur-xl backdrop-saturate-150 border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.04)]">
              <Link
                href={`/webris${buildQuery({ ...currentParams, from: "all", to: undefined })}`}
                className={`text-sm px-3.5 py-1.5 rounded-full font-medium transition-all duration-200 ${
                  isAllTime
                    ? "bg-white/70 text-[var(--text)] backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                    : "text-[var(--text-dim)] hover:bg-white/30 hover:text-[var(--text)]"
                }`}
              >
                全期間
              </Link>
              {monthOptions.map((m) => {
                const isActive = !isAllTime && m.from === from && m.to === to;
                return (
                  <Link
                    key={m.from}
                    href={`/webris${buildQuery({ ...currentParams, from: m.from, to: m.to })}`}
                    className={`text-sm px-3.5 py-1.5 rounded-full font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-white/70 text-[var(--text)] backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                        : "text-[var(--text-dim)] hover:bg-white/30 hover:text-[var(--text)]"
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
                  {isAllTime
                    ? "全期間に契約した顧客"
                    : `表示中の期間（${new Date(from!).toLocaleDateString("ja-JP")} 〜 ${new Date(to!).toLocaleDateString("ja-JP")}）に契約した顧客`}
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

          {/* 種別切り替え */}
          <div className="inline-flex flex-wrap gap-1 p-1 rounded-full bg-black/[0.05] backdrop-blur-xl backdrop-saturate-150 border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.04)]">
            {[
              { value: "", label: "すべて" },
              { value: "company", label: "企業アカウント" },
              { value: "manager", label: "管理者アカウント" },
            ].map((t) => {
              const isActive = typeFilter === t.value;
              return (
                <Link
                  key={t.value || "all"}
                  href={`/webris${buildQuery({ ...currentParams, type: t.value || undefined })}`}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-white/70 text-[var(--text)] backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                      : "text-[var(--text-dim)] hover:bg-white/30 hover:text-[var(--text)]"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          {/* 検索・絞り込み */}
          <form method="get" className="border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm p-4 space-y-3">
            {isAllTime && <input type="hidden" name="from" value="all" />}
            {!isAllTime && from && <input type="hidden" name="from" value={from} />}
            {!isAllTime && to && <input type="hidden" name="to" value={to} />}
            {typeFilter && <input type="hidden" name="type" value={typeFilter} />}

            <div className="flex flex-wrap gap-3">
              <input
                name="q"
                defaultValue={search}
                placeholder="アカウント名・担当者名・メールで検索"
                className="flex-1 min-w-[220px] border border-[var(--line)] rounded-xl px-3.5 py-2 text-xs bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-dim)]"
              />
              <select
                name="plan"
                defaultValue={planFilter}
                className="border border-[var(--line)] rounded-xl px-3 py-2 text-xs bg-[var(--surface)] text-[var(--text)]"
              >
                <option value="">すべてのプラン</option>
                {planFilterOptions.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}プラン
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white rounded-xl px-4 py-2 font-medium shadow-sm"
              >
                絞り込み
              </button>
              {filtersActive && (
                <Link
                  href={`/webris${buildQuery(periodParam)}`}
                  className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] rounded-xl px-4 py-2 font-medium"
                >
                  クリア
                </Link>
              )}
            </div>
          </form>

          <div className="overflow-x-auto border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-[10px] font-medium tracking-wide text-[var(--text-dim)] border-b border-[var(--line)]">
                  <th className="px-3 py-2">アカウント名（契約名）</th>
                  <th className="px-3 py-2 whitespace-nowrap">種別</th>
                  <th className="px-3 py-2">担当者</th>
                  <th className="px-3 py-2">プラン</th>
                  <th className="px-3 py-2">月額</th>
                  <th className="px-3 py-2 whitespace-nowrap">ステータス</th>
                  <th className="px-3 py-2 whitespace-nowrap">契約日</th>
                  <th className="px-3 py-2 whitespace-nowrap">次回更新日</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((org) => {
                  const isManager = org.accountType === "manager";
                  const contract = resolveContract(org);
                  const isChildOfContract = !isManager && contract.id !== org.id;
                  const memberships = isManager ? (org.memberships ?? []) : [];
                  const detailId = isManager ? org.id : contract.id;
                  // アカウント名のアイコン：企業はロゴ→サイトfavicon、管理者は
                  // 本人アバター→Gravatar。すべて失敗したら頭文字。
                  const nameAvatarSrcs = isManager
                    ? [org.ownerAvatarUrl, gravatarUrl(org.ownerEmail)]
                    : [contract.logoUrl, faviconUrl(contract.websiteUrl)];
                  const avatarName = isManager ? org.ownerName ?? org.name : contract.name;
                  const ownerAvatarSrcs = [org.ownerAvatarUrl, gravatarUrl(org.ownerEmail)];
                  return (
                    <tr key={org.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex items-start gap-2.5">
                          <Avatar srcs={nameAvatarSrcs} name={avatarName} size={26} />
                          <div className="min-w-0">
                            <Link href={`/webris/${detailId}`} className="font-medium text-[var(--text)] hover:text-[var(--accent)]">
                              {isManager ? org.name : contract.name}
                            </Link>
                            {!isManager && contract.websiteUrl && <div className="text-[10px] text-[var(--text-dim)]">{contract.websiteUrl}</div>}
                            {isChildOfContract && (
                              <div className="text-[10px] text-[var(--accent)] mt-0.5">
                                運用サイト：{org.name}
                                {org.websiteUrl && `（${org.websiteUrl}）`}
                              </div>
                            )}
                            {isManager && (
                              <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                                {memberships.length > 0 ? (
                                  <>
                                    加入組織：
                                    {memberships.map((m, i) => (
                                      <span key={m.organizationId}>
                                        {i > 0 && "、"}
                                        <Link href={`/webris/${m.organizationId}`} className="text-[var(--accent)] hover:underline">
                                          {m.organizationName}
                                        </Link>
                                        （{ROLE_LABEL[m.role] ?? m.role}）
                                      </span>
                                    ))}
                                  </>
                                ) : (
                                  "加入組織なし（招待コード待ち）"
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium ${ACCOUNT_TYPE_BADGE[org.accountType]}`}
                        >
                          {ACCOUNT_TYPE_LABEL[org.accountType]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[var(--text-dim)]">
                        <div className="flex items-center gap-2">
                          <Avatar srcs={ownerAvatarSrcs} name={org.ownerName ?? org.ownerEmail} size={20} />
                          <div className="min-w-0">
                            <div className="text-[var(--text)]">{org.ownerName ?? "—"}</div>
                            <div className="text-[10px] truncate">{org.ownerEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[var(--text)]">{isManager ? "—" : contract.planName}</td>
                      <td className="px-3 py-2 tabular-nums text-[var(--text)]">{isManager ? "—" : formatYen(contract.monthlyPriceJpy)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {isManager ? (
                          <span
                            className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              memberships.length > 0
                                ? "bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                                : "bg-[var(--surface-2)] text-[var(--text-dim)]"
                            }`}
                          >
                            {memberships.length > 0 ? `${memberships.length}組織に加入` : "組織未参加"}
                          </span>
                        ) : (
                          <span
                            className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              contract.subscriptionStatus ? (STATUS_STYLE[contract.subscriptionStatus] ?? "") : "bg-[var(--surface-2)] text-[var(--text-dim)]"
                            }`}
                          >
                            {contract.subscriptionStatus ? (SUBSCRIPTION_STATUS_LABEL[contract.subscriptionStatus] ?? contract.subscriptionStatus) : "無料プラン"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-dim)] whitespace-nowrap">{new Date(org.createdAt).toLocaleDateString("ja-JP")}</td>
                      <td className="px-3 py-2 text-[var(--text-dim)] whitespace-nowrap">
                        {!isManager && contract.currentPeriodEnd ? new Date(contract.currentPeriodEnd).toLocaleDateString("ja-JP") : "—"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Link
                          href={`/webris/${detailId}`}
                          className="inline-block text-[11px] font-semibold rounded-lg px-3 py-1.5 bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] shadow-sm"
                        >
                          詳細を見る
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-[var(--text-dim)]">
                      {filtersActive
                        ? "条件に一致する顧客がいません。"
                        : isAllTime
                          ? "顧客がまだいません。"
                          : "この期間に契約した顧客はいません。"}
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
