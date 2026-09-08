// gBizINFO (経済産業省) REST API client — free, covers ~4M registered
// Japanese corporations. Used as the source of *real* prospect companies,
// replacing the LLM-invented placeholders the prospecting agent used to
// produce (an LLM with no web access hallucinates company names).
//
// Token: free application at https://info.gbiz.go.jp/hojin/APIManual
//
// 重要な実測事実（2026-09 時点、実APIで確認済み）:
//  1. 検索エンドポイントは company_url を返さない。基本登記情報のみ。
//     URLを得るには法人番号ごとに詳細エンドポイントを叩く必要がある。
//  2. company_url / employee_number 等の拡張項目が入っているのは、
//     国の調達・補助金・認定などの活動記録がある法人だけ。条件なし検索では
//     URL保有率は 0/20 だったが、business_item（全省庁統一資格の営業品目）で
//     絞ると 7/20 まで上がる。したがって business_item での絞り込みは必須。

const BASE_URL = "https://info.gbiz.go.jp/hojin/v1/hojin";

export class GbizNotConfiguredError extends Error {}
export class GbizApiError extends Error {}

/** 検索で返る最小限の情報 */
export type GbizSearchRow = {
  corporateNumber: string;
  name: string;
  location: string | null;
};

/** 詳細エンドポイントで得られる拡張情報 */
export type GbizCompany = GbizSearchRow & {
  companyUrl: string | null;
  businessSummary: string | null;
  businessItems: string[];
  employeeNumber: number | null;
  capitalStock: number | null;
  foundingYear: number | null;
};

// 全省庁統一資格「役務の提供等」の営業品目コード。この資格を持つ法人ほど
// gBizINFOに企業HP等が登録されている。広告・情報処理・調査などが含まれる。
export const SERVICE_BUSINESS_ITEMS = ["301", "304", "305", "306", "307"] as const;

function getToken(): string {
  const token = process.env.GBIZINFO_API_TOKEN;
  if (!token) {
    throw new GbizNotConfiguredError(
      "GBIZINFO_API_TOKEN が未設定です。https://info.gbiz.go.jp/hojin/APIManual から無料のAPIトークンを申請し、環境変数に設定してください。",
    );
  }
  return token;
}

function headers() {
  return { "X-hojinInfo-api-token": getToken(), Accept: "application/json" };
}

async function gbizFetch(url: string): Promise<Record<string, unknown>[] | null> {
  let response: Response;
  try {
    response = await fetch(url, { headers: headers(), cache: "no-store" });
  } catch {
    throw new GbizApiError("gBizINFOに接続できませんでした。ネットワークを確認してください。");
  }

  if (response.status === 401 || response.status === 403) {
    throw new GbizApiError("gBizINFOのAPIトークンが無効です。GBIZINFO_API_TOKEN を確認してください。");
  }
  if (response.status === 404) return []; // gBizINFOは「該当なし」を404で返す
  if (response.status === 429) {
    throw new GbizApiError("gBizINFOのレート制限に達しました。しばらく待ってから再実行してください。");
  }
  if (!response.ok) {
    throw new GbizApiError(`gBizINFOからエラーが返されました（HTTP ${response.status}）。`);
  }

  const data = await response.json().catch(() => null);
  return (data?.["hojin-infos"] as Record<string, unknown>[] | undefined) ?? [];
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || null);

export async function searchGbizCompanies(params: {
  /** JIS X 0401 都道府県コード (e.g. "13" = 東京都) */
  prefecture?: string;
  /** 全省庁統一資格の営業品目コード。URL保有率を上げるため既定で指定する。 */
  businessItem?: string;
  name?: string;
  page?: number;
}): Promise<GbizSearchRow[]> {
  const query = new URLSearchParams({ page: String(params.page ?? 1) });
  if (params.prefecture) query.set("prefecture", params.prefecture);
  if (params.name) query.set("name", params.name);
  query.set("business_item", params.businessItem ?? SERVICE_BUSINESS_ITEMS[0]);

  const rows = (await gbizFetch(`${BASE_URL}?${query}`)) ?? [];
  return rows
    .map((r) => ({
      corporateNumber: String(r.corporate_number ?? ""),
      name: String(r.name ?? "").trim(),
      location: str(r.location),
    }))
    .filter((r) => r.name && r.corporateNumber);
}

/** 法人番号1件の詳細。企業HPが未登録なら companyUrl は null。 */
export async function fetchGbizDetail(corporateNumber: string): Promise<GbizCompany | null> {
  const rows = await gbizFetch(`${BASE_URL}/${encodeURIComponent(corporateNumber)}`);
  const h = rows?.[0];
  if (!h) return null;

  const establishment = str(h.date_of_establishment);
  return {
    corporateNumber: String(h.corporate_number ?? corporateNumber),
    name: String(h.name ?? "").trim(),
    location: str(h.location),
    companyUrl: str(h.company_url),
    businessSummary: str(h.business_summary),
    businessItems: Array.isArray(h.business_items) ? h.business_items.map(String) : [],
    employeeNumber: num(h.employee_number),
    capitalStock: num(h.capital_stock),
    foundingYear: establishment ? Number(establishment.slice(0, 4)) || null : null,
  };
}

/** 詳細を並行取得する。gBizINFOに負荷をかけないよう同時実行数を絞る。 */
export async function fetchGbizDetails(corporateNumbers: string[], concurrency = 6): Promise<GbizCompany[]> {
  const queue = [...corporateNumbers];
  const out: GbizCompany[] = [];

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let cn = queue.shift(); cn; cn = queue.shift()) {
        try {
          const detail = await fetchGbizDetail(cn);
          if (detail) out.push(detail);
        } catch {
          // 個別の失敗でバッチ全体を落とさない
        }
      }
    }),
  );

  return out;
}
