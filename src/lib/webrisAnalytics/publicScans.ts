import { getWebrisConfig, WebrisNotConfiguredError } from "@/lib/webris";
import type { DateRange } from "./types";

// WEBRIS の GET /api/levanhub/public-scans の応答型。
// トップページ等の無料SEO診断（未ログイン）の実行履歴。
// 実装は webris.levan.jp リポジトリの src/app/api/levanhub/public-scans/route.ts。

export type PublicScanStatus = "ok" | "invalid_url" | "blocked_host" | "unreachable" | "not_html" | "http_error" | "error";

export type PublicScanItem = {
  id: string;
  url: string;
  finalUrl: string | null;
  host: string | null;
  status: PublicScanStatus | (string & {});
  score: number | null;
  passCount: number | null;
  issueCount: number | null;
  /** PV_EXCLUDE_IPS（社内IP）からの診断 */
  internal: boolean;
  createdAt: string;
};

export type PublicScansPayload = {
  generatedAt: string;
  range: DateRange;
  /** scans / succeeded / sites は社内IPを除いた件数 */
  totals: { scans: number; succeeded: number; sites: number; internal: number };
  daily: { date: string; scans: number }[];
  items: PublicScanItem[];
  truncated: boolean;
};

export type PublicScansFetch = { data: PublicScansPayload; error: null } | { data: null; error: string };

const LIMIT = 500;

/**
 * 診断直後に画面へ出したいので、集計APIと違ってキャッシュしない。
 * WEBRIS 側は1テーブルを読むだけなので毎回呼んでも軽い。
 */
export async function getPublicScans(range: DateRange): Promise<PublicScansFetch> {
  let config: { baseUrl: string; secret: string };
  try {
    config = getWebrisConfig();
  } catch (e) {
    return { data: null, error: e instanceof WebrisNotConfiguredError ? e.message : "WEBRISの設定を読み込めませんでした。" };
  }
  const qs = new URLSearchParams({ start: range.start, end: range.end, limit: String(LIMIT) });
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/api/levanhub/public-scans?${qs}`, {
      headers: { Authorization: `Bearer ${config.secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return { data: null, error: timedOut ? "WEBRISの応答がタイムアウトしました。" : "WEBRISに接続できませんでした。" };
  }
  if (response.status === 404) {
    return { data: null, error: "WEBRIS側に診断履歴API（/api/levanhub/public-scans）がまだデプロイされていません。" };
  }
  if (response.status === 401) {
    return { data: null, error: "WEBRISに認証を拒否されました（WEBRIS_API_SECRET を確認してください）。" };
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return { data: null, error: body?.error ?? `WEBRISからエラーが返されました（HTTP ${response.status}）。` };
  }
  if (!body || typeof body !== "object" || !Array.isArray(body.items)) {
    return { data: null, error: "WEBRISからの応答形式が想定と異なります。" };
  }
  return { data: body as PublicScansPayload, error: null };
}
