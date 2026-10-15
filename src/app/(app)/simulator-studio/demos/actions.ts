"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { createSimulatorDemo, deleteSimulatorDemo, SimulatorStudioApiError, SimulatorStudioNotConfiguredError } from "@/lib/simulator-studio";

export type DemoFormState = { ok: boolean; message: string } | null;

const errorMessage = (e: unknown) =>
  e instanceof SimulatorStudioApiError || e instanceof SimulatorStudioNotConfiguredError ? e.message : "予期しないエラーが発生しました。";

/** デモページを作る。URL・店舗名が空ならテーマ名から決める */
export async function createDemo(_prev: DemoFormState, formData: FormData): Promise<DemoFormState> {
  const user = await requireUser();
  const themeId = String(formData.get("themeId") ?? "");
  const sourceTenantId = String(formData.get("sourceTenantId") ?? "");
  const themeLabel = String(formData.get("themeLabel") ?? themeId);
  const slug = String(formData.get("slug") ?? "").trim() || `${themeId.toLowerCase().replace(/_/g, "-")}-demo`;
  const name = String(formData.get("name") ?? "").trim() || `${themeLabel} DEMO`;
  if (!themeId || !sourceTenantId) return { ok: false, message: "テーマとコピー元の店舗を選んでください。" };
  try {
    const demo = await createSimulatorDemo({ themeId, sourceTenantId, slug, name });
    await logAudit({ userId: user.id, action: "simulator_demo.create", targetType: "simulator_demo", targetId: demo.id });
    revalidatePath("/simulator-studio/demos");
    return { ok: true, message: `「${name}」を作成しました（${demo.publicUrl}）` };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
}

export async function deleteDemo(_prev: DemoFormState, formData: FormData): Promise<DemoFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  try {
    await deleteSimulatorDemo(id);
    await logAudit({ userId: user.id, action: "simulator_demo.delete", targetType: "simulator_demo", targetId: id });
    revalidatePath("/simulator-studio/demos");
    return { ok: true, message: "削除しました" };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
}
