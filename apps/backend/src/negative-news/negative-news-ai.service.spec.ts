import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadGatewayException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { NegativeNewsAiService } from "./negative-news-ai.service";

/**
 * Together AI дуудлага — жинхэнэ сүлжээнд гарахгүй (fetch mock).
 * Түлхүүр байхгүй, буруу, сүлжээ тасарсан үед хэрэглэгчид ойлгомжтой алдаа
 * өгч, түлхүүр/агуулгыг задруулахгүй байх ёстой.
 */
describe("NegativeNewsAiService", () => {
  const env = { ...process.env };

  beforeEach(() => {
    delete process.env.TOGETHER_API_KEY;
    delete process.env.TOGETHER_MODEL;
  });

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it("түлхүүргүй бол 503, гадагш дуудахгүй", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      new NegativeNewsAiService().complete("x"),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("эх скриптийн параметрүүдээр илгээж, хариуны текстийг буцаана", async () => {
    process.env.TOGETHER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "1. Мэдээ" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const svc = new NegativeNewsAiService();
    await expect(svc.complete("мэдээ\n\nдаалгавар")).resolves.toBe("1. Мэдээ");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.together.xyz/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
      messages: [{ role: "user", content: "мэдээ\n\nдаалгавар" }],
      max_tokens: 1024,
      temperature: 0,
      top_k: 100,
    });
  });

  it("TOGETHER_MODEL-оор загвар солигдоно", () => {
    process.env.TOGETHER_MODEL = "other/model";
    expect(new NegativeNewsAiService().model).toBe("other/model");
  });

  it("401 бол түлхүүр буруу гэсэн 502", async () => {
    process.env.TOGETHER_API_KEY = "bad";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    );
    const err = await new NegativeNewsAiService().complete("x").catch((e) => e);
    expect(err).toBeInstanceOf(BadGatewayException);
    expect(err.message).toContain("түлхүүр");
  });

  it("сүлжээ тасарвал 502", async () => {
    process.env.TOGETHER_API_KEY = "k";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    await expect(
      new NegativeNewsAiService().complete("x"),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
