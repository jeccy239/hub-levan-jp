// gBizINFO (経済産業省) REST API client — free, covers ~4M registered
// Japanese corporations. Used as the source of *real* prospect companies,
// replacing the LLM-invented placeholders the prospecting agent used to
// produce (an LLM with no web access hallucinates company names).
//
// Token: free application at https://info.gbiz.go.jp/hojin/APIManual
// Docs:  https://info.gbiz.go.jp/hojin/swagger-ui/index.html

const BASE_URL = "https://info.gbiz.go.jp/hojin/v1/hojin";

export class GbizNotConfiguredError extends Error {}
export class GbizApiError extends Error {}

export type GbizCompany = {
  corporateNumber: string;
  name: string;
  location: string | null;
  prefectureName: string | null;
  companyUrl: string | null;
  businessSummary: string | null;
  businessItems: string[];
  employeeNumber: number | null;
  capitalStock: number | null;
  foundingYear: number | null;
};

export type GbizSearchParams = {
  name?: string;
  /** JIS X 0401 都道府県コード (e.g. "13" = 東京都) */
  prefecture?: string;
  businessItem?: string;
  employeeFrom?: number;
  employeeTo?: number;
  page?: number;
};

function getToken(): string {
  const token = process.env.GBIZINFO_API_TOKEN;
  if (!token) {
    throw new GbizNotConfiguredError(
      "GBIZINFO_API_TOKEN が未設定です。https://info.gbiz.go.jp/hojin/APIManual から無料のAPIトークンを申請し、環境変数に設定してください。",
    );
  }
  return token;
}

function toCompany(raw: Record<string, unknown>): GbizCompany {
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const establishment = str(raw.date_of_establishment);

  return {
    corporateNumber: String(raw.corporate_number ?? ""),
    name: String(raw.name ?? "").trim(),
    location: str(raw.location),
    prefectureName: str(raw.prefecture_name),
    companyUrl: str(raw.company_url),
    businessSummary: str(raw.business_summary),
    businessItems: Array.isArray(raw.business_items) ? raw.business_items.map(String) : [],
    employeeNumber: num(raw.employee_number),
    capitalStock: num(raw.capital_stock),
    foundingYear: establishment ? Number(establishment.slice(0, 4)) || null : null,
  };
}

export async function searchGbizCompanies(params: GbizSearchParams): Promise<GbizCompany[]> {
  const token = getToken();

  const query = new URLSearchParams({ page: String(params.page ?? 1) });
  if (params.name) query.set("name", params.name);
  if (params.prefecture) query.set("prefecture", params.prefecture);
  if (params.businessItem) query.set("business_item", params.businessItem);
  if (params.employeeFrom != null) query.set("employee_number_from", String(params.employeeFrom));
  if (params.employeeTo != null) query.set("employee_number_to", String(params.employeeTo));
  // 事業概要・企業HPが埋まっている法人に絞る（営業対象として意味があるのはこの層）
  query.set("exist_flg", "true");

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}?${query}`, {
      headers: { "X-hojinInfo-api-token": token, Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new GbizApiError("gBizINFOに接続できませんでした。ネットワークを確認してください。");
  }

  if (response.status === 401 || response.status === 403) {
    throw new GbizApiError("gBizINFOのAPIトークンが無効です。GBIZINFO_API_TOKEN を確認してください。");
  }
  if (response.status === 404) {
    return []; // gBizINFO returns 404 for "no results", not an empty list
  }
  if (!response.ok) {
    throw new GbizApiError(`gBizINFOからエラーが返されました（HTTP ${response.status}）。`);
  }

  const data = await response.json().catch(() => null);
  const rows =
    (data?.["hojin-infos"] as Record<string, unknown>[] | undefined) ??
    (data?.hojin_infos as Record<string, unknown>[] | undefined) ??
    [];

  return rows.map(toCompany).filter((c) => c.name && c.corporateNumber);
}
