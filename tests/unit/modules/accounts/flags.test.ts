import { describe, it, expect } from "vitest";
import {
  deriveFlags,
  isClosingCode,
  isProfitTaxCode,
  isProfitDistributionCode,
  isExtraBilantierCode,
  deriveCashRole,
  deriveArRole,
  deriveApRole,
  deriveVatRole,
  derivePayrollRole,
} from "@/modules/accounts/flags";

/**
 * These tests pin the contract defined by the accountant's answers in
 * docs/ro/intrebari-contabil-plan-conturi.md section 1.4 and 2.4,
 * with the architectural decisions documented in
 * docs/decisions/0001-plan-de-conturi-refactor.md.
 *
 * Changing these tests requires updating the ADR.
 */

describe("isClosingCode", () => {
  it("matches 121 and sub-accounts 1211/1212", () => {
    expect(isClosingCode("121")).toBe(true);
    expect(isClosingCode("1211")).toBe(true);
    expect(isClosingCode("1212")).toBe(true);
  });

  it("does not match other class 1 accounts", () => {
    expect(isClosingCode("1012")).toBe(false);
    expect(isClosingCode("129")).toBe(false);
    expect(isClosingCode("117")).toBe(false);
    expect(isClosingCode("1171")).toBe(false);
  });

  it("does not match unrelated codes", () => {
    expect(isClosingCode("401")).toBe(false);
    expect(isClosingCode("")).toBe(false);
  });
});

describe("isProfitTaxCode", () => {
  it("matches all tax variants per accountant 1.4", () => {
    // 691 standard, 694 group, 695 specific (HoReCa), 697 IMCA, 698 micro/deferred
    expect(isProfitTaxCode("691")).toBe(true);
    expect(isProfitTaxCode("694")).toBe(true);
    expect(isProfitTaxCode("695")).toBe(true);
    expect(isProfitTaxCode("697")).toBe(true);
    expect(isProfitTaxCode("698")).toBe(true);
  });

  it("does not match operational expense accounts", () => {
    expect(isProfitTaxCode("641")).toBe(false);
    expect(isProfitTaxCode("635")).toBe(false); // other taxes — not profit tax
    expect(isProfitTaxCode("681")).toBe(false);
    expect(isProfitTaxCode("692")).toBe(false); // not a real profit tax code
  });
});

describe("isProfitDistributionCode", () => {
  it("matches only 129", () => {
    expect(isProfitDistributionCode("129")).toBe(true);
    expect(isProfitDistributionCode("121")).toBe(false);
    expect(isProfitDistributionCode("1291")).toBe(false);
  });
});

describe("isExtraBilantierCode — D11 class 8/9", () => {
  it("matches all class 8 codes", () => {
    expect(isExtraBilantierCode("801")).toBe(true);
    expect(isExtraBilantierCode("8031")).toBe(true);
    expect(isExtraBilantierCode("8032")).toBe(true);
    expect(isExtraBilantierCode("8035")).toBe(true);
    expect(isExtraBilantierCode("891")).toBe(true);
  });

  it("matches all class 9 codes", () => {
    expect(isExtraBilantierCode("901")).toBe(true);
    expect(isExtraBilantierCode("921")).toBe(true);
    expect(isExtraBilantierCode("999")).toBe(true);
  });

  it("does not match class 1-7 codes", () => {
    expect(isExtraBilantierCode("101")).toBe(false);
    expect(isExtraBilantierCode("401")).toBe(false);
    expect(isExtraBilantierCode("641")).toBe(false);
    expect(isExtraBilantierCode("706")).toBe(false);
  });

  it("handles empty string defensively", () => {
    expect(isExtraBilantierCode("")).toBe(false);
  });
});

describe("deriveCashRole — D8", () => {
  it("classifies core bank/cash accounts as cash_direct", () => {
    expect(deriveCashRole("5121")).toBe("cash_direct"); // banca lei
    expect(deriveCashRole("5124")).toBe("cash_direct"); // banca valuta
    expect(deriveCashRole("5311")).toBe("cash_direct"); // casa lei
    expect(deriveCashRole("5314")).toBe("cash_direct"); // casa valuta
  });

  it("classifies 542 as cash_advance (money with employee)", () => {
    expect(deriveCashRole("542")).toBe("cash_advance");
  });

  it("classifies 581 as transit (EXCLUDED from cash KPI per D8)", () => {
    expect(deriveCashRole("581")).toBe("transit");
  });

  it("classifies 5125 as transit (EXCLUDED from cash KPI per D8)", () => {
    expect(deriveCashRole("5125")).toBe("transit");
  });

  it("returns null for unrelated accounts", () => {
    expect(deriveCashRole("401")).toBeNull();
    expect(deriveCashRole("4111")).toBeNull();
    expect(deriveCashRole("121")).toBeNull();
  });
});

describe("deriveArRole — D8 receivables", () => {
  it("4111 is ar_primary", () => {
    expect(deriveArRole("4111")).toBe("ar_primary");
  });

  it("4118 is ar_doubtful (creante incerte)", () => {
    expect(deriveArRole("4118")).toBe("ar_doubtful");
  });

  it("418 is ar_pending (facturi de intocmit)", () => {
    expect(deriveArRole("418")).toBe("ar_pending");
  });

  it("419 is customer_advance (SUBTRACTED from receivables KPI)", () => {
    expect(deriveArRole("419")).toBe("customer_advance");
  });

  it("returns null for unrelated accounts", () => {
    expect(deriveArRole("401")).toBeNull();
    expect(deriveArRole("411")).toBeNull(); // synthetic parent, not analytic primary
  });
});

describe("deriveApRole — D8 payables", () => {
  it("401 and 404 are ap_primary", () => {
    expect(deriveApRole("401")).toBe("ap_primary");
    expect(deriveApRole("404")).toBe("ap_primary");
  });

  it("408 is ap_pending (furnizori facturi nesosite)", () => {
    expect(deriveApRole("408")).toBe("ap_pending");
  });

  it("409 is supplier_advance (SUBTRACTED from payables KPI)", () => {
    expect(deriveApRole("409")).toBe("supplier_advance");
  });

  it("returns null for unrelated accounts", () => {
    expect(deriveApRole("4111")).toBeNull();
    expect(deriveApRole("5121")).toBeNull();
  });
});

describe("deriveVatRole — D9", () => {
  it("maps the full VAT family", () => {
    expect(deriveVatRole("4427")).toBe("vat_collected");
    expect(deriveVatRole("4426")).toBe("vat_deductible");
    expect(deriveVatRole("4423")).toBe("vat_payable");
    expect(deriveVatRole("4424")).toBe("vat_receivable");
    expect(deriveVatRole("4428")).toBe("vat_pending");
  });

  it("returns null for unrelated accounts", () => {
    expect(deriveVatRole("4425")).toBeNull(); // not a VAT account
    expect(deriveVatRole("4441")).toBeNull(); // profit tax
  });
});

describe("derivePayrollRole", () => {
  it("classifies salary accounts 421-428", () => {
    expect(derivePayrollRole("421")).toBe("salary");
    expect(derivePayrollRole("423")).toBe("salary");
    expect(derivePayrollRole("425")).toBe("salary");
    expect(derivePayrollRole("426")).toBe("salary");
    expect(derivePayrollRole("427")).toBe("salary");
    expect(derivePayrollRole("428")).toBe("salary");
  });

  it("classifies social contribution family 4311-4318, 4371, 4372, 4441", () => {
    expect(derivePayrollRole("4311")).toBe("social_contrib");
    expect(derivePayrollRole("4315")).toBe("social_contrib");
    expect(derivePayrollRole("4318")).toBe("social_contrib");
    expect(derivePayrollRole("4371")).toBe("social_contrib");
    expect(derivePayrollRole("4372")).toBe("social_contrib");
    expect(derivePayrollRole("4441")).toBe("social_contrib");
  });

  it("returns null for unrelated accounts", () => {
    expect(derivePayrollRole("401")).toBeNull();
    expect(derivePayrollRole("641")).toBeNull(); // expense, not liability — separate
  });
});

describe("deriveFlags integration", () => {
  it("121 closing account gets full closing treatment", () => {
    const f = deriveFlags("121");
    expect(f.isClosing).toBe(true);
    expect(f.isProfitTax).toBe(false);
    expect(f.isProfitDistribution).toBe(false);
    expect(f.isExtraBilantier).toBe(false);
    expect(f.cashRole).toBeNull();
  });

  it("698 micro tax is flagged as profit tax", () => {
    const f = deriveFlags("698");
    expect(f.isProfitTax).toBe(true);
  });

  it("5121 has cash_direct role and no other flags", () => {
    const f = deriveFlags("5121");
    expect(f.cashRole).toBe("cash_direct");
    expect(f.isClosing).toBe(false);
    expect(f.isProfitTax).toBe(false);
  });

  it("5125 is transit (excluded from cash KPI)", () => {
    const f = deriveFlags("5125");
    expect(f.cashRole).toBe("transit");
  });

  it("legacy special=pl_closing still works", () => {
    // Some imaginary code marked via legacy `special` field
    const f = deriveFlags("999999", "pl_closing");
    expect(f.isClosing).toBe(true);
  });

  it("legacy special=micro_tax maps to isProfitTax", () => {
    const f = deriveFlags("9999", "micro_tax");
    expect(f.isProfitTax).toBe(true);
  });

  it("class 9 account is extra-bilantier regardless of other flags", () => {
    const f = deriveFlags("999");
    expect(f.isExtraBilantier).toBe(true);
  });

  it("unknown code returns all-null/false flags", () => {
    const f = deriveFlags("0000");
    expect(f.isClosing).toBe(false);
    expect(f.isProfitTax).toBe(false);
    expect(f.isProfitDistribution).toBe(false);
    expect(f.isExtraBilantier).toBe(false);
    expect(f.cashRole).toBeNull();
    expect(f.arRole).toBeNull();
    expect(f.apRole).toBeNull();
    expect(f.vatRole).toBeNull();
    expect(f.payrollRole).toBeNull();
  });
});
