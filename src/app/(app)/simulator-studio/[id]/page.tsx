import { notFound } from "next/navigation";
import Link from "next/link";
import {
  fetchSimulatorTenants,
  isSimulatorSecret,
  SIMULATOR_SECRET_STYLE,
  SIMULATOR_STATUS_LABEL,
  SIMULATOR_STATUS_STYLE,
  simulatorChargedMonthlyJpy,
  simulatorDisplayStatus,
  simulatorTrialLabel,
  SimulatorStudioApiError,
  SimulatorStudioNotConfiguredError,
} from "@/lib/simulator-studio";
import { formatYen } from "@/lib/labels";
import Avatar from "@/components/Avatar";
import { faviconUrl } from "@/lib/avatar";
import { SecretPlanForm } from "./SecretPlanForm";

export const dynamic = "force-dynamic";

const card = "border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 text-sm border-b border-[var(--line)] last:border-0">
      <div className="w-32 shrink-0 text-[var(--text-dim)]">{label}</div>
      <div className="min-w-0 text-[var(--text)] break-all">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className={card}>
      <div className="text-xs text-[var(--text-dim)] mb-1">{label}</div>
      <div className="text-2xl font-semibold tabular-nums text-[var(--text)]">{value}</div>
      {sub && <div className="text-xs text-[var(--text-dim)] mt-1">{sub}</div>}
    </div>
  );
}

export default async function SimulatorTenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let tenants;
  try {
    tenants = await fetchSimulatorTenants();
  } catch (e) {
    const message =
      e instanceof SimulatorStudioNotConfiguredError || e instanceof SimulatorStudioApiError
        ? e.message
        : "契約店舗情報の取得中に予期しないエラーが発生しました。";
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="border border-[var(--gold)]/30 bg-[var(--gold-tint)] rounded-2xl p-5 text-sm text-[var(--text)]">{message}</div>
      </div>
    );
  }

  const t = tenants.find((x) => x.id === id);
  if (!t) notFound();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <Link href="/simulator-studio" className="text-sm text-[var(--text-dim)] hover:text-[var(--text)]">
        ← 契約店舗一覧
      </Link>

      <div className="flex items-center gap-4">
        <Avatar srcs={[faviconUrl(t.websiteUrl)]} name={t.name} size={48} />
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight text-[var(--text)]">{t.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm">
            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${SIMULATOR_STATUS_STYLE[simulatorDisplayStatus(t)] ?? ""}`}>
              {SIMULATOR_STATUS_LABEL[simulatorDisplayStatus(t)] ?? simulatorDisplayStatus(t)}
            </span>
            {isSimulatorSecret(t) ? (
              <>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${SIMULATOR_SECRET_STYLE}`}>シークレット</span>
                <span className="text-[var(--text-dim)]">特別付与・{formatYen(0)}/月</span>
              </>
            ) : (
              <span className="text-[var(--text-dim)]">
                {t.planName}・{formatYen(simulatorChargedMonthlyJpy(t))}/月
              </span>
            )}
            {simulatorTrialLabel(t) && <span className="text-[var(--gold)] font-medium">{simulatorTrialLabel(t)}</span>}
          </div>
        </div>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="問い合わせ（30日）" value={t.leadCount30d} sub={`累計 ${t.leadCount}件`} />
        <Stat label="シミュ保存（30日）" value={t.simulationCount30d} sub={`累計 ${t.simulationCount}件`} />
        <Stat label="登録車種" value={t.vehicleCount} />
        <Stat
          label="最終問い合わせ"
          value={t.lastLeadAt ? new Date(t.lastLeadAt).toLocaleDateString("ja-JP") : "—"}
        />
      </section>

      <section className={card}>
        <h2 className="font-semibold text-[var(--text)] mb-2">契約・サイト</h2>
        <Row label="公開URL">
          <a href={t.publicUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">
            {t.publicUrl}
          </a>
          <span className="ml-2 text-[var(--text-dim)]">（{t.published ? "公開中" : "非公開"}）</span>
        </Row>
        <Row label="初期設定">{t.onboardingDone ? "完了" : "未完了"}</Row>
        <Row label="契約日">{new Date(t.createdAt).toLocaleDateString("ja-JP")}</Row>
        <Row label="メンバー数">{t.memberCount}人</Row>
      </section>

      <section className={card}>
        <h2 className="font-semibold text-[var(--text)] mb-1">シークレットプラン</h2>
        <p className="text-sm text-[var(--text-dim)] mb-3">
          自社・関係先・デモ用の店舗に、プレミアムと同じ機能を無料・無期限で付与します。解除すると解約済みと同じ扱いになり、店舗が自分で有料プランを申し込めるようになります。
        </p>
        <SecretPlanForm id={t.id} name={t.name} enabled={t.secretPlan} hasSubscription={t.hasSubscription} />
      </section>

      <section className={card}>
        <h2 className="font-semibold text-[var(--text)] mb-2">連絡先</h2>
        <Row label="担当者">{t.ownerName ?? "—"}</Row>
        <Row label="ログインメール">
          {t.ownerEmail ? <a href={`mailto:${t.ownerEmail}`} className="text-[var(--accent)] hover:underline">{t.ownerEmail}</a> : "—"}
        </Row>
        <Row label="店舗メール">
          {t.contactEmail ? <a href={`mailto:${t.contactEmail}`} className="text-[var(--accent)] hover:underline">{t.contactEmail}</a> : "—"}
        </Row>
        <Row label="電話番号">{t.contactPhone ?? "—"}</Row>
        <Row label="Webサイト">
          {t.websiteUrl ? (
            <a href={t.websiteUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">
              {t.websiteUrl}
            </a>
          ) : (
            "—"
          )}
        </Row>
        <Row label="住所">{t.address ?? "—"}</Row>
      </section>
    </div>
  );
}
