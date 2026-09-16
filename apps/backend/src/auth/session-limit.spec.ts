import { describe, expect, it } from "vitest";
import {
  MAX_SESSION_SECONDS,
  buildRefreshToken,
  isSessionExpired,
  sessionStartOf,
} from "./session-limit";

describe("session-limit", () => {
  const now = 1_800_000_000;

  it("token-д эхлэх агшин хадгалагдаж, буцаад уншигдана", () => {
    const token = buildRefreshToken(now - 100);
    expect(token).toMatch(/^[0-9a-f-]{36}\.\d+$/);
    expect(sessionStartOf(token, now)).toBe(now - 100);
  });

  it("хуучин (цэггүй) token → одоогоос эхэлнэ", () => {
    expect(sessionStartOf("3f1c2d4e-0000-4000-8000-000000000000", now)).toBe(
      now,
    );
  });

  it("буруу эсвэл ирээдүйн эхлэх хугацааг хүлээж авахгүй", () => {
    expect(sessionStartOf("abc.notanumber", now)).toBe(now);
    expect(sessionStartOf(`abc.${now + 3600}`, now)).toBe(now);
  });

  it("12 цаг хэтэрвэл дууссан", () => {
    expect(isSessionExpired(now - MAX_SESSION_SECONDS, now)).toBe(false);
    expect(isSessionExpired(now - MAX_SESSION_SECONDS - 1, now)).toBe(true);
  });
});
