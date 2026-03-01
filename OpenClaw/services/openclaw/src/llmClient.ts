import type { HttpClient } from "./clients";
import type { OpenClawConfig } from "./config";

type ChatRole = "system" | "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

export class LlmClient {
  constructor(
    private readonly config: OpenClawConfig,
    private readonly httpClient: HttpClient,
  ) {}

  async complete(messages: ChatMessage[], temperature: number): Promise<string> {
    const response = await this.httpClient.postJson<ChatCompletionsResponse>(
      `${this.config.llmBaseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        model: this.config.llmModel,
        temperature,
        messages,
      },
      {
        authorization: `Bearer ${this.config.llmApiKey}`,
      },
    );

    const first = response.choices?.[0]?.message?.content;
    if (typeof first === "string") {
      return first;
    }

    if (Array.isArray(first)) {
      return first
        .map((part) => part.text ?? "")
        .join("")
        .trim();
    }

    return "";
  }
}

