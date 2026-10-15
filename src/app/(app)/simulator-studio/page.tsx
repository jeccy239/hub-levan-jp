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
import type { SimulatorTenant } from "@/lib/simulator-studio";
import { formatYen } from "@/lib/labels";
import Avatar from "@/components/Avatar";
import { faviconUrl } from "@/lib/avatar";

export const dynamic = "force-dynamic";

const PLAN_ORDER = ["STARTER", "PROFESSIONAL", "ENTERPRISE"];

const pill = (active: boolean) =>
  `text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-200 ${
    active
      ? "bg-white/70 text-[var(--text)] backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
      : "text-[var(--text-dim)] hover:bg-white/30 hover:text-[var(--text)]"
  }`;

function buildQuery(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function SimulatorStudioTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = params.status && SIMULATOR_STATUS_LABEL[params.status] ? params.status : "";
  const search = (params.q ?? "").trim();

  let tenants: SimulatorTenant[] = [];
  let error: string | null = null;
  try {
    tenants = await fetchSimulatorTenants();
  } catch (e) {
    error =
      e instanceof SimulatorStudioNotConfiguredError || e instanceof SimulatorStudioApiError
        ? e.message
        : "契約店舗情報の取得中に予期しないエラーが発生しました。";
  }

  // 売上はトライアル・停止中を除いた「契約中」のみで集計する。
  const active = tenants.filter((t) => simulatorDisplayStatus(t) === "ACTIVE");
  const mrr = active.reduce((sum, t) => sum + simulatorChargedMonthlyJpy(t), 0);
  const byPlan = PLAN_ORDER.map((code) => {
    const list = active.filter((t) => t.planCode === code);
    return { code, count: list.length, revenue: list.reduce((s, t) => s + t.monthlyPriceJpy, 0) };
  });

  const needle = search.toLowerCase();
  const rows = tenants.filter((t) => {
    if (statusFilter && simulatorDisplayStatus(t) !== statusFilter) return false;
    if (needle) {
      const haystack = [t.name, t.slug, t.ownerName ?? "", t.ownerEmail ?? "", t.contactEmail ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">シミュレータースタジオ 契約店舗</h1>
        <p className="text-[var(--text-dim)] mt-1">
          simulatorstudio.jp を利用している店舗（テナント）の契約状況と利用状況を確認します。
        </p>
      </div>

      {error && (
        <div className="border border-[var(--gold)]/30 bg-[var(--gold-tint)] rounded-2xl p-5 text-sm text-[var(--text)]">
          <p className="font-medium mb-1">シミュレータースタジオとの連携が完了していません</p>
          <p className="text-[var(--text-dim)]">{error}</p>
        </div>
      )}

      {!error && (
        <>
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm">
              <div className="text-xs text-[var(--text-dim)] mb-1">月間売上（契約中）</div>
              <div className="text-2xl font-semibold tabular-nums text-[var(--text)]">{formatYen(mrr)}</div>
              <div className="text-xs text-[var(--text-dim)] mt-1">
                契約中 {active.length}店 ／ 全{tenants.length}店
              </div>
            </div>
            {byPlan.map((p) => (
              <div key={p.code} className="border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm">
                <div className="text-xs text-[var(--text-dim)] mb-1">{p.code}</div>
                <div className="text-2xl font-semibold tabular-nums text-[var(--text)]">{p.count}店</div>
                <div className="text-xs text-[var(--text-dim)] mt-1">月額 {formatYen(p.revenue)}</div>
              </div>
            ))}
          </section>

          <div className="inline-flex flex-wrap gap-1 p-1 rounded-full bg-black/[0.05] backdrop-blur-xl backdrop-saturate-150 border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.04)]">
            {[{ value: "", label: "すべて" }, ...Object.entries(SIMULATOR_STATUS_LABEL).map(([value, label]) => ({ value, label }))].map(
              (s) => (
                <Link
                  key={s.value || "all"}
                  href={`/simulator-studio${buildQuery({ status: s.value || undefined, q: search || undefined })}`}
                  className={pill(statusFilter === s.value)}
                >
                  {s.label}
                </Link>
              ),
            )}
          </div>

          <form method="get" className="border border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-sm p-4">
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
            <div className="flex flex-wrap gap-3">
              <input
                name="q"
                defaultValue={search}
                placeholder="店舗名・URL・担当者名・メールで検索"
                className="flex-1 min-w-[220px] border border-[var(--line)] rounded-xl px-3.5 py-2 text-xs bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-dim)]"
              />
              <button
                type="submit"
                className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white rounded-xl px-4 py-2 font-medium shadow-sm"
              >
                検索
              </button>
              {search && (
                <Link
                  href={`/simulator-studio${buildQuery({ status: statusFilter || undefined })}`}
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
                  <th className="px-3 py-2">店舗名</th>
                  <th className="px-3 py-2">担当者</th>
                  <th className="px-3 py-2">プラン</th>
                  <th className="px-3 py-2">月額</th>
                  <th className="px-3 py-2 whitespace-nowrap">ステータス</th>
                  <th className="px-3 py-2 whitespace-nowrap">公開</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">問い合わせ（30日）</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">シミュ保存（30日）</th>
                  <th className="px-3 py-2 whitespace-nowrap">契約日</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-2.5">
                        <Avatar srcs={[faviconUrl(t.websiteUrl)]} name={t.name} size={26} />
                        <div className="min-w-0">
                          <Link href={`/simulator-studio/${t.id}`} className="font-medium text-[var(--text)] hover:text-[var(--accent)]">
                            {t.name}
                          </Link>
                          <div className="text-[10px] text-[var(--text-dim)]">
                            <a href={t.publicUrl} target="_blank" rel="noreferrer" className="hover:underline">
                              {t.publicUrl.replace(/^https?:\/\//, "")}
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[var(--text-dim)]">
                      <div className="text-[var(--text)]">{t.ownerName ?? "—"}</div>
                      <div className="text-[10px] truncate">{t.ownerEmail ?? ""}</div>
                    </td>
                    <td className="px-3 py-2 text-[var(--text)] whitespace-nowrap">
                      {isSimulatorSecret(t) ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${SIMULATOR_SECRET_STYLE}`}>シークレット</span>
                      ) : (
                        t.planName
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-[var(--text)] whitespace-nowrap">
                      {formatYen(simulatorChargedMonthlyJpy(t))}
                      {simulatorTrialLabel(t) && <div className="text-[10px] text-[var(--gold)]">{simulatorTrialLabel(t)}</div>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${SIMULATOR_STATUS_STYLE[simulatorDisplayStatus(t)] ?? ""}`}>
                        {SIMULATOR_STATUS_LABEL[simulatorDisplayStatus(t)] ?? simulatorDisplayStatus(t)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-[var(--text-dim)]">{t.published ? "公開中" : "非公開"}</td>
                    <td className="px-3 py-2 tabular-nums text-right text-[var(--text)]">
                      {t.leadCount30d}
                      <span className="text-[var(--text-dim)]"> / 累計{t.leadCount}</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-right text-[var(--text)]">{t.simulationCount30d}</td>
                    <td className="px-3 py-2 text-[var(--text-dim)] whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString("ja-JP")}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Link
                        href={`/simulator-studio/${t.id}`}
                        className="inline-block text-[11px] font-semibold rounded-lg px-3 py-1.5 bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] shadow-sm"
                      >
                        詳細を見る
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-[var(--text-dim)]">
                      {search || statusFilter ? "条件に一致する店舗がありません。" : "契約店舗がまだありません。"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
