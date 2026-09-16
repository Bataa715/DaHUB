import { describe, expect, it } from "vitest";
import { parseTimestamp } from "./parse-db-excel";

describe("parseTimestamp", () => {
  it("Excel огноо (UTC) — цагийг хэвээр нь", () => {
    expect(parseTimestamp(new Date(Date.UTC(2026, 8, 10, 14, 5, 9)))).toBe(
      "2026-09-10 14:05:09",
    );
  });

  it("Excel serial тоо", () => {
    // 46275 = 2026-09-10, 0.5 = 12:00
    expect(parseTimestamp(46275.5)).toBe("2026-09-10 12:00:00");
    expect(parseTimestamp(12)).toBe("");
  });

  it("ISO текст", () => {
    expect(parseTimestamp("2026-09-10 08:30:00")).toBe("2026-09-10 08:30:00");
    expect(parseTimestamp("2026-09-10T08:30")).toBe("2026-09-10 08:30:00");
    expect(parseTimestamp("2026/9/1")).toBe("2026-09-01 00:00:00");
  });

  it("Oracle хэлбэр", () => {
    expect(parseTimestamp("10-SEP-26")).toBe("2026-09-10 00:00:00");
    expect(parseTimestamp("10-Sep-26 10.23.45.000000 PM")).toBe(
      "2026-09-10 22:23:45",
    );
    expect(parseTimestamp("01-JAN-2026 12:00:00 AM")).toBe(
      "2026-01-01 00:00:00",
    );
  });

  it("M/D/YYYY хэлбэр", () => {
    expect(parseTimestamp("9/10/2026 1:05 PM")).toBe("2026-09-10 13:05:00");
  });

  it("буруу утга хоосон", () => {
    expect(parseTimestamp("2026-02-30")).toBe("");
    expect(parseTimestamp("31-FOO-26")).toBe("");
    expect(parseTimestamp("abc")).toBe("");
    expect(parseTimestamp(null)).toBe("");
  });
});
