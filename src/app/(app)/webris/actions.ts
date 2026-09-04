"use server";

import { revalidatePath } from "next/cache";
import { requireApprover } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { changeWebrisPlan, cancelWebrisSubscription } from "@/lib/webris";

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
