"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  children?: { href: string; label: string }[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ダッシュボード" },
  { href: "/companies", label: "顧客管理" },
  { href: "/leads", label: "リード管理" },
  { href: "/projects", label: "案件管理" },
  { href: "/tasks", label: "タスク" },
  {
    href: "/webris",
    label: "WEBRIS（ウェブリス）",
    children: [
      { href: "/webris/dashboard", label: "ダッシュボード" },
      { href: "/webris", label: "顧客一覧" },
      { href: "/sales-ai", label: "WEBRIS メール管理" },
      { href: "/blog", label: "ブログ" },
      { href: "/webris/claude-usage", label: "Claude Console API" },
    ],
  },
];

/** 現在のパスに一致する子のうち、最も限定的なもの（hrefが最長）を選ぶ。
 *  "/webris" と "/webris/claude-usage" は前者が後者の接頭辞になるため、
 *  単純な startsWith だと両方が点灯してしまう。 */
function activeChildHref(pathname: string, children: { href: string }[]): string | null {
  const matches = children.filter(
    (c) => pathname === c.href || pathname.startsWith(c.href + "/"),
  );
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (b.href.length > a.href.length ? b : a)).href;
}

const linkClass = (isActive: boolean) =>
  `block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
      : "text-[var(--text-dim)] hover:bg-[var(--surface)]/60 hover:text-[var(--text)]"
  }`;

export default function Sidebar({
  user,
  onSignOut,
}: {
  user: { name?: string | null; email?: string | null } | null;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  // md未満では常設せず、上部バーのメニューボタンで開閉するドロワーにする。
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--line)] bg-[var(--surface-2)] px-4">
        <Link href="/" className="block">
          <Image src="/logo_blue_02.png" alt="LEVAN ビジネスOS" width={2000} height={512} className="h-7 w-auto" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="メニューを開く"
          aria-expanded={open}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)]"
        >
          メニュー
        </button>
      </div>
      {open && <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)} aria-hidden />}
      <aside
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={`w-60 shrink-0 h-screen flex flex-col border-r border-[var(--line)] bg-[var(--surface-2)] fixed inset-y-0 left-0 z-50 transition-transform md:sticky md:top-0 md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5">
          <Link href="/" className="block">
            <Image
              src="/logo_blue_02.png"
              alt="LEVAN ビジネスOS"
              width={2000}
              height={512}
              priority
              className="h-8 w-auto"
            />
          </Link>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const selfActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const activeChild = item.children ? activeChildHref(pathname, item.children) : null;
            const isGroupActive = selfActive || activeChild !== null;
            const isActive = item.href === "/" ? pathname === "/" : selfActive;

            if (!item.children) {
              return (
                <Link key={item.href} href={item.href} className={linkClass(isActive)}>
                  {item.label}
                </Link>
              );
            }

            return (
              <div key={item.href}>
                <div className={`px-3 pt-2 pb-1 text-xs font-medium ${isGroupActive ? "text-[var(--text)]" : "text-[var(--text-dim)]"}`}>
                  {item.label}
                </div>
                <div className="pl-2 space-y-0.5">
                  {item.children.map((child) => {
                    const isChildActive = activeChild === child.href;
                    return (
                      <Link key={child.href} href={child.href} className={linkClass(isChildActive)}>
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        {user && (
          <div className="px-3 py-4 border-t border-[var(--line)] space-y-1">
            <Link
              href="/settings/profile"
              className={`block rounded-xl px-3 py-2 transition-colors ${
                pathname === "/settings/profile" ? "bg-[var(--surface)] shadow-sm" : "hover:bg-[var(--surface)]/60"
              }`}
            >
              <span className="block text-sm font-medium text-[var(--text)] truncate">{user.name ?? user.email}</span>
              <span className="block text-[11px] text-[var(--text-dim)]">プロフィール設定</span>
            </Link>
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
    </>
  );
}
