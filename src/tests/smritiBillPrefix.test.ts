/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS & SMRITI Systems
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.18.0
 * Created      : 2026-09-14
 * Modified     : 2026-09-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Description  : Vitest Suite for SMRITI Bill Prefix Architecture & Statutory GST Rule 46(b) Validation
 */

import { describe, it, expect } from "vitest";
import {
  validateGstRule46b,
  formatBillPreview,
  assembleBillNo,
  SmritiBillPrefixService
} from "../services/smritiBillPrefixService.ts";

describe("SMRITI Bill Prefix & Statutory GST Rule 46(b) Suite", () => {
  describe("Statutory GST Rule 46(b) Compliance", () => {
    it("should accept valid GST serial numbers not exceeding 16 characters with [A-Za-z0-9/-]", () => {
      // 1. Standard Retail Invoice
      const r1 = validateGstRule46b("INV/", "0001", "26-27/");
      expect(r1.isValid).toBe(true);
      expect(r1.combined).toBe("INV/000126-27/");
      expect(r1.length).toBe(14);
      expect(r1.error).toBeUndefined();

      // 2. Terminal-Specific Prefix
      const r2 = validateGstRule46b("T1-INV-", "1001", "");
      expect(r2.isValid).toBe(true);
      expect(r2.combined).toBe("T1-INV-1001");
      expect(r2.length).toBe(11);

      // 3. Exactly 16 characters
      const r3 = validateGstRule46b("SMR/INV/26/", "00001", "");
      expect(r3.isValid).toBe(true);
      expect(r3.length).toBe(16);
    });

    it("should strictly reject serial numbers exceeding 16 characters", () => {
      const r = validateGstRule46b("COMPANY-DELHI-STORE1-INV-", "000001", "2026-2027");
      expect(r.isValid).toBe(false);
      expect(r.error).toContain("exceeds maximum 16 characters");
      expect(r.length).toBeGreaterThan(16);
    });

    it("should reject invalid characters not permitted under GST Rule 46(b)", () => {
      // Special characters like @, #, $, _, space are prohibited under Rule 46(b)
      const r1 = validateGstRule46b("INV#", "001", "");
      expect(r1.isValid).toBe(false);
      expect(r1.error).toContain("contains invalid characters");

      const r2 = validateGstRule46b("INV_C", "001", "");
      expect(r2.isValid).toBe(false);
      expect(r2.error).toContain("contains invalid characters");

      const r3 = validateGstRule46b("INV ", "001", "");
      expect(r3.isValid).toBe(false);
      expect(r3.error).toContain("contains invalid characters");
    });
  });

  describe("Bill Preview Formatter", () => {
    it("should format preview with custom running length padding", () => {
      expect(formatBillPreview("INV/", 1, "26-27/", 4)).toBe("INV/000126-27/");
      expect(formatBillPreview("CRN-", 42, "", 6)).toBe("CRN-000042");
      expect(formatBillPreview("SO/", 105, "/26", 3)).toBe("SO/105/26");
    });
  });

  describe("Standard Out-of-the-Box Default Prefix Schemas", () => {
    it("should provide complete Shoper 9 transaction categories and all defaults must be GST Rule 46(b) compliant", () => {
      const defaults = SmritiBillPrefixService.getDefaultDefinitions("COMMON", true);

      // Must cover Sales, Cash, and Slips groups
      expect(defaults.length).toBe(12);

      const salesTypes = defaults.filter(d => d.transactionGroup === "SALES").map(d => d.documentType);
      expect(salesTypes).toContain("SALES_CASH");
      expect(salesTypes).toContain("SALES_CREDIT");
      expect(salesTypes).toContain("SALES_RETURN");
      expect(salesTypes).toContain("VOID_SALES");

      const cashTypes = defaults.filter(d => d.transactionGroup === "CASH").map(d => d.documentType);
      expect(cashTypes).toContain("CASH_RECEIPT");
      expect(cashTypes).toContain("CASH_PAYOUT");

      const slipTypes = defaults.filter(d => d.transactionGroup === "SLIPS").map(d => d.documentType);
      expect(slipTypes).toContain("BILL_HOLD");
      expect(slipTypes).toContain("SALES_ORDER");
      expect(slipTypes).toContain("SALES_ADVICE_SLIP");
      expect(slipTypes).toContain("SERVICE_ORDER");
      expect(slipTypes).toContain("DELIVERY_CHALLAN");
      expect(slipTypes).toContain("APPROVAL_DC");

      // Verify each default definition satisfies GST Rule 46(b)
      for (const def of defaults) {
        const preview = formatBillPreview(def.prefix, def.startNumber, def.suffix, def.runningLength);
        const gst = validateGstRule46b(def.prefix, def.startNumber.toString().padStart(def.runningLength, "0"), def.suffix);
        expect(gst.isValid).toBe(true);
        expect(preview.length).toBeLessThanOrEqual(16);
      }
    });

    it("should include company code when requested", () => {
      const defaultsWithCompany = SmritiBillPrefixService.getDefaultDefinitions("COMMON", true, "BLR01");
      const cashInv = defaultsWithCompany.find(d => d.documentType === "SALES_CASH");
      expect(cashInv?.prefix).toContain("BLR01/");
    });
  });

  describe("Offline Fallback Resolution", () => {
    it("should resolve fallback prefix correctly when backend is offline", async () => {
      const res = await SmritiBillPrefixService.resolveActivePrefix({
        transactionType: "SALES_CREDIT",
        terminalId: "POS-01"
      });

      expect(res).toBeDefined();
      expect(res.prefix).toContain("INV/CR/");
      expect(res.gstRule46bValid).toBe(true);
      expect(res.fullPreview).toContain("INV/CR/0001");
    });
  });

  describe("Bill Number Format Arrangements (assembleBillNo)", () => {
    it("PREFIX_NUM_SUFFIX: produces {prefix}{num}{suffix} — default / backward-compatible", () => {
      expect(assembleBillNo("INV/C/", "0001", "26-27/", "", "PREFIX_NUM_SUFFIX")).toBe("INV/C/000126-27/");
      expect(assembleBillNo("CRN-", "000042", "", "", "PREFIX_NUM_SUFFIX")).toBe("CRN-000042");
    });

    it("PREFIX_YEAR_SEP_NUM: produces {prefix}/{year}/{num}", () => {
      expect(assembleBillNo("TT", "251", "", "2026-2027", "PREFIX_YEAR_SEP_NUM")).toBe("TT/2026-2027/251");
      expect(assembleBillNo("INV", "0001", "ignored-suffix", "2026-2027", "PREFIX_YEAR_SEP_NUM")).toBe("INV/2026-2027/0001");
    });

    it("PREFIX_YEAR_SEP_NUM with empty financial year omits year segment gracefully", () => {
      const result = assembleBillNo("TT", "251", "", "", "PREFIX_YEAR_SEP_NUM");
      expect(result).toBe("TT/251");
    });

    it("PREFIX_SEP_NUM: produces {prefix}/{num} — suffix ignored", () => {
      expect(assembleBillNo("TT", "251", "2026-2027/", "2026-2027", "PREFIX_SEP_NUM")).toBe("TT/251");
      expect(assembleBillNo("", "099", "", "", "PREFIX_SEP_NUM")).toBe("099"); // no prefix → no slash
    });

    it("NUM_ONLY: produces bare sequential number — prefix and suffix ignored", () => {
      expect(assembleBillNo("TT/", "251", "2026-2027/", "2026-2027", "NUM_ONLY")).toBe("251");
    });

    it("null / undefined format falls back to PREFIX_NUM_SUFFIX", () => {
      // TypeScript won't normally allow null here, but test the runtime default
      // @ts-expect-error testing runtime fallback
      expect(assembleBillNo("INV/", "0001", "26-27/", "", null)).toBe("INV/000126-27/");
    });

    it("all four formats must produce GST Rule 46(b) compliant output (≤16 chars, valid chars)", () => {
      const formats = ["PREFIX_NUM_SUFFIX", "PREFIX_YEAR_SEP_NUM", "PREFIX_SEP_NUM", "NUM_ONLY"] as const;
      const testCases = formats.map(fmt => assembleBillNo("TT", "251", "", "2026-2027", fmt));
      for (const result of testCases) {
        expect(result.length).toBeLessThanOrEqual(16);
        expect(/^[A-Za-z0-9/\-]+$/.test(result)).toBe(true);
      }
    });

    it("formatBillPreview delegates to assembleBillNo and stays backward-compatible", () => {
      // Two-arg call (old signature) must still produce PREFIX_NUM_SUFFIX layout
      expect(formatBillPreview("INV/", 1, "26-27/", 4)).toBe("INV/000126-27/");
      // Six-arg call with explicit format
      expect(formatBillPreview("TT", 251, "", 3, "PREFIX_YEAR_SEP_NUM", "2026-2027")).toBe("TT/2026-2027/251");
    });
  });
});
