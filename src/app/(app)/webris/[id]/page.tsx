import { notFound } from "next/navigation";
import Link from "next/link";
import {
  fetchWebrisOrganizations,
  fetchWebrisPaymentMethod,
  WebrisApiError,
  WebrisNotConfiguredError,
} from "@/lib/webris";
import { formatYen } from "@/lib/labels";
import { changePlanAction } from "../actions";
import CancelSubscriptionForm from "./CancelSubscriptionForm";
import DeleteAccountForm from "./DeleteAccountForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Kept here rather than fetched from WEBRIS since the plan catalog rarely
// changes; WEBRIS remains the source of truth for price via its own API.
const PLAN_OPTIONS = [
  { code: "free", label: "Free（¥0）" },
  { code: "standard", label: "Standard（¥3,800）" },
  { code: "pro", label: "Pro（¥19,800）" },
  { code: "business", label: "Business（¥38,000）" },
];

const ROLE_LABEL: Record<string, string> = {
  OWNER: "オーナー",
  EDITOR: "編集者",
  VIEWER: "閲覧者",
};

const card = "border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm";
const primaryButton =
  "text-sm bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white rounded-xl px-4 py-2 font-medium shadow-sm";

export default async function WebrisCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let org;
  let managers: Awaited<ReturnType<typeof fetchWebrisOrganizations>> = [];
  let paymentMethod = null;
  let error: string | null = null;

  try {
    const orgs = await fetchWebrisOrganizations();
    org = orgs.find((o) => o.id === id);
    // この企業に招待コードで参加している管理者アカウント（EDITOR/VIEWER）。
    // 管理者アカウントはOrganizationを自分で持たないので、参加先の
    // memberships配列からこの組織IDに一致するものだけを拾う。
    managers = orgs.filter(
      (o) => o.accountType === "manager" && o.memberships?.some((m) => m.organizationId === id),
    );
    // 決済手段・支払い情報は企業アカウント（＝契約主体）のみが持つ。
    if (org && org.accountType !== "manager") {
      paymentMethod = await fetchWebrisPaymentMethod(id).catch(() => null);
    }
  } catch (e) {
    error = e instanceof WebrisNotConfiguredError || e instanceof WebrisApiError ? e.message : "予期しないエラーが発生しました。";
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="border border-[var(--gold)]/30 bg-[var(--gold-tint)] rounded-2xl p-5 text-sm text-[var(--text)]">
          {error}
        </div>
      </div>
    );
  }

  if (!org) notFound();

  const isManager = org.accountType === "manager";

  const linkedCompany = await prisma.company.findFirst({
    where: { webrisOrganizationId: org.id },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div>
        <Link href="/webris" className="text-sm text-[var(--accent)] hover:underline">
          ← WEBRIS顧客一覧
        </Link>
        <div className="flex items-center gap-2 mt-2">
          <h1 className="text-[26px] font-semibold tracking-tight text-[var(--text)]">
            {org.name}
          </h1>
          <span
            className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-medium ${
              isManager ? "bg-[var(--gold-tint)] text-[var(--gold)]" : "bg-[var(--accent-tint)] text-[var(--accent-strong)]"
            }`}
          >
            {isManager ? "管理者アカウント" : "企業アカウント"}
          </span>
        </div>
        {org.websiteUrl && <p className="text-[var(--text-dim)]">{org.websiteUrl}</p>}
        {linkedCompany ? (
          <Link href={`/companies/${linkedCompany.id}`} className="text-sm text-[var(--accent)] hover:underline mt-1 inline-block">
            顧客管理: {linkedCompany.name} を見る →
          </Link>
        ) : (
          !isManager && (
            <p className="text-sm text-[var(--text-dim)] mt-1">
              まだLEVAN HUBの顧客管理と紐付いていません。顧客管理側の会社詳細画面から連携できます。
            </p>
          )
        )}
      </div>

      {isManager ? (
        <>
          <section className={`${card} space-y-2 text-sm`}>
            <h2 className="font-semibold text-[var(--text)] mb-2">アカウント情報</h2>
            <div className="text-[var(--text)]">
              担当者: {org.ownerName ?? "—"}（{org.ownerEmail}）
            </div>
            <div className="text-[var(--text)]">登録日: {new Date(org.createdAt).toLocaleDateString("ja-JP")}</div>
            <p className="text-xs text-[var(--text-dim)] pt-1">
              管理者アカウントは企業アカウント（＝契約主体）を自分では持たず、招待コードで企業に参加して利用します。プラン・課金は参加先の企業アカウントに紐づきます。
            </p>
          </section>

          <section className={`${card} space-y-2 text-sm`}>
            <h2 className="font-semibold text-[var(--text)] mb-2">加入組織</h2>
            {org.memberships && org.memberships.length > 0 ? (
              <ul className="divide-y divide-[var(--line)]">
                {org.memberships.map((m) => (
                  <li key={m.organizationId} className="py-2 flex items-center justify-between">
                    <Link href={`/webris/${m.organizationId}`} className="text-[var(--accent)] hover:underline">
                      {m.organizationName}
                    </Link>
                    <span className="text-xs text-[var(--text-dim)]">{ROLE_LABEL[m.role] ?? m.role}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[var(--text-dim)]">まだどの組織にも参加していません（招待コード待ち）。</p>
            )}
          </section>
        </>
      ) : (
        <>
          <section className={`${card} space-y-2 text-sm`}>
            <h2 className="font-semibold text-[var(--text)] mb-2">契約情報</h2>
            <div className="text-[var(--text)]">
              担当者: {org.ownerName ?? "—"}（{org.ownerEmail}）
            </div>
            <div className="text-[var(--text)]">
              現在のプラン: <strong>{org.planName}</strong>（{formatYen(org.monthlyPriceJpy)}/月）
            </div>
            <div className="text-[var(--text)]">契約日: {new Date(org.createdAt).toLocaleDateString("ja-JP")}</div>
            <div className="text-[var(--text)]">
              次回更新日: {org.currentPeriodEnd ? new Date(org.currentPeriodEnd).toLocaleDateString("ja-JP") : "—"}
            </div>
            <div className="text-[var(--text)]">ステータス: {org.subscriptionStatus ?? "無料プラン"}</div>
          </section>

          <section className={`${card} space-y-2 text-sm`}>
            <h2 className="font-semibold text-[var(--text)] mb-2">決済手段</h2>
            {paymentMethod ? (
              <div className="text-[var(--text)]">
                {paymentMethod.brand.toUpperCase()} 下4桁 {paymentMethod.last4}（有効期限{" "}
                {paymentMethod.expMonth}/{paymentMethod.expYear}）
              </div>
            ) : (
              <p className="text-[var(--text-dim)]">登録されているカード情報がありません。</p>
            )}
          </section>

          <section className={`${card} space-y-2 text-sm`}>
            <h2 className="font-semibold text-[var(--text)] mb-2">管理者アカウント</h2>
            {managers.length > 0 ? (
              <ul className="divide-y divide-[var(--line)]">
                {managers.map((m) => {
                  const role = m.memberships?.find((mm) => mm.organizationId === org!.id)?.role;
                  return (
                    <li key={m.id} className="py-2 flex items-center justify-between">
                      <Link href={`/webris/${m.id}`} className="text-[var(--accent)] hover:underline">
                        {m.ownerName ?? "—"}
                        <span className="text-xs text-[var(--text-dim)] ml-2">{m.ownerEmail}</span>
                      </Link>
                      <span className="text-xs text-[var(--text-dim)]">{role ? ROLE_LABEL[role] ?? role : "—"}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[var(--text-dim)]">この企業に参加している管理者アカウントはいません。</p>
            )}
          </section>

          {org.subscriptionStatus && (
            <section className={`${card} space-y-4`}>
              <h2 className="font-semibold text-[var(--text)]">プラン変更</h2>
              <p className="text-xs text-[var(--text-dim)]">
                Stripeのサブスクリプションを直接変更します。日割り計算で差額が請求/返金されます。反映まで数秒かかります。
              </p>
              <form action={changePlanAction} className="flex items-center gap-3">
                <input type="hidden" name="orgId" value={org.id} />
                <select
                  name="planCode"
                  defaultValue={org.planCode}
                  className="border border-[var(--line)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text)]"
                >
                  {PLAN_OPTIONS.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button type="submit" className={primaryButton}>
                  プランを変更
                </button>
              </form>

              <div className="border-t border-[var(--line)] pt-4">
                <p className="text-xs text-[var(--text-dim)] mb-2">
                  解約は即座に反映され、元に戻せません。顧客に十分確認の上で実行してください。
                </p>
                <CancelSubscriptionForm orgId={org.id} />
              </div>
            </section>
          )}

          <section className={`${card} space-y-3 border-[var(--danger)]/30`}>
            <h2 className="font-semibold text-[var(--danger)]">危険な操作</h2>
            <p className="text-xs text-[var(--text-dim)]">
              アカウントとサイト・キーワード・記事・レポートなど、この顧客に紐づく全データを完全に削除します。契約中の場合はStripeのサブスクリプションも即座に解約されます。
              <strong className="text-[var(--danger)]">この操作は絶対に元に戻せません。</strong>
            </p>
            <DeleteAccountForm orgId={org.id} orgName={org.name} />
          </section>
        </>
      )}
    </div>
  );
}
