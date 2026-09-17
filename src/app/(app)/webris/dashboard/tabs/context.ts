import type { AdSpendSummary } from "@/lib/webrisAnalytics/adsService";
import type { ResolvedRange } from "@/lib/webrisAnalytics/range";
import type { WebrisAnalyticsPayload } from "@/lib/webrisAnalytics/types";
import type { RangeParams } from "../controls";

export type DashboardSearchParams = {
  range?: string;
  compare?: string;
  from?: string;
  to?: string;
  tab?: string;
  rank?: string;
  kw?: string;
  page?: string;
  plan?: string;
  scan?: string;
};

export type TabContext = {
  payload: WebrisAnalyticsPayload;
  range: ResolvedRange;
  ads: AdSpendSummary;
  adsPrev: AdSpendSummary;
  href: (over: Partial<DashboardSearchParams>) => string;
  sp: DashboardSearchParams;
  rangeParams: RangeParams;
};

export function pageNumber(v: string | undefined) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
