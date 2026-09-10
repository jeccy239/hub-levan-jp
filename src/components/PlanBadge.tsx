import { WEBRIS_PLAN_LABEL } from "@/lib/webris";

// プランごとのイメージカラー。
//   Free → グレー / Standard → ブルー / Pro → ゴールド / Business → シルバー / Secret → パープル
const PLAN_STYLE: Record<string, string> = {
  free: "bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--line)]",
  standard: "bg-[var(--accent-tint)] text-[var(--accent-strong)] border-[var(--accent)]/25",
  pro: "bg-[var(--gold-tint)] text-[var(--gold)] border-[var(--gold)]/30",
  business: "bg-[#eef0f2] text-[#5b636b] border-[#c9ced3] dark:bg-[#2a2d31] dark:text-[#c3c9cf] dark:border-[#3c4045]",
  secret: "bg-[#f4e9ff] text-[#7c3aed] border-[#7c3aed]/30 dark:bg-[#2c2240] dark:text-[#c4a6ff] dark:border-[#7c3aed]/40",
};

const FALLBACK = "bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--line)]";

export default function PlanBadge({
  code,
  label,
  className = "",
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  const text = label ?? WEBRIS_PLAN_LABEL[code] ?? code;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        PLAN_STYLE[code] ?? FALLBACK
      } ${className}`}
    >
      {text}
    </span>
  );
}
