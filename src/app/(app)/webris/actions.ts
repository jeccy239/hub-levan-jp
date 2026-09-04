"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireApprover } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { changeWebrisPlan, cancelWebrisSubscription, deleteWebrisOrganization } from "@/lib/webris";
import { prisma } from "@/lib/prisma";

export async function changePlanAction(formData: FormData) {
  const user = await requireApprover();
  const orgId = String(formData.get("orgId") ?? "");
  const planCode = String(formData.get("planCode") ?? "");
  if (!orgId || !planCode) return;

  await changeWebrisPlan(orgId, planCode);
  await logAudit({
    userId: user.id,
    action: "webris.plan_change",
    targetType: "webris_organization",
    targetId: orgId,
    detail: { planCode },
  });
  revalidatePath(`/webris/${orgId}`);
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
