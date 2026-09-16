import type { DateRange } from "./types";

// 期間はすべて JST の日付（YYYY-MM-DD）で扱う。
// 「7日間」などは GA4 の既定と同じく、今日を含まない直近N日（昨日まで）。

export const RANGE_PRESETS = [
  { value: "today", label: "今日" },
  { value: "yesterday", label: "昨日" },
  { value: "7d", label: "7日間" },
  { value: "28d", label: "28日間" },
  { value: "30d", label: "30日間" },
  { value: "90d", label: "90日間" },
  { value: "ytd", label: "今年" },
  { value: "custom", label: "カスタム" },
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number]["value"];

export const COMPARE_MODES = [
  { value: "prev", label: "前期間比" },
  { value: "yoy", label: "前年同期比" },
] as const;
export type CompareMode = (typeof COMPARE_MODES)[number]["value"];

const DAY = 24 * 60 * 60 * 1000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function jstToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUtcDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}
function fromUtcDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function addDays(iso: string, days: number) {
  return fromUtcDate(new Date(toUtcDate(iso).getTime() + days * DAY));
}
export function daysBetween(range: DateRange) {
  return Math.round((toUtcDate(range.end).getTime() - toUtcDate(range.start).getTime()) / DAY) + 1;
}
function isValidIso(v: string | undefined): v is string {
  return !!v && ISO.test(v) && !Number.isNaN(toUtcDate(v).getTime());
}

export type ResolvedRange = {
  preset: RangePreset;
  compareMode: CompareMode;
  current: DateRange;
  previous: DateRange;
  days: number;
  label: string;
  compareLabel: string;
};

export function resolveRange(params: { range?: string; compare?: string; from?: string; to?: string }, now = new Date()): ResolvedRange {
  const today = jstToday(now);
  const yesterday = addDays(today, -1);
  const preset = (RANGE_PRESETS.some((p) => p.value === params.range) ? params.range : "28d") as RangePreset;
  const compareMode: CompareMode = params.compare === "yoy" ? "yoy" : "prev";

  let current: DateRange;
  switch (preset) {
    case "today":
      current = { start: today, end: today };
      break;
    case "yesterday":
      current = { start: yesterday, end: yesterday };
      break;
    case "7d":
    case "28d":
    case "30d":
    case "90d": {
      const n = Number(preset.replace("d", ""));
      current = { start: addDays(yesterday, -(n - 1)), end: yesterday };
      break;
    }
    case "ytd":
      current = { start: `${today.slice(0, 4)}-01-01`, end: today };
      break;
    case "custom": {
      if (isValidIso(params.from) && isValidIso(params.to)) {
        const [a, b] = params.from <= params.to ? [params.from, params.to] : [params.to, params.from];
        // 未来日は今日に丸める。極端に長い期間は外部APIの負荷になるので最大2年。
        const end = b > today ? today : b;
        const start = daysBetween({ start: a, end }) > 731 ? addDays(end, -730) : a;
        current = { start: start > end ? end : start, end };
      } else {
        current = { start: addDays(yesterday, -27), end: yesterday };
      }
      break;
    }
  }

  const days = daysBetween(current);
  const previous: DateRange =
    compareMode === "yoy"
      ? { start: shiftYear(current.start), end: shiftYear(current.end) }
      : { start: addDays(current.start, -days), end: addDays(current.start, -1) };

  const fmt = (iso: string) => iso.replaceAll("-", "/");
  const span = (r: DateRange) => (r.start === r.end ? fmt(r.start) : `${fmt(r.start)}〜${fmt(r.end)}`);

  return {
    preset,
    compareMode,
    current,
    previous,
    days,
    label: span(current),
    compareLabel: `${compareMode === "yoy" ? "前年同期" : "前期間"}（${span(previous)}）`,
  };
}

function shiftYear(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  // 2/29 は前年に無いので 2/28 に寄せる
  const last = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  return `${y - 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export function rangeCacheKey(r: ResolvedRange) {
  return `${r.current.start}_${r.current.end}:${r.previous.start}_${r.previous.end}`;
}
