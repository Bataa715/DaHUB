import { describe, it, expect } from "vitest";
import {
  analyzeConfigRisk,
  classifyXdr,
  normalizeXdrStatus,
  normalizeXdrText,
  parseDetailXml,
  statusIndicatesCompleted,
} from "./network-risk";

/**
 * Эрсдэлийн дүрмүүд нь өмнөх Django системийн (risk_analyzer.py,
 * xdr_classifier.py) логиктой яг ижил байх ёстой — аудитын үр дүн
 * систем солигдсоноос болж өөрчлөгдөхгүй.
 */
describe("analyzeConfigRisk", () => {
  it("any-any allow бодлого → Critical", () => {
    const r = analyzeConfigRisk({
      path: "/config/devices/entry/vsys/entry/rulebase/security/rules",
      cmd: "set",
      afterValue: "source any destination any action allow",
    });
    expect(r).toEqual({ level: "Critical", score: 90, rule: "any_any_allow" });
  });

  it("Critical нь High-ээс түрүүлж шалгагдана", () => {
    // snmp (High) ба ssh untrusted (Critical) хоёулаа таарна
    const r = analyzeConfigRisk({
      path: "snmp v2 community",
      afterValue: "ssh untrusted",
    });
    expect(r.level).toBe("Critical");
  });

  it("SNMP v2 → High", () => {
    expect(
      analyzeConfigRisk({ path: "deviceconfig/system/snmp-setting v2c" }).level,
    ).toBe("High");
  });

  it("логийг идэвхгүй болгох → High", () => {
    const r = analyzeConfigRisk({ cmd: "edit", afterValue: "syslog disable" });
    expect(r).toMatchObject({ level: "High", rule: "logging_disabled" });
  });

  it("HA синк алдагдсан → Medium", () => {
    expect(analyzeConfigRisk({ detail: "ha unsync detected" }).level).toBe(
      "Medium",
    );
  });

  it("энгийн өөрчлөлт → Low, дүрэмгүй", () => {
    expect(
      analyzeConfigRisk({ path: "/config/shared/address", cmd: "edit" }),
    ).toEqual({
      level: "Low",
      score: 20,
      rule: null,
    });
  });

  it("том жижиг үсэг хамаарахгүй", () => {
    expect(analyzeConfigRisk({ afterValue: "SUPERUSER" }).level).toBe(
      "Critical",
    );
  });

  it("хоосон оролт унагахгүй", () => {
    expect(analyzeConfigRisk({}).level).toBe("Low");
  });
});

describe("parseDetailXml", () => {
  it("before/after CDATA-г гаргана", () => {
    const xml =
      "<detail><before><![CDATA[old <x>]]></before><after><![CDATA[new]]></after></detail>";
    expect(parseDetailXml(xml)).toEqual({ before: "old <x>", after: "new" });
  });

  it("байхгүй бол хоосон мөр", () => {
    expect(parseDetailXml(null)).toEqual({ before: "", after: "" });
    expect(parseDetailXml("<after><![CDATA[only]]></after>")).toEqual({
      before: "",
      after: "only",
    });
  });
});

describe("XDR туслах функцүүд", () => {
  it("normalizeXdrText — зай шахаж, жижиг үсэг", () => {
    expect(normalizeXdrText("  Live   RESPONSE\n session ")).toBe(
      "live response session",
    );
  });

  it("statusIndicatesCompleted", () => {
    expect(statusIndicatesCompleted("Action completed")).toBe(true);
    expect(statusIndicatesCompleted("Pending")).toBe(false);
    expect(statusIndicatesCompleted(undefined)).toBe(false);
  });

  it("normalizeXdrStatus — зөвшөөрөгдсөн утга руу", () => {
    expect(normalizeXdrStatus("in progress")).toBe("In Progress");
    expect(normalizeXdrStatus("Closed")).toBe("Resolved");
    expect(normalizeXdrStatus("escalated to SOC")).toBe("Escalated");
    expect(normalizeXdrStatus("dismissed")).toBe("Dismissed");
    expect(normalizeXdrStatus("open")).toBe("New");
    expect(normalizeXdrStatus("")).toBe("New");
  });
});

describe("classifyXdr", () => {
  it("live response + дууссан → Critical, хянах шаардлагатай", () => {
    const r = classifyXdr({
      text: "Live response session started on device",
      sourceStatus: "Completed",
      deviceRepeated: false,
    });
    // High(2) + privileged + completed + response_action = 5 → Critical(3)-оор хязгаарлагдана
    expect(r.riskLevel).toBe("Critical");
    expect(r.category).toBe("Response Action");
    expect(r.privilegedAction).toBe(true);
    expect(r.requiresReview).toBe(true);
    expect(r.adjustments).toEqual([
      "privileged",
      "completed",
      "response_action",
    ]);
  });

  it("incident created → Low, хянах шаардлагагүй", () => {
    const r = classifyXdr({
      text: "Incident created",
      sourceStatus: "New",
      deviceRepeated: false,
    });
    expect(r).toMatchObject({
      riskLevel: "Low",
      requiresReview: false,
      adjustments: [],
    });
  });

  it("танигдаагүй мэдэгдэл → дор хаяж High, хянана", () => {
    const r = classifyXdr({
      text: "something odd",
      sourceStatus: "New",
      deviceRepeated: false,
    });
    expect(r.actionKeyword).toBe("unknown");
    expect(r.riskLevel).toBe("High");
    expect(r.requiresReview).toBe(true);
  });

  it("давтагдсан төхөөрөмж эрсдэлийг нэг шат өсгөнө", () => {
    const base = classifyXdr({
      text: "Incident created",
      sourceStatus: "New",
      deviceRepeated: false,
    });
    const repeated = classifyXdr({
      text: "Incident created",
      sourceStatus: "New",
      deviceRepeated: true,
    });
    expect(base.riskLevel).toBe("Low");
    expect(repeated.riskLevel).toBe("Medium");
  });

  it("урт түлхүүр үг богинохоосоо түрүүлж таарна", () => {
    // "device not reporting" нь "release device"-ээс урт
    const r = classifyXdr({
      text: "device not reporting",
      sourceStatus: "New",
      deviceRepeated: false,
    });
    expect(r.actionKeyword).toBe("device not reporting");
  });
});
