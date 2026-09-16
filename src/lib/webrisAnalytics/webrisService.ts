import { prisma } from "@/lib/prisma";
import { getWebrisConfig, WebrisNotConfiguredError } from "@/lib/webris";
import { addDays, jstToday, rangeCacheKey, type ResolvedRange } from "./range";
import type { DashboardFetch, WebrisAnalyticsPayload } from "./types";

/**
 * WebrisService — WEBRIS の集計API（/api/levanhub/analytics）の取得とキャッシュ。
 *
 * WEBRIS 側は1回の呼び出しで GA4・Search Console・Stripe・DB をまとめて
 * 集計するため重い。ダッシュボードを開くたびに叩かないよう、期間ごとの結果を
 * WebrisAnalyticsCache に保存し、鮮度の許す間はそれを返す。
 * 「更新」ボタンからは force で再取得する。
 */

const FRESH_MS_RECENT = 15 * 60 * 1000; // 直近を含む期間：GA4 がまだ動いている
const FRESH_MS_PAST = 6 * 60 * 60 * 1000; // 3日以上前に終わった期間：ほぼ確定値
const RETAIN_MS = 14 * 24 * 60 * 60 * 1000;

function freshFor(range: ResolvedRange) {
  return range.current.end >= addDays(jstToday(), -2) ? FRESH_MS_RECENT : FRESH_MS_PAST;
}

const dataKey = (range: ResolvedRange) => `data:${rangeCacheKey(range)}`;

async function requestPayload(range: ResolvedRange): Promise<WebrisAnalyticsPayload> {
  const { baseUrl, secret } = getWebrisConfig();
  const qs = new URLSearchParams({
    start: range.current.start,
    end: range.current.end,
    prevStart: range.previous.start,
    prevEnd: range.previous.end,
  });
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/levanhub/analytics?${qs}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    throw new Error(timedOut ? "WEBRISの応答がタイムアウトしました。" : "WEBRISに接続できませんでした。");
  }
  if (response.status === 404) {
    throw new Error("WEBRIS側に集計API（/api/levanhub/analytics）がまだデプロイされていません。");
  }
  if (response.status === 401) {
    throw new Error("WEBRISに認証を拒否されました（WEBRIS_API_SECRET を確認してください）。");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `WEBRISからエラーが返されました（HTTP ${response.status}）。`);
  }
  if (!body || typeof body !== "object" || !("product" in body)) {
    throw new Error("WEBRISからの応答形式が想定と異なります。");
  }
  return body as WebrisAnalyticsPayload;
}

export async function getDashboardData(range: ResolvedRange, opts: { force?: boolean } = {}): Promise<DashboardFetch> {
  const key = dataKey(range);
  const cached = await prisma.webrisAnalyticsCache.findUnique({ where: { key } }).catch(() => null);
  const age = cached ? Date.now() - cached.fetchedAt.getTime() : Infinity;

  if (cached && !opts.force && age < freshFor(range)) {
    return { payload: cached.payload as unknown as WebrisAnalyticsPayload, error: null, fetchedAt: cached.fetchedAt, fromCache: true, stale: false };
  }

  try {
    const payload = await requestPayload(range);
    const fetchedAt = new Date();
    await prisma.webrisAnalyticsCache.upsert({
      where: { key },
      create: { key, payload: payload as never, fetchedAt },
      update: { payload: payload as never, fetchedAt },
    });
    // 古い期間のキャッシュを掃除（カスタム期間で行が増え続けないように）
    await prisma.webrisAnalyticsCache
      .deleteMany({ where: { fetchedAt: { lt: new Date(Date.now() - RETAIN_MS) } } })
      .catch(() => undefined);
    return { payload, error: null, fetchedAt, fromCache: false, stale: false };
  } catch (e) {
    const message =
      e instanceof WebrisNotConfiguredError ? e.message : e instanceof Error ? e.message : "WEBRISのデータ取得に失敗しました。";
    // 取得に失敗しても、前回の結果があれば「古いデータ」と明示して出す。
    if (cached) {
      return {
        payload: cached.payload as unknown as WebrisAnalyticsPayload,
        error: message,
        fetchedAt: cached.fetchedAt,
        fromCache: true,
        stale: true,
      };
    }
    return { payload: null, error: message, fetchedAt: null, fromCache: false, stale: false };
  }
}
