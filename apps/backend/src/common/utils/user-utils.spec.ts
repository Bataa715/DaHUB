import { describe, it, expect } from "vitest";
import {
  isDirectorPosition,
  isPrivilegedUser,
  safeParseTools,
  buildUsersTableRow,
  buildUserId,
} from "./user-utils";

describe("isDirectorPosition", () => {
  it("detects захирал in any casing", () => {
    expect(isDirectorPosition("Ерөнхий Захирал")).toBe(true);
    expect(isDirectorPosition("захирал")).toBe(true);
  });
  it("is false for non-directors and empty", () => {
    expect(isDirectorPosition("Аудитор")).toBe(false);
    expect(isDirectorPosition(undefined)).toBe(false);
    expect(isDirectorPosition("")).toBe(false);
  });
});

describe("isPrivilegedUser", () => {
  it("treats ClickHouse UInt8 1 (number or string) as privileged", () => {
    expect(isPrivilegedUser({ isAdmin: 1 })).toBe(true);
    expect(isPrivilegedUser({ isSuperAdmin: "1" })).toBe(true);
    expect(isPrivilegedUser({ isAdmin: 1, isSuperAdmin: 0 })).toBe(true);
  });
  it("is false for plain users", () => {
    expect(isPrivilegedUser({ isAdmin: 0, isSuperAdmin: 0 })).toBe(false);
    expect(isPrivilegedUser({})).toBe(false);
  });
});

describe("safeParseTools", () => {
  it("parses a JSON string column into an array", () => {
    expect(safeParseTools('["a","b"]')).toEqual(["a", "b"]);
  });
  it("passes through an existing array", () => {
    expect(safeParseTools(["x"])).toEqual(["x"]);
  });
  it("returns [] for null, empty, or corrupt JSON", () => {
    expect(safeParseTools(null)).toEqual([]);
    expect(safeParseTools("")).toEqual([]);
    expect(safeParseTools("{not json")).toEqual([]);
    expect(safeParseTools('{"a":1}')).toEqual([]); // object, not array
  });
});

describe("buildUsersTableRow (lockout-state carry-forward)", () => {
  const existing = {
    id: "u1",
    userId: "DAG-MTAH-Bataa",
    password: "hash",
    name: "Bataa",
    isAdmin: 0,
    isSuperAdmin: 0,
    isActive: 1,
    isLocked: 1,
    failedLoginCount: 4,
    allowedTools: '["risk_assessment"]',
    createdAt: "2026-01-01 00:00:00",
  };

  it("carries forward isLocked / failedLoginCount on an unrelated edit", () => {
    // An admin renaming someone must NOT silently wipe brute-force lockout state.
    const row = buildUsersTableRow(existing, { name: "Bataa Renamed" });
    expect(row.isLocked).toBe(1);
    expect(row.failedLoginCount).toBe(4);
    expect(row.name).toBe("Bataa Renamed");
  });

  it("lets an explicit override clear lockout (admin unlock)", () => {
    const row = buildUsersTableRow(existing, { isLocked: 0, failedLoginCount: 0 });
    expect(row.isLocked).toBe(0);
    expect(row.failedLoginCount).toBe(0);
  });

  it("defaults isActive to 1 only when absent, never coerces an explicit 0", () => {
    expect(buildUsersTableRow({ id: "x" }).isActive).toBe(1);
    expect(buildUsersTableRow({ id: "x", isActive: 0 }).isActive).toBe(0);
  });

  it("keeps allowedTools as a JSON string", () => {
    const row = buildUsersTableRow(existing);
    expect(row.allowedTools).toBe('["risk_assessment"]');
  });
});

describe("buildUserId", () => {
  it("is deterministic and strips spaces from the name part", () => {
    const a = buildUserId("Мэдээллийн технологи", "bat myagmar", "MTAH", "Аудитор");
    const b = buildUserId("Мэдээллийн технологи", "bat myagmar", "MTAH", "Аудитор");
    expect(a).toBe(b);
    expect(a).not.toContain(" ");
  });
  it("uses the director format for захирал positions", () => {
    const director = buildUserId("Удирдлага", "Bilegzaya", "MTAH", "Захирал");
    expect(director.startsWith(".")).toBe(true);
  });
});
