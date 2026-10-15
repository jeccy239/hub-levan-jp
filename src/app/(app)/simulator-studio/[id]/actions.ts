"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { setSimulatorSecretPlan, SimulatorStudioApiError, SimulatorStudioNotConfiguredError } from "@/lib/simulator-studio";

export type SecretPlanState = { ok: boolean; message: string } | null;

/** シークレットプランの付与・解除 */
export async function toggleSecretPlan(_prev: SecretPlanState, formData: FormData): Promise<SecretPlanState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const enabled = formData.get("enabled") === "true";
  try {
    await setSimulatorSecretPlan(id, enabled);
    await logAudit({ userId: user.id, action: enabled ? "simulator_tenant.secret_plan.grant" : "simulator_tenant.secret_plan.revoke", targetType: "simulator_tenant", targetId: id });
    revalidatePath("/simulator-studio");
    revalidatePath(`/simulator-studio/${id}`);
    return { ok: true, message: enabled ? "シークレットプランを付与しました" : "シークレットプランを解除しました" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof SimulatorStudioApiError || e instanceof SimulatorStudioNotConfiguredError ? e.message : "予期しないエラーが発生しました。",
    };
  }
}
