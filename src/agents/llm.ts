import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";
// Sonnet 5 list price: $2.00 / $10.00 per 1M tokens. Used for cost-ledger
// estimates only. These were carrying Sonnet 4.6's $3/$15, which overstated
// every recorded cost by 50%.
const COST_PER_1K_INPUT = 0.002;
const COST_PER_1K_OUTPUT = 0.01;

export type LlmResult = {
  text: string;
  model: string;
  tokensUsed: number;
  costUsd: number;
};

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Every agent routes its model calls through here so token/cost accounting
 * stays in one place. Without ANTHROPIC_API_KEY set, returns a deterministic
 * stub so the Phase 1 flow (scoring, drafting, approval) is fully testable
 * without spending real API credits.
 */
export async function callLlm(params: {
  system: string;
  prompt: string;
  stubResponse: string;
  maxTokens?: number;
}): Promise<LlmResult> {
  const anthropic = getClient();

  if (!anthropic) {
    const stubTokens = Math.ceil((params.system.length + params.prompt.length) / 4);
    return {
      text: params.stubResponse,
      model: "stub",
      tokensUsed: stubTokens,
      costUsd: 0,
    };
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const tokensUsed = inputTokens + outputTokens;
  const costUsd =
    (inputTokens / 1000) * COST_PER_1K_INPUT + (outputTokens / 1000) * COST_PER_1K_OUTPUT;

  return { text, model: MODEL, tokensUsed, costUsd };
}
