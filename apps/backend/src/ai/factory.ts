import { OpenAIProvider } from "./providers/openai.js";
import type { AIProvider } from "./types.js";

export class AIProviderFactory {
  static create(provider: string, model: string): AIProvider {
    switch (provider) {
      case "openai":
        return new OpenAIProvider(model);
      // Futuros providers: gemini, claude, vertex
      default:
        return new OpenAIProvider(model);
    }
  }
}
