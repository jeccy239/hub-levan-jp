import { auth } from "./auth";

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
