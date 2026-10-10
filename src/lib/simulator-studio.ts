// Client for SimulatorStudio's admin API (a separate product/codebase at
// simulatorstudio.jp). Same shape as src/lib/webris.ts: LEVAN HUB never
// touches SimulatorStudio's database, it calls an authenticated read-only
// API. The endpoint lives in the SimulatorStudio repo at
// src/app/api/levanhub/tenants/route.ts.

export type SimulatorTenant = {
  id: string;
  slug: string;
  name: string;
  publicUrl: string; // https://{slug}.simulatorstudio.jp
  planCode: string; // STARTER | PROFESSIONAL | ENTERPRISE
  planName: string;
  monthlyPriceJpy: number;
  status: string; // TRIAL | ACTIVE | SUSPENDED
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
  SUSPENDED: "停止中",
};

export const SIMULATOR_STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
  TRIAL: "bg-[var(--gold-tint)] text-[var(--gold)]",
  SUSPENDED: "bg-[var(--surface-2)] text-[var(--text-dim)]",
};

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
