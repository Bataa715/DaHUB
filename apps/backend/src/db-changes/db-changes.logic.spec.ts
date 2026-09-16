import { describe, it, expect } from "vitest";
import {
  dbChangeRowKey,
  isValidDateTime,
  normalizeDbChangeRow,
  sqlCommandOf,
  systemTypeOf,
  type DbChangeRowInput,
} from "./db-changes.logic";

describe("systemTypeOf", () => {
  it("эх кодын дүрэм", () => {
    expect(systemTypeOf("CARDZONE")).toBe("Картзоне");
    expect(systemTypeOf("toad")).toBe("Картзоне");
    expect(systemTypeOf("ECECUSER")).toBe("Интернэт банк");
    expect(systemTypeOf("TBAADM")).toBe("Кор систем");
    expect(systemTypeOf("")).toBe("Бусад");
    expect(systemTypeOf(null)).toBe("Бусад");
  });
});

describe("sqlCommandOf", () => {
  it("drop хамгийн түрүүнд шалгагдана", () => {
    expect(sqlCommandOf("DROP TABLE x")).toBe("drop");
    expect(sqlCommandOf("create table t as select ... drop")).toBe("drop");
    expect(sqlCommandOf("CREATE INDEX i")).toBe("create");
    expect(sqlCommandOf("update accounts set x=1")).toBe("update");
    expect(sqlCommandOf("DELETE FROM t")).toBe("delete");
    expect(sqlCommandOf("GRANT SELECT")).toBe("other");
    expect(sqlCommandOf(undefined)).toBe("other");
  });
});

const base: DbChangeRowInput = {
  actionTime: "2026-09-10 10:23:45",
  username: "dbadmin",
  machine: "GOLOMT\\PC01",
  action: "update",
  owner: "tbaadm",
  objectName: "GAM",
  domain: "golomt",
  sqlText: "UPDATE GAM SET x = 1",
  sourceDescription: "",
  jira: "",
};

describe("normalizeDbChangeRow / dbChangeRowKey", () => {
  it("action, owner том үсэгт; ижил үйлдэл нэг түлхүүртэй", () => {
    const a = normalizeDbChangeRow(base);
    const b = normalizeDbChangeRow({
      ...base,
      username: " DBADMIN ",
      action: "UPDATE",
      owner: "TBAADM",
    });
    expect(a.username).toBe("DBADMIN");
    expect(a.action).toBe("UPDATE");
    expect(a.owner).toBe("TBAADM");
    expect(dbChangeRowKey(a)).toBe(dbChangeRowKey(b));
  });

  it("SQL текст өөр бол өөр түлхүүр", () => {
    const a = normalizeDbChangeRow(base);
    const b = normalizeDbChangeRow({
      ...base,
      sqlText: "UPDATE GAM SET x = 2",
    });
    expect(dbChangeRowKey(a)).not.toBe(dbChangeRowKey(b));
  });
});

describe("isValidDateTime", () => {
  it("бодит огноо, цаг", () => {
    expect(isValidDateTime("2026-09-10 10:23:45")).toBe(true);
    expect(isValidDateTime("2026-09-10 24:00:00")).toBe(false);
    expect(isValidDateTime("2026-02-30 00:00:00")).toBe(false);
    expect(isValidDateTime("2026-09-10")).toBe(false);
  });
});
