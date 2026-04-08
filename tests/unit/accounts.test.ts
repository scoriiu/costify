import { describe, it, expect } from "vitest";
import { getContBase, getAccountType, isPnlAccount, computeLeafFlags } from "@/lib/accounts";

describe("getContBase", () => {
  it("extracts base before dot", () => {
    expect(getContBase("5121.00001")).toBe("5121");
    expect(getContBase("401.FURNIZOR")).toBe("401");
  });

  it("returns as-is when no dot", () => {
    expect(getContBase("5121")).toBe("5121");
    expect(getContBase("121")).toBe("121");
  });
});

describe("getAccountType", () => {
  it("class 1 is P (capital)", () => {
    expect(getAccountType("101")).toBe("P");
    expect(getAccountType("1012")).toBe("P");
  });

  it("129 is exception A (repartizare profit)", () => {
    expect(getAccountType("129")).toBe("A");
  });

  it("class 2 is A (imobilizari)", () => {
    expect(getAccountType("2131")).toBe("A");
    expect(getAccountType("211")).toBe("A");
  });

  it("28x/29x are P (amortizari/ajustari)", () => {
    expect(getAccountType("2813")).toBe("P");
    expect(getAccountType("291")).toBe("P");
  });

  it("class 3 is A (stocuri)", () => {
    expect(getAccountType("301")).toBe("A");
    expect(getAccountType("371")).toBe("A");
  });

  it("39x is P (provizioane stocuri)", () => {
    expect(getAccountType("391")).toBe("P");
  });

  it("class 4 is B (terti -- bifunctional)", () => {
    expect(getAccountType("401")).toBe("B");
    expect(getAccountType("411")).toBe("B");
    expect(getAccountType("4426")).toBe("B");
  });

  it("class 5 is A (trezorerie)", () => {
    expect(getAccountType("5121")).toBe("A");
    expect(getAccountType("531")).toBe("A");
  });

  it("519 is P (credite bancare TS)", () => {
    expect(getAccountType("519")).toBe("P");
    expect(getAccountType("5191")).toBe("P");
  });

  it("class 6 is A (cheltuieli)", () => {
    expect(getAccountType("627")).toBe("A");
    expect(getAccountType("641")).toBe("A");
  });

  it("class 7 is P (venituri)", () => {
    expect(getAccountType("704")).toBe("P");
    expect(getAccountType("766")).toBe("P");
  });
});

describe("isPnlAccount", () => {
  it("class 6 and 7 are P&L", () => {
    expect(isPnlAccount("627")).toBe(true);
    expect(isPnlAccount("704")).toBe(true);
    expect(isPnlAccount("641.001")).toBe(true);
  });

  it("other classes are not P&L", () => {
    expect(isPnlAccount("5121")).toBe(false);
    expect(isPnlAccount("401")).toBe(false);
    expect(isPnlAccount("121")).toBe(false);
  });
});

describe("computeLeafFlags", () => {
  it("marks parent and leaf correctly", () => {
    const rows = [
      { cont: "5121" },
      { cont: "5121.00001" },
      { cont: "5121.00002" },
      { cont: "401" },
    ];

    const result = computeLeafFlags(rows);
    const map = Object.fromEntries(result.map((r) => [r.cont, r]));

    expect(map["5121"].isLeaf).toBe(false);
    expect(map["5121"].hasChild).toBe(true);
    expect(map["5121.00001"].isLeaf).toBe(true);
    expect(map["5121.00002"].isLeaf).toBe(true);
    expect(map["401"].isLeaf).toBe(true);
  });
});
