"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { logAudit } from "@/lib/audit";

const MIN_PASSWORD_LENGTH = 8;

export async function updateProfileAction(formData: FormData) {
  const session = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!name) return { ok: false as const, error: "表示名を入力してください。" };
  if (name.length > 60) return { ok: false as const, error: "表示名は60文字以内で入力してください。" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "メールアドレスの形式が正しくありません。" };
  }

  // メールアドレスはログインIDでもあるため、他ユーザーとの重複を防ぐ
  const conflict = await prisma.user.findFirst({
    where: { email, id: { not: session.id } },
    select: { id: true },
  });
  if (conflict) return { ok: false as const, error: "そのメールアドレスは既に他のユーザーが使用しています。" };

  const before = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { name: true, email: true },
  });

  // role はここでは絶対に更新しない。自分で自分を昇格できてしまうため。
  await prisma.user.update({ where: { id: session.id }, data: { name, email } });

  await logAudit({
    userId: session.id,
    action: "user.profile_update",
    targetType: "user",
    targetId: session.id,
    detail: { before, after: { name, email } },
  });

  revalidatePath("/settings/profile");
  revalidatePath("/", "layout"); // サイドバーの表示名を更新する
  return { ok: true as const, emailChanged: before.email !== email };
}

export async function changePasswordAction(formData: FormData) {
  const session = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < MIN_PASSWORD_LENGTH) {
    return { ok: false as const, error: `新しいパスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください。` };
  }
  if (next !== confirm) return { ok: false as const, error: "確認用パスワードが一致しません。" };

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { passwordHash: true },
  });
  if (!user.passwordHash) {
    return { ok: false as const, error: "このアカウントにはパスワードが設定されていません。管理者にお問い合わせください。" };
  }

  // 現在のパスワードを必ず確認する。セッションを奪われた場合に、
  // 乗っ取り側がパスワードを変更して締め出すのを防ぐため。
  const valid = await bcrypt.compare(current, user.passwordHash);
  if (!valid) return { ok: false as const, error: "現在のパスワードが正しくありません。" };

  await prisma.user.update({
    where: { id: session.id },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });

  await logAudit({
    userId: session.id,
    action: "user.password_change",
    targetType: "user",
    targetId: session.id,
  });

  return { ok: true as const };
}
