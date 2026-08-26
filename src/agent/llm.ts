import { GoogleGenAI } from "@google/genai";
import type { Content, Part } from "@google/genai";
import { AGENT_TOOLS, executeTool } from "./tools.js";

export interface GeminiContent {
  readonly role: "user" | "model";
  readonly parts: ReadonlyArray<
    | { readonly text: string }
    | { readonly functionCall: { name: string; args: Record<string, unknown> } }
    | {
        readonly functionResponse: {
          name: string;
          response: Record<string, unknown>;
        };
      }
  >;
}

export interface GeminiLoopResult {
  readonly text: string;
  readonly toolCalls: Array<{
    readonly name: string;
    readonly args: Record<string, unknown>;
    readonly result: unknown;
  }>;
  readonly proposalArgs:
    | {
        warrantId: string;
        agentId: string;
        merchantId: string;
        sku: string;
        category: string;
        amountMinorUnits: number;
      }
    | undefined;
}

export function geminiApiKey(): string | undefined {
  return process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_API_KEY"] ?? undefined;
}

const MAX_TOOL_ITERATIONS = 8;

/**
 * Runs a Gemini function-calling loop against the agent tools.
 * Terminates when the model produces a final text answer or invokes
 * `create_transaction_proposal` (the terminal proposer action).
 */
export async function runGeminiProposer(
  systemInstruction: string,
  contents: GeminiContent[],
): Promise<GeminiLoopResult> {
  const apiKey = geminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env["GEMINI_MODEL"] ?? "gemini-3.6-flash";

  // Model turns are echoed back verbatim (including thought signatures) —
  // Gemini 3.x rejects follow-up function responses otherwise.
  const workingContents: Content[] = contents.map((c) => ({
    role: c.role,
    parts: [...c.parts] as Part[],
  }));
  const toolCalls: GeminiLoopResult["toolCalls"] = [];
  let text = "";
  let proposalArgs: GeminiLoopResult["proposalArgs"];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await ai.models.generateContent({
      model,
      contents: workingContents,
      config: {
        systemInstruction,
        temperature: 0.2,
        tools: [
          {
            functionDeclarations: AGENT_TOOLS.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            })),
          },
        ],
      },
    });

    const candidateParts: Part[] = response.candidates?.[0]?.content?.parts ?? [];
    const candidateText = candidateParts
      .map((part) => part.text)
      .filter((t): t is string => typeof t === "string")
      .join("");
    const callParts = candidateParts.filter((part) => part.functionCall);

    if (callParts.length === 0) {
      text = candidateText || text;
      break;
    }
    if (candidateText) text = candidateText;

    workingContents.push({ role: "model", parts: candidateParts });

    const responseParts: Part[] = [];
    for (const part of callParts) {
      const name = part.functionCall?.name ?? "";
      const args = (part.functionCall?.args ?? {}) as Record<string, unknown>;

      if (name === "create_transaction_proposal") {
        proposalArgs = {
          warrantId: String(args["warrantId"] ?? ""),
          agentId: String(args["agentId"] ?? ""),
          merchantId: String(args["merchantId"] ?? ""),
          sku: String(args["sku"] ?? ""),
          category: String(args["category"] ?? ""),
          amountMinorUnits: Number(args["amountMinorUnits"] ?? NaN),
        };
        toolCalls.push({ name, args, result: { accepted: true } });
        // Terminal proposer action: the policy engine owns authorization.
        return { text, toolCalls, proposalArgs };
      }

      const result = executeTool(name, args);
      toolCalls.push({ name, args, result });
      responseParts.push({
        functionResponse: { name, response: result as Record<string, unknown> },
      });
    }

    workingContents.push({ role: "user", parts: responseParts });
  }

  return { text, toolCalls, proposalArgs };
}
