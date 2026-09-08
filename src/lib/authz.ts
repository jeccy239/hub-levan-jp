import { auth } from "./auth";
import { prisma } from "./prisma";

export type SessionUser = { id: string; email: string; name?: string | null; role: string };

const APPROVER_ROLES = ["ADMIN", "MANAGER"];

/**
 * Every Server Action that mutates data must call this first. Relying on
 * the UI hiding a button is not access control — this is what actually
 * enforces it, since middleware only gates page navigation, not the
 * server actions a page's forms invoke.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("認証が必要です。再度ログインしてください。");
  }
  return session.user as SessionUser;
}

/**
 * The signed-in user as stored in the database, not as captured in the JWT.
 *
 * The session token keeps whatever name/email were current at login, so it
 * goes stale the moment someone edits their profile. Anything the user
 * actually sees or that goes out in their name — the sidebar, an email
 * signature — must read through here instead of trusting the token.
 */
export async function getCurrentUser() {
  const session = await requireUser();
  return prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { id: true, name: true, email: true, role: true },
  });
}

/** 差出人名。プロフィールで設定した表示名を常に最新で返す。 */
export async function getSenderName(): Promise<string> {
  const user = await getCurrentUser();
  return user.name || user.email;
}

/**
 * For actions with real consequences — approving spend, signing contracts,
 * publishing content, sending anything to a customer. STAFF can draft and
 * view but not approve.
 */
export async function requireApprover(): Promise<SessionUser> {
  const user = await requireUser();
  if (!APPROVER_ROLES.includes(user.role)) {
    throw new Error("この操作にはマネージャー以上の権限が必要です。");
  }
  return user;
}

/**
 * For irreversible, destructive actions — permanently deleting a customer's
 * account and data. Even a Manager can't do this; only Admin.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("この操作には管理者権限が必要です。");
  }
  return user;
}
