"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireApprover } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import {
  changeWebrisPlan,
  cancelWebrisSubscription,
  deleteWebrisOrganization,
  WebrisApiError,
  WebrisNotConfiguredError,
} from "@/lib/webris";
import { prisma } from "@/lib/prisma";

export async function changePlanAction(formData: FormData) {
  const user = await requireApprover();
  const orgId = String(formData.get("orgId") ?? "");
  const planCode = String(formData.get("planCode") ?? "");
  if (!orgId || !planCode) return;

  try {
    await changeWebrisPlan(orgId, planCode);
  } catch (e) {
    // WEBRIS 側が未知のプランコードを弾いた等。500 で画面を落とさず、
    // 詳細画面にエラー内容を表示して戻す。
    const message =
      e instanceof WebrisApiError || e instanceof WebrisNotConfiguredError
        ? e.message
        : "プラン変更に失敗しました。";
    revalidatePath(`/webris/${orgId}`);
    redirect(`/webris/${orgId}?planError=${encodeURIComponent(message)}`);
  }

  await logAudit({
    userId: user.id,
    action: "webris.plan_change",
    targetType: "webris_organization",
    targetId: orgId,
    detail: { planCode },
  });
  revalidatePath(`/webris/${orgId}`);
  redirect(`/webris/${orgId}?planOk=1`);
}

export async function cancelSubscriptionAction(formData: FormData) {
  const user = await requireApprover();
  const orgId = String(formData.get("orgId") ?? "");
  if (!orgId) return;

  await cancelWebrisSubscription(orgId);
  await logAudit({
    userId: user.id,
    action: "webris.cancel",
    targetType: "webris_organization",
    targetId: orgId,
  });
  revalidatePath(`/webris/${orgId}`);
}

export async function deleteAccountAction(formData: FormData) {
  const user = await requireAdmin();
  const orgId = String(formData.get("orgId") ?? "");
  const confirmName = String(formData.get("confirmName") ?? "");
  if (!orgId || !confirmName) return;

  await deleteWebrisOrganization(orgId, confirmName);

  // The org no longer exists — drop any stale link to it so the Company
  // detail page shows the "not linked" picker instead of a dead reference.
  await prisma.company.updateMany({
    where: { webrisOrganizationId: orgId },
    data: { webrisOrganizationId: null },
  });

  await logAudit({
    userId: user.id,
    action: "webris.delete_account",
    targetType: "webris_organization",
    targetId: orgId,
    detail: { confirmName },
  });

  revalidatePath("/webris");
  redirect("/webris");
}
