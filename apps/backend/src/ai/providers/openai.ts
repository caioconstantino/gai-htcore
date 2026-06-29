import OpenAI from "openai";
import type { AIProvider, ChatResult, ChatMessage } from "../types.js";
import { logger } from "../../lib/logger.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class OpenAIProvider implements AIProvider {
  constructor(private model: string = "gpt-4o-mini") {}

  async chat(input: {
    systemPrompt: string;
    history: ChatMessage[];
    userMessage: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<ChatResult> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: input.systemPrompt },
      ...input.history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: input.userMessage },
    ];

    try {
      const completion = await client.chat.completions.create({
        model: this.model,
        messages,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 1024,
      });

      const response = completion.choices[0]?.message?.content ?? "";
      const tokensIn = completion.usage?.prompt_tokens ?? 0;
      const tokensOut = completion.usage?.completion_tokens ?? 0;

      return { response, tokensIn, tokensOut };
    } catch (err) {
      logger.error("OpenAI chat error", err);
      throw err;
    }
  }
}
