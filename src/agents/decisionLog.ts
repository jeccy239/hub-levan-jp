import { prisma } from "@/lib/prisma";
import type { LlmResult } from "./llm";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Every agent decision is written here, regardless of autonomy level.
 * This is what answers "why did the AI target this company / pick this
 * keyword / propose this upsell" after the fact.
 */
export async function logDecision(params: {
  agentName: string;
  targetType: string;
  targetId: string;
  leadId?: string;
  input: unknown;
  decision: string;
  reason: string;
  output: unknown;
  llm: LlmResult;
}) {
  return prisma.aiDecisionLog.create({
    data: {
      agentName: params.agentName,
      targetType: params.targetType,
      targetId: params.targetId,
      leadId: params.leadId,
      inputJson: params.input as Prisma.InputJsonValue,
      decision: params.decision,
      reason: params.reason,
      outputJson: params.output as Prisma.InputJsonValue,
      model: params.llm.model,
      tokensUsed: params.llm.tokensUsed,
      costUsd: params.llm.costUsd,
    },
  });
}
