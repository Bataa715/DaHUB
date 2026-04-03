import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private baseUrl: string;
  private model: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      "OLLAMA_BASE_URL",
      "http://localhost:11434",
    );
    this.model = this.configService.get<string>("OLLAMA_MODEL", "llama3");
  }

  async generate(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
            num_predict: 2048,
            num_ctx: 4096,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!response.ok)
        throw new Error(`Ollama хариу алдаатай: ${response.status}`);

      const data = await response.json();
      return data.response;
    } catch (error: any) {
      clearTimeout(timeout);
      this.logger.error(`Ollama алдаа: ${error.message}`);
      throw new Error(
        "LLM модельтой холбогдож чадсангүй. Ollama ажиллаж байгаа эсэхийг шалгана уу.",
      );
    }
  }

  async generateStream(
    prompt: string,
    onToken: (token: string) => void,
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: true,
          options: {
            temperature: 0.3,
            top_p: 0.9,
            num_predict: 2048,
            num_ctx: 4096,
          },
        }),
      });

      if (!response.ok)
        throw new Error(`Ollama хариу алдаатай: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream уншигч олдсонгүй");

      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.response) {
              fullResponse += json.response;
              onToken(json.response);
            }
          } catch {
            // skip
          }
        }
      }

      return fullResponse;
    } catch (error: any) {
      this.logger.error(`Ollama stream алдаа: ${error.message}`);
      throw new Error(
        "LLM модельтой холбогдож чадсангүй. Ollama ажиллаж байгаа эсэхийг шалгана уу.",
      );
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch {
      return [];
    }
  }
}
