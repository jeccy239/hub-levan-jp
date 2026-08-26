import { prisma } from "./prisma";

export async function logAudit(params: {
  userId: string;
  action: string;
  targetType: string;
  targetId: string;
  detail?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      detail: params.detail as never,
    },
  });
}
