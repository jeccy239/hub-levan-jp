// Client for WEBRIS's admin API (a separate product/codebase at
// webris.levan.jp). LEVAN HUB never touches WEBRIS's database directly —
// it calls an authenticated read (and later write) API instead, so the
// two apps stay independently deployable. See docs/webris-integration.md
// for the endpoint contract WEBRIS needs to implement.

export type WebrisOrganization = {
  id: string;
  name: string;
  websiteUrl: string | null;
  planCode: string;
  planName: string;
  monthlyPriceJpy: number;
  subscriptionStatus: string | null; // active | trialing | past_due | canceled | incomplete | null(free)
  currentPeriodEnd: string | null; // ISO date
  createdAt: string; // ISO date — treated as the contract/signup date
  ownerName: string | null;
  ownerEmail: string;
};

export class WebrisNotConfiguredError extends Error {}
export class WebrisApiError extends Error {}

function getConfig() {
  const baseUrl = process.env.WEBRIS_API_URL;
  const secret = process.env.WEBRIS_API_SECRET;
  if (!baseUrl || !secret) {
    throw new WebrisNotConfiguredError(
      "WEBRIS_API_URL / WEBRIS_API_SECRET が未設定です。連携を有効にするには環境変数を設定してください。",
    );
  }
  return { baseUrl, secret };
}

export async function fetchWebrisOrganizations(): Promise<WebrisOrganization[]> {
  const { baseUrl, secret } = getConfig();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/levanhub/organizations`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
  } catch {
    throw new WebrisApiError("WEBRISに接続できませんでした。ネットワークまたはURL設定を確認してください。");
  }

  if (response.status === 404) {
    throw new WebrisApiError(
      "WEBRIS側に連携APIがまだ実装されていません（/api/levanhub/organizations が404）。",
    );
  }
  if (!response.ok) {
    throw new WebrisApiError(`WEBRISからエラーが返されました（HTTP ${response.status}）。`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new WebrisApiError("WEBRISからの応答形式が想定と異なります。");
  }
  return data as WebrisOrganization[];
}

export type WebrisPaymentMethod = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
} | null;

async function webrisFetch(path: string, init?: RequestInit) {
  const { baseUrl, secret } = getConfig();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
  } catch {
    throw new WebrisApiError("WEBRISに接続できませんでした。ネットワークまたはURL設定を確認してください。");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new WebrisApiError(body?.error ?? `WEBRISからエラーが返されました（HTTP ${response.status}）。`);
  }
  return body;
}

export async function fetchWebrisPaymentMethod(orgId: string): Promise<WebrisPaymentMethod> {
  const body = await webrisFetch(`/api/levanhub/organizations/${orgId}/billing-detail`);
  return body?.paymentMethod ?? null;
}

export async function changeWebrisPlan(orgId: string, planCode: string): Promise<string> {
  const body = await webrisFetch(`/api/levanhub/organizations/${orgId}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planCode }),
  });
  return body?.message ?? "プラン変更を送信しました。";
}

export async function cancelWebrisSubscription(orgId: string): Promise<string> {
  const body = await webrisFetch(`/api/levanhub/organizations/${orgId}/cancel`, { method: "POST" });
  return body?.message ?? "解約を送信しました。";
}

// Plan codes rarely change; WEBRIS's own API remains the source of truth
// for price (returned per-organization), this is display labels only.
export const WEBRIS_PLAN_LABEL: Record<string, string> = {
  free: "Free",
  standard: "Standard",
  pro: "Pro",
  business: "Business",
};

export type WebrisPlanChange = {
  organizationId: string;
  organizationName: string;
  from: string | null;
  to: string | null;
  changedAt: string;
};

export async function fetchWebrisPlanChanges(): Promise<WebrisPlanChange[]> {
  const body = await webrisFetch(`/api/levanhub/plan-changes`);
  return Array.isArray(body) ? (body as WebrisPlanChange[]) : [];
}
