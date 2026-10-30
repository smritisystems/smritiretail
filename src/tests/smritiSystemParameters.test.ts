/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.41.0
 * Created      : 2026-09-14
 * Modified     : 2026-09-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Description  : Vitest Suite for SMRITI System Parameters Subsystem & 5-Tier Mutability Governance
 */

import { describe, it, expect, beforeEach } from "vitest";
import { smritiSystemParameterService } from "../services/smritiSystemParameterService.ts";

describe("SMRITI System Parameters Subsystem & 5-Tier Mutability Governance", () => {
  beforeEach(() => {
    // Reset service state before each test
    (smritiSystemParameterService as any).cache.clear();
    (smritiSystemParameterService as any).definitions.clear();
    (smritiSystemParameterService as any).canonicalAlias.clear();
    (smritiSystemParameterService as any).isLoaded = false;
  });

  describe("0ms Synchronous Accessor Behaviors", () => {
    it("should return default fallback when parameter is not present in cache", () => {
      expect(smritiSystemParameterService.getBoolean("NON_EXISTENT_PARAM", true)).toBe(true);
      expect(smritiSystemParameterService.getBoolean("NON_EXISTENT_PARAM", false)).toBe(false);
      expect(smritiSystemParameterService.getNumber("NON_EXISTENT_PARAM", 42)).toBe(42);
      expect(smritiSystemParameterService.getString("NON_EXISTENT_PARAM", "DEFAULT_STR")).toBe("DEFAULT_STR");
    });

    it("should correctly resolve boolean values across multiple formats", () => {
      const cache = (smritiSystemParameterService as any).cache;

      cache.set("P_BOOL_TRUE", true);
      cache.set("P_BOOL_FALSE", false);
      cache.set("P_STR_ONE", "1");
      cache.set("P_STR_ZERO", "0");
      cache.set("P_STR_TRUE", "true");
      cache.set("P_STR_FALSE", "false");
      cache.set("P_STR_YES", "yes");
      cache.set("P_NUM_ONE", 1);
      cache.set("P_NUM_ZERO", 0);

      expect(smritiSystemParameterService.getBoolean("P_BOOL_TRUE")).toBe(true);
      expect(smritiSystemParameterService.getBoolean("P_BOOL_FALSE")).toBe(false);
      expect(smritiSystemParameterService.getBoolean("P_STR_ONE")).toBe(true);
      expect(smritiSystemParameterService.getBoolean("P_STR_ZERO")).toBe(false);
      expect(smritiSystemParameterService.getBoolean("P_STR_TRUE")).toBe(true);
      expect(smritiSystemParameterService.getBoolean("P_STR_FALSE")).toBe(false);
      expect(smritiSystemParameterService.getBoolean("P_STR_YES")).toBe(true);
      expect(smritiSystemParameterService.getBoolean("P_NUM_ONE")).toBe(true);
      expect(smritiSystemParameterService.getBoolean("P_NUM_ZERO")).toBe(false);
    });

    it("should correctly resolve numeric values", () => {
      const cache = (smritiSystemParameterService as any).cache;

      cache.set("PARAM_INTEGER", 100);
      cache.set("PARAM_FLOAT", 18.5);
      cache.set("PARAM_STR_NUM", "250.75");
      cache.set("PARAM_INVALID", "NOT_A_NUMBER");

      expect(smritiSystemParameterService.getNumber("PARAM_INTEGER")).toBe(100);
      expect(smritiSystemParameterService.getNumber("PARAM_FLOAT")).toBe(18.5);
      expect(smritiSystemParameterService.getNumber("PARAM_STR_NUM")).toBe(250.75);
      expect(smritiSystemParameterService.getNumber("PARAM_INVALID", 999)).toBe(999);
    });

    it("should correctly resolve string and generic values", () => {
      const cache = (smritiSystemParameterService as any).cache;

      cache.set("SHOPEREnv", "R");
      cache.set("CustClass1Cap", "Religion");
      cache.set("CONFIG_OBJ", { mode: "PROD", timeout: 3000 });

      expect(smritiSystemParameterService.getString("SHOPEREnv")).toBe("R");
      expect(smritiSystemParameterService.getString("CustClass1Cap")).toBe("Religion");
      expect(smritiSystemParameterService.getValue<any>("CONFIG_OBJ")).toEqual({ mode: "PROD", timeout: 3000 });
    });
  });

  describe("5-Tier Governance & Mutability Semantics", () => {
    it("should correctly verify definitions and mutability classifications", () => {
      const defs = (smritiSystemParameterService as any).definitions;

      defs.set("CompanyCode", {
        param_code: "CompanyCode",
        category: "01. General",
        data_type: "Text",
        mutability: "Fixed",
        effective_value: "CORP01",
        is_locked: true,
      });

      defs.set("InstallationID", {
        param_code: "InstallationID",
        category: "01. General",
        data_type: "Text",
        mutability: "Installation",
        effective_value: "INST-9921",
        is_locked: true,
      });

      defs.set("AllowCreditBilling", {
        param_code: "AllowCreditBilling",
        category: "11. Billing",
        data_type: "Boolean",
        mutability: "Variable",
        effective_value: false,
        is_locked: false,
      });

      const fixedDef = smritiSystemParameterService.getDefinition("CompanyCode");
      expect(fixedDef).toBeDefined();
      expect(fixedDef?.mutability).toBe("Fixed");
      expect(fixedDef?.is_locked).toBe(true);

      const installDef = smritiSystemParameterService.getDefinition("InstallationID");
      expect(installDef?.mutability).toBe("Installation");

      const varDef = smritiSystemParameterService.getDefinition("AllowCreditBilling");
      expect(varDef?.mutability).toBe("Variable");
      expect(varDef?.is_locked).toBe(false);
    });
  });

  describe("Dual-Key Resolution (ADR-042)", () => {
    it("should resolve SMRITI.* canonical keys to the same value as the legacy param_code", () => {
      const cache = (smritiSystemParameterService as any).cache;
      const canonicalAlias = (smritiSystemParameterService as any).canonicalAlias;

      // Simulate what load() does: populate cache with legacy keys and build alias map
      cache.set("AllowCreditBilling", true);
      cache.set("SHOPEREnv", "R");
      cache.set("StockOutActionInBill", 3);

      canonicalAlias.set("SMRITI.BILLING.ALLOW_CREDIT_BILLING", "AllowCreditBilling");
      canonicalAlias.set("SMRITI.SETUP.SHOPER_ENV", "SHOPEREnv");
      canonicalAlias.set("SMRITI.BILLING.STOCK_OUT_ACTION_IN_BILL", "StockOutActionInBill");

      // Both key forms must resolve to the same value
      expect(smritiSystemParameterService.getBoolean("AllowCreditBilling")).toBe(true);
      expect(smritiSystemParameterService.getBoolean("SMRITI.BILLING.ALLOW_CREDIT_BILLING")).toBe(true);

      expect(smritiSystemParameterService.getString("SHOPEREnv")).toBe("R");
      expect(smritiSystemParameterService.getString("SMRITI.SETUP.SHOPER_ENV")).toBe("R");

      expect(smritiSystemParameterService.getNumber("StockOutActionInBill")).toBe(3);
      expect(smritiSystemParameterService.getNumber("SMRITI.BILLING.STOCK_OUT_ACTION_IN_BILL")).toBe(3);
    });

    it("should return defaultValue when SMRITI.* key has no alias mapping", () => {
      // No entries in canonicalAlias — unmapped SMRITI.* key should fall back to default
      expect(smritiSystemParameterService.getBoolean("SMRITI.BILLING.UNKNOWN_PARAM", false)).toBe(false);
      expect(smritiSystemParameterService.getString("SMRITI.SETUP.UNKNOWN_PARAM", "FALLBACK")).toBe("FALLBACK");
      expect(smritiSystemParameterService.getNumber("SMRITI.STOCK.INWARDS.UNKNOWN", 99)).toBe(99);
    });

    it("should return canonical definition via getDefinition using SMRITI.* key", () => {
      const defs = (smritiSystemParameterService as any).definitions;
      const canonicalAlias = (smritiSystemParameterService as any).canonicalAlias;

      defs.set("AllowCreditBilling", {
        param_code: "AllowCreditBilling",
        canonical_code: "SMRITI.BILLING.ALLOW_CREDIT_BILLING",
        category: "11. Billing",
        data_type: "Boolean",
        mutability: "Variable",
        effective_value: true,
        is_locked: false,
      });
      canonicalAlias.set("SMRITI.BILLING.ALLOW_CREDIT_BILLING", "AllowCreditBilling");

      const byLegacy = smritiSystemParameterService.getDefinition("AllowCreditBilling");
      const byCanonical = smritiSystemParameterService.getDefinition("SMRITI.BILLING.ALLOW_CREDIT_BILLING");

      expect(byLegacy).toBeDefined();
      expect(byCanonical).toBeDefined();
      expect(byLegacy?.param_code).toBe(byCanonical?.param_code);
      expect(byCanonical?.canonical_code).toBe("SMRITI.BILLING.ALLOW_CREDIT_BILLING");
    });
  });
});
