import { describe, expect, it } from "vitest";
import { budgetState, fmtMoneyInput, parseMoneyInput } from "./expense-format";

describe("budgetState", () => {
  it("төлбөрийн хүсэлтгүй бол Төсөвгүй", () => {
    expect(
      budgetState({ has_payment_request: 0, budget_type: "", budget_status_override: "" }),
    ).toBe("no_budget");
  });

  it("төлбөрийн хүсэлттэй, budget мөргүй бол Төсөвтэй", () => {
    expect(
      budgetState({
        has_payment_request: 1,
        budget_type: "",
        budget_status_override: "",
      }),
    ).toBe("has_budget");
  });

  it("төлбөрийн хүсэлттэй, холбогдох budget мөртэй бол Нэмэлт төсөвтэй", () => {
    expect(
      budgetState({
        has_payment_request: 1,
        budget_type: "Барилга байгууламж",
        budget_status_override: "",
      }),
    ).toBe("additional_budget");
  });

  it("аудиторын гараар тохируулсан утга автомат тооцооллыг дардаг", () => {
    expect(
      budgetState({
        has_payment_request: 0,
        budget_type: "",
        budget_status_override: "has_budget",
      }),
    ).toBe("has_budget");
    expect(
      budgetState({
        has_payment_request: 1,
        budget_type: "Аль нэг",
        budget_status_override: "no_budget",
      }),
    ).toBe("no_budget");
  });
});

describe("fmtMoneyInput / parseMoneyInput", () => {
  it("en-US таслалаар мянгат, 1 оронгийн нарийвчлал", () => {
    expect(fmtMoneyInput(16626.6)).toBe("16,626.6");
    expect(fmtMoneyInput(0)).toBe("0.0");
    expect(fmtMoneyInput(1_000_000)).toBe("1,000,000.0");
  });

  it("parseMoneyInput нь fmtMoneyInput-ийн урвуу үйлдэл", () => {
    expect(parseMoneyInput("16,626.6")).toBe(16626.6);
    expect(parseMoneyInput("1,000,000.0")).toBe(1_000_000);
    expect(parseMoneyInput("буруу")).toBe(0);
  });
});
