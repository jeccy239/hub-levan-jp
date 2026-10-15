// Client for SimulatorStudio's admin API (a separate product/codebase at
// simulatorstudio.jp). Same shape as src/lib/webris.ts: LEVAN HUB never
// touches SimulatorStudio's database, it calls an authenticated API.
// The endpoints live in the SimulatorStudio repo under src/app/api/levanhub/
// (tenants: list + secret-plan grant; demos: theme demo pages — list/create/delete/login).

export type SimulatorTenant = {
  id: string;
  slug: string;
  name: string;
  publicUrl: string; // https://{slug}.simulatorstudio.jp
  planCode: string; // STARTER | PROFESSIONAL | ENTERPRISE | SECRET
  planName: string;
  monthlyPriceJpy: number;
  secretPlan: boolean; // シークレットプラン（特別付与の無料プラン）
  hasSubscription: boolean; // Stripe で有料プランを契約中
  status: string; // TRIAL | ACTIVE | CANCELED | SUSPENDED
  inTrial?: boolean; // お試し中（まだ請求していない。Stripe のお試し期間中は status が ACTIVE のことがある）
  trialEndsAt?: string | null; // ISO — お試しの終了日時
  published: boolean;
  onboardingDone: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  address: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  memberCount: number;
  vehicleCount: number;
  leadCount: number;
  leadCount30d: number;
  simulationCount: number;
  simulationCount30d: number;
  lastLeadAt: string | null; // ISO
  createdAt: string; // ISO — 契約日として表示
};

export class SimulatorStudioNotConfiguredError extends Error {}
export class SimulatorStudioApiError extends Error {}

export const SIMULATOR_STATUS_LABEL: Record<string, string> = {
  TRIAL: "トライアル",
  ACTIVE: "契約中",
  CANCELED: "解約済み",
  SUSPENDED: "停止中",
};

export const SIMULATOR_STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
  TRIAL: "bg-[var(--gold-tint)] text-[var(--gold)]",
  CANCELED: "bg-[var(--surface-2)] text-[var(--text-dim)]",
  SUSPENDED: "bg-[var(--surface-2)] text-[var(--text-dim)]",
};

/** 表示用のステータス（Stripe のお試し期間中も「トライアル」として扱う） */
export function simulatorDisplayStatus(t: SimulatorTenant): string {
  return t.inTrial ? "TRIAL" : t.status;
}

/** シークレットプラン（特別付与の無料プラン）か */
export function isSimulatorSecret(t: SimulatorTenant): boolean {
  return t.secretPlan || t.planCode === "SECRET";
}

/** シークレットプランのバッジ（パープル） */
export const SIMULATOR_SECRET_STYLE = "bg-[var(--purple-tint)] text-[var(--purple)]";

/** 実際に請求している月額（お試し中はまだ決済していない・シークレットは無料なので 0 円） */
export function simulatorChargedMonthlyJpy(t: SimulatorTenant): number {
  return t.inTrial || isSimulatorSecret(t) ? 0 : t.monthlyPriceJpy;
}

/** お試しの残り日数（お試し中でなければ null） */
export function simulatorTrialDaysLeft(t: SimulatorTenant, now = new Date()): number | null {
  if (!t.inTrial || !t.trialEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(t.trialEndsAt).getTime() - now.getTime()) / 864e5));
}

export function simulatorTrialLabel(t: SimulatorTenant): string | null {
  const days = simulatorTrialDaysLeft(t);
  if (days === null) return null;
  return days > 0 ? `トライアル残り${days}日` : "トライアル期限切れ";
}

export async function fetchSimulatorTenants(): Promise<SimulatorTenant[]> {
  const baseUrl = process.env.SIMULATOR_STUDIO_API_URL;
  const secret = process.env.SIMULATOR_STUDIO_API_SECRET;
  if (!baseUrl || !secret) {
    throw new SimulatorStudioNotConfiguredError(
      "SIMULATOR_STUDIO_API_URL / SIMULATOR_STUDIO_API_SECRET が未設定です。連携を有効にするには環境変数を設定してください。",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/levanhub/tenants`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
  } catch {
    throw new SimulatorStudioApiError("シミュレータースタジオに接続できませんでした。ネットワークまたはURL設定を確認してください。");
  }

  if (response.status === 401) {
    throw new SimulatorStudioApiError("認証に失敗しました。両サービスのシークレットが一致しているか確認してください。");
  }
  if (!response.ok) {
    throw new SimulatorStudioApiError(`シミュレータースタジオからエラーが返されました（HTTP ${response.status}）。`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new SimulatorStudioApiError("シミュレータースタジオからの応答形式が想定と異なります。");
  }
  return data as SimulatorTenant[];
}

// ───────────── デモページ（「テーマを探す」の「デモを見る」用のデモ店舗） ─────────────

export type SimulatorDemo = {
  id: string;
  slug: string;
  name: string;
  themeId: string;
  themeLabel: string;
  publicUrl: string;
  published: boolean;
  vehicleCount: number;
  createdAt: string; // ISO
};

export type SimulatorDemoCatalog = {
  demos: SimulatorDemo[];
  themes: { id: string; label: string; premium: boolean }[];
  sources: { id: string; name: string; slug: string; isDemo: boolean }[]; // コピー元に選べる店舗
};

/** SimulatorStudio の LEVAN HUB 用 API を呼ぶ（エラーは日本語のメッセージにする） */
async function callSimulatorStudio(path: string, init?: RequestInit): Promise<unknown> {
  const baseUrl = process.env.SIMULATOR_STUDIO_API_URL;
  const secret = process.env.SIMULATOR_STUDIO_API_SECRET;
  if (!baseUrl || !secret) {
    throw new SimulatorStudioNotConfiguredError(
      "SIMULATOR_STUDIO_API_URL / SIMULATOR_STUDIO_API_SECRET が未設定です。連携を有効にするには環境変数を設定してください。",
    );
  }
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new SimulatorStudioApiError("シミュレータースタジオに接続できませんでした。ネットワークまたはURL設定を確認してください。");
  }
  if (response.status === 401) {
    throw new SimulatorStudioApiError("認証に失敗しました。両サービスのシークレットが一致しているか確認してください。");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null;
    throw new SimulatorStudioApiError(message ?? `シミュレータースタジオからエラーが返されました（HTTP ${response.status}）。`);
  }
  return data;
}

export async function fetchSimulatorDemos(): Promise<SimulatorDemoCatalog> {
  const data = (await callSimulatorStudio("/api/levanhub/demos")) as SimulatorDemoCatalog | null;
  if (!data || !Array.isArray(data.demos)) throw new SimulatorStudioApiError("シミュレータースタジオからの応答形式が想定と異なります。");
  return data;
}

/** デモ店舗を作る（コピー元の店舗の車両・カラー・ページ構成を複製し、テーマだけ差し替える） */
export async function createSimulatorDemo(input: { themeId: string; sourceTenantId: string; slug: string; name: string }) {
  return (await callSimulatorStudio("/api/levanhub/demos", { method: "POST", body: JSON.stringify(input) })) as { id: string; slug: string; publicUrl: string };
}

export async function deleteSimulatorDemo(id: string): Promise<void> {
  await callSimulatorStudio(`/api/levanhub/demos/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** デモ店舗の管理画面にログインするURL（2分だけ有効） */
export async function simulatorDemoLoginUrl(id: string): Promise<string> {
  const data = (await callSimulatorStudio(`/api/levanhub/demos/${encodeURIComponent(id)}/login`, { method: "POST" })) as { url?: string } | null;
  if (!data?.url) throw new SimulatorStudioApiError("ログイン用のURLを取得できませんでした。");
  return data.url;
}

// ───────────── シークレットプラン（自社・関係先・デモ店舗に無料で付与） ─────────────

/** シークレットプランを付与（enabled: true）・解除（false）する。解除すると店舗は解約済みと同じ扱いになり、自分で有料プランを申し込める */
export async function setSimulatorSecretPlan(id: string, enabled: boolean) {
  return (await callSimulatorStudio(`/api/levanhub/tenants/${encodeURIComponent(id)}/secret-plan`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  })) as { id: string; secretPlan: boolean; planCode: string; status: string };
}
