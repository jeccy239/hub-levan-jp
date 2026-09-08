import Sidebar from "@/components/Sidebar";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // 表示名はDBを正とする。JWTはログイン時の値のままなので、プロフィールを
  // 変更しても再ログインするまで古い名前が出てしまう。
  const user = session?.user?.id
    ? await prisma.user
        .findUnique({ where: { id: session.user.id }, select: { name: true, email: true } })
        .catch(() => null)
    : null;

  return (
    <div className="min-h-full flex bg-[var(--bg)] text-[var(--text)]">
      <Sidebar
        user={user ?? session?.user ?? null}
        onSignOut={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
