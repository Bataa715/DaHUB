import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

const TOGETHER_URL = "https://api.together.xyz/v1/chat/completions";
/** Эх скриптийн ашигладаг загвар — `TOGETHER_MODEL`-оор солино */
const DEFAULT_MODEL = "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo";
const TIMEOUT_MS = 120_000;

/**
 * Together AI (гадны үйлчилгээ) — сөрөг мэдээний ойролцоо утгатай мэдээг сонгуулна.
 *
 * [SEC] Мэдээний агуулга банкны сүлжээнээс ГАДАГШ илгээгддэг. Хэрэглэгчийн
 * шийдвэрээр өмнөх систем шиг ашиглана; хүсэлт бүрийг audit log-д бичнэ
 * (controller). Түлхүүр зөвхөн `TOGETHER_API_KEY` орчны хувьсагчид — кодонд
 * бичихгүй, логт гаргахгүй. Хувьсагч хоосон бол боломж идэвхгүй.
 */
@Injectable()
export class NegativeNewsAiService {
  private readonly logger = new Logger(NegativeNewsAiService.name);

  get model(): string {
    return process.env.TOGETHER_MODEL?.trim() || DEFAULT_MODEL;
  }

  async complete(message: string): Promise<string> {
    const apiKey = process.env.TOGETHER_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "AI шинжилгээ тохируулагдаагүй байна (TOGETHER_API_KEY)",
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(TOGETHER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        // Эх скриптийн параметрүүд (stream-гүй — хариуг нэг дор авна)
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: message }],
          max_tokens: 1024,
          temperature: 0,
          top_p: 1.0,
          top_k: 100,
          repetition_penalty: 1,
          stop: ["<|eot_id|>", "<|eom_id|>"],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Агуулга/түлхүүр логт гаргахгүй — зөвхөн төлөв
        this.logger.error(`Together API алдаа: HTTP ${res.status}`);
        throw new BadGatewayException(
          res.status === 401
            ? "AI үйлчилгээний түлхүүр буруу байна"
            : "AI үйлчилгээ хариу өгсөнгүй",
        );
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content ?? "";
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Together API-д холбогдож чадсангүй: ${(error as Error)?.name ?? "error"}`,
      );
      throw new BadGatewayException(
        "AI үйлчилгээнд холбогдож чадсангүй (сервер интернэтэд гарах эрхтэй эсэхийг шалгана уу)",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
