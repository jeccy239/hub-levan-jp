"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "ダッシュボード" },
  { href: "/companies", label: "顧客管理" },
  { href: "/leads", label: "リード管理" },
  { href: "/projects", label: "案件管理" },
  { href: "/tasks", label: "タスク" },
  { href: "/webris", label: "WEBRIS顧客" },
];

export default function Sidebar({
  user,
  onSignOut,
}: {
  user: { name?: string | null; email?: string | null } | null;
  onSignOut: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col border-r border-[var(--line)] bg-[var(--surface-2)]">
      <div className="px-5 py-5">
        <Link href="/" className="font-semibold tracking-tight text-[var(--text)]">
          LEVAN <span className="text-[var(--text-dim)] font-normal">ビジネスOS</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-dim)] hover:bg-[var(--surface)]/60 hover:text-[var(--text)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {user && (
        <div className="px-3 py-4 border-t border-[var(--line)] space-y-2">
          <div className="px-3 text-xs text-[var(--text-dim)] truncate">{user.name ?? user.email}</div>
          <form action={onSignOut}>
            <button
              type="submit"
              className="w-full text-left rounded-xl px-3 py-2 text-sm font-medium text-[var(--text-dim)] hover:bg-[var(--surface)]/60 hover:text-[var(--text)]"
            >
              ログアウト
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
