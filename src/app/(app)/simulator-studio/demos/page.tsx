import {
  fetchSimulatorDemos,
  SimulatorStudioApiError,
  SimulatorStudioNotConfiguredError,
  type SimulatorDemoCatalog,
} from "@/lib/simulator-studio";
import { CreateDemoForm, DeleteDemoButton } from "./DemoForms";

export const dynamic = "force-dynamic";

const card = "border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm";

/**
 * シミュレータースタジオのデモページ管理。
 * テーマごとのデモ店舗（「テーマを探す」の「デモを見る」）を、メールアドレスなしで作成・削除し、管理画面を開いて編集する。
 */
export default async function SimulatorDemosPage() {
  let catalog: SimulatorDemoCatalog | null = null;
  let error: string | null = null;
  try {
    catalog = await fetchSimulatorDemos();
  } catch (e) {
    error =
      e instanceof SimulatorStudioNotConfiguredError || e instanceof SimulatorStudioApiError
        ? e.message
        : "デモページの取得中に予期しないエラーが発生しました。";
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">シミュレータースタジオ デモページ管理</h1>
        <p className="text-[var(--text-dim)] mt-1">
          テーマごとのデモページを作成します。施工店の「テーマを探す」で、そのテーマのカードに「デモを見る」が表示されます。メールアドレスは不要です。
        </p>
      </div>

      {error && (
        <div className="border border-[var(--gold)]/30 bg-[var(--gold-tint)] rounded-2xl p-5 text-sm text-[var(--text)]">
          <p className="font-medium mb-1">シミュレータースタジオとの連携が完了していません</p>
          <p className="text-[var(--text-dim)]">{error}</p>
        </div>
      )}

      {catalog && (
        <>
          <section className={card}>
            <h2 className="text-base font-semibold text-[var(--text)] mb-4">デモページを作成</h2>
            <CreateDemoForm themes={catalog.themes} sources={catalog.sources} usedThemeIds={catalog.demos.map((d) => d.themeId)} />
          </section>

          <section className={`${card} p-0 overflow-hidden`}>
            <div className="px-5 py-4 border-b border-[var(--line)] text-base font-semibold text-[var(--text)]">デモページ一覧（{catalog.demos.length}件）</div>
            {catalog.demos.length === 0 ? (
              <p className="px-5 py-8 text-sm text-[var(--text-dim)]">まだデモページはありません。</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-[var(--text-dim)]">
                  <tr className="border-b border-[var(--line)]">
                    <th className="text-left font-medium px-5 py-2">テーマ</th>
                    <th className="text-left font-medium px-5 py-2">店舗名</th>
                    <th className="text-left font-medium px-5 py-2">URL</th>
                    <th className="text-right font-medium px-5 py-2">車両</th>
                    <th className="text-left font-medium px-5 py-2">作成日</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {catalog.demos.map((d) => (
                    <tr key={d.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-5 py-3 font-medium text-[var(--text)]">{d.themeLabel}</td>
                      <td className="px-5 py-3 text-[var(--text)]">{d.name}</td>
                      <td className="px-5 py-3">
                        <a href={d.publicUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--text-dim)] hover:text-[var(--text)] hover:underline">
                          {d.publicUrl.replace(/^https?:\/\//, "")}
                        </a>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{d.vehicleCount}</td>
                      <td className="px-5 py-3 text-[var(--text-dim)]">{new Date(d.createdAt).toLocaleDateString("ja-JP")}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-4">
                          <a href={`/simulator-studio/demos/${d.id}/open`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[var(--text)] hover:underline">
                            管理画面を開く
                          </a>
                          <DeleteDemoButton id={d.id} name={d.name} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
