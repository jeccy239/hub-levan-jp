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

export const dynamic = "force-dynamic";

// Kept here rather than fetched from WEBRIS since the plan catalog rarely
// changes; WEBRIS remains the source of truth for price via its own API.
const PLAN_OPTIONS = [
  { code: "free", label: "Free（¥0）" },
  { code: "standard", label: "Standard（¥3,800）" },
  { code: "pro", label: "Pro（¥19,800）" },
  { code: "business", label: "Business（¥38,000）" },
];

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
  let paymentMethod = null;
  let error: string | null = null;

  try {
    const orgs = await fetchWebrisOrganizations();
    org = orgs.find((o) => o.id === id);
    if (org) {
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

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div>
        <Link href="/webris" className="text-sm text-[var(--accent)] hover:underline">
          ← WEBRIS顧客一覧
        </Link>
        <h1 className="text-[26px] font-semibold tracking-tight text-[var(--text)] mt-2">
          {org.name}
        </h1>
        {org.websiteUrl && <p className="text-[var(--text-dim)]">{org.websiteUrl}</p>}
      </div>

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
    </div>
  );
}
