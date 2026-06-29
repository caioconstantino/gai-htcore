export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResult {
  response: string;
  tokensIn: number;
  tokensOut: number;
}

export interface AIProvider {
  chat(input: {
    systemPrompt: string;
    history: ChatMessage[];
    userMessage: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<ChatResult>;
}
