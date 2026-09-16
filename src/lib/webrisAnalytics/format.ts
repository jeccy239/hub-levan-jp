import type { KpiFormat } from "./metrics";

export const DASH = "—";

export function fmtInt(n: number | null | undefined) {
  return n === null || n === undefined ? DASH : Math.round(n).toLocaleString("ja-JP");
}

export function fmtJpy(n: number | null | undefined) {
  return n === null || n === undefined ? DASH : `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function fmtPct(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  const v = n * 100;
  return `${v.toFixed(Math.abs(v) >= 100 ? 0 : digits)}%`;
}

export function fmtDuration(sec: number | null | undefined) {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return DASH;
  const s = Math.round(sec);
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  return `${m}分${String(s % 60).padStart(2, "0")}秒`;
}

export function fmtPosition(n: number | null | undefined) {
  return n === null || n === undefined || n === 0 ? DASH : n.toFixed(1);
}

export function fmtValue(n: number, format: KpiFormat) {
  switch (format) {
    case "jpy":
      return fmtJpy(n);
    case "pct":
      return fmtPct(n, 2);
    case "duration":
      return fmtDuration(n);
    case "position":
      return fmtPosition(n);
    default:
      return fmtInt(n);
  }
}

/** 前期間との差分の表示（率が出せない＝前期間0 のときは差分のみ） */
export function fmtDiff(diff: number, format: KpiFormat) {
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  const abs = Math.abs(diff);
  const body =
    format === "pct" ? `${(abs * 100).toFixed(2)}pt` : format === "position" ? abs.toFixed(1) : format === "duration" ? fmtDuration(abs) : format === "jpy" ? fmtJpy(abs) : fmtInt(abs);
  return `${sign}${body}`;
}

const dtf = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const df = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return DASH;
  return dtf.format(typeof d === "string" ? new Date(d) : d);
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return DASH;
  return df.format(typeof d === "string" ? new Date(d) : d);
}

/** 内部IDの表示（全体は出さず末尾だけ） */
export function shortId(id: string) {
  return `…${id.slice(-8)}`;
}
