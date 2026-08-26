import Sidebar from "@/components/Sidebar";
import { auth, signOut } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-full flex bg-[var(--bg)] text-[var(--text)]">
      <Sidebar
        user={session?.user ?? null}
        onSignOut={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
