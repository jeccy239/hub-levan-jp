// Client for Anthropic's Admin API (Usage & Cost Report) — a separate
// credential from the regular ANTHROPIC_API_KEY used by the sales/SEO
// agents. Requires an Admin API key (starts with "sk-ant-admin...") from
// https://console.anthropic.com/settings/admin-keys, organization-level.

export type ClaudeCostBucket = {
  date: string; // YYYY-MM-DD
  costUsd: number;
};

export class AnthropicUsageNotConfiguredError extends Error {}
export class AnthropicUsageApiError extends Error {}

function getAdminKey(): string {
  const key = process.env.ANTHROPIC_ADMIN_API_KEY;
  if (!key) {
    throw new AnthropicUsageNotConfiguredError(
      "ANTHROPIC_ADMIN_API_KEY が未設定です。Anthropic ConsoleでAdmin API Keyを発行し、環境変数に設定してください。",
    );
  }
  return key;
}

// Anthropic's cost report paginates in ~31-day windows; we page through
// starting_at/ending_at until has_more is false or we hit a hard cap on
// requests (a year of daily data is at most 12 pages).
export async function fetchClaudeCostReport(startDate: string, endDate: string): Promise<ClaudeCostBucket[]> {
  const apiKey = getAdminKey();

  const buckets = new Map<string, number>();
  let pageUrl: string | null =
    `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${startDate}T00:00:00Z&ending_at=${endDate}T00:00:00Z&group_by[]=description`;

  for (let page = 0; page < 12 && pageUrl; page++) {
    let response: Response;
    try {
      response = await fetch(pageUrl, {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        cache: "no-store",
      });
    } catch {
      throw new AnthropicUsageApiError("Anthropicに接続できませんでした。ネットワークを確認してください。");
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new AnthropicUsageApiError(
        body?.error?.message ?? `Anthropicからエラーが返されました（HTTP ${response.status}）。`,
      );
    }

    const data = await response.json();
    for (const bucket of data.data ?? []) {
      const date = String(bucket.starting_at ?? "").slice(0, 10);
      const dayTotal = (bucket.results ?? []).reduce(
        (sum: number, r: { amount?: { value?: string } }) => sum + Number(r.amount?.value ?? 0),
        0,
      );
      buckets.set(date, (buckets.get(date) ?? 0) + dayTotal);
    }

    pageUrl = data.has_more && data.next_page
      ? `https://api.anthropic.com/v1/organizations/cost_report?page=${encodeURIComponent(data.next_page)}`
      : null;
  }

  return [...buckets.entries()]
    .map(([date, costUsd]) => ({ date, costUsd }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Live USD→JPY rate via a free, keyless API. Falls back to a fixed estimate
// if the request fails, so the dashboard still renders a (labeled) figure.
const FALLBACK_USD_JPY_RATE = 150;

export async function fetchUsdJpyRate(): Promise<{ rate: number; isLive: boolean }> {
  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=USD&to=JPY", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("bad response");
    const data = await response.json();
    const rate = data?.rates?.JPY;
    if (typeof rate === "number") return { rate, isLive: true };
  } catch {
    // fall through to the fixed estimate
  }
  return { rate: FALLBACK_USD_JPY_RATE, isLive: false };
}
