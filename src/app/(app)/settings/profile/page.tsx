import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { USER_ROLE_LABEL } from "@/lib/labels";
import ProfileForm from "./ProfileForm";
import PasswordForm from "./PasswordForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireUser();
  // セッション（JWT）ではなくDBを正とする。表示名を変えた直後でも
  // 古い値が出ないようにするため。
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { name: true, email: true, role: true, createdAt: true, passwordHash: true },
  });

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">プロフィール設定</h1>
        <p className="text-[var(--text-dim)] mt-1 text-sm">
          表示名は営業メールの差出人（{"{{sender}}"}）と署名に使われます。
        </p>
      </header>

      <ProfileForm name={user.name} email={user.email} />

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm p-5">
        <h2 className="text-sm font-semibold text-[var(--text)]">アカウント情報</h2>
        <dl className="mt-3 space-y-2.5 text-sm">
          <div className="flex justify-between items-center">
            <dt className="text-[var(--text-dim)]">権限</dt>
            <dd className="text-[var(--text)]">
              {USER_ROLE_LABEL[user.role] ?? user.role}
              <span className="ml-2 text-xs text-[var(--text-dim)]">（変更は管理者のみ）</span>
            </dd>
          </div>
          <div className="flex justify-between items-center">
            <dt className="text-[var(--text-dim)]">登録日</dt>
            <dd className="text-[var(--text)]">{user.createdAt.toLocaleDateString("ja-JP")}</dd>
          </div>
        </dl>
      </section>

      {user.passwordHash && <PasswordForm />}
    </div>
  );
}
