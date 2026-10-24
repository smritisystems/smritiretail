/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 1.0.0
 * * Created    : 2026-10-13
 * * Modified   : 2026-10-13
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { describe, it, expect, beforeEach } from "vitest";
import { isFieldMandatoryBySystemParam } from "../services/itemMasterLookupGate.ts";
import { smritiSystemParameterService } from "../services/smritiSystemParameterService.ts";
import { CORE_STANDARD_ITEM_FIELDS } from "../services/unifiedFieldCatalog.ts";
import { FIELD_TO_ELEMENT_ID } from "../services/itemMasterValidationMapper.ts";

describe("Item Master Mandatory Lookups & System Parameter Governance", () => {
  beforeEach(() => {
    // Reset parameter cache
    (smritiSystemParameterService as any).cache.clear();
  });

  describe("1. Default Mandatory Enforcement (True by default)", () => {
    it("brand is mandatory by default when system parameter is unset", () => {
      expect(isFieldMandatoryBySystemParam("brand")).toBe(true);
    });

    it("subcategory is mandatory by default when system parameter is unset", () => {
      expect(isFieldMandatoryBySystemParam("subcategory")).toBe(true);
    });

    it("department is mandatory by default when system parameter is unset", () => {
      expect(isFieldMandatoryBySystemParam("department")).toBe(true);
    });

    it("size_group is mandatory by default when system parameter is unset", () => {
      expect(isFieldMandatoryBySystemParam("size_group")).toBe(true);
    });

    it("hsn_code is mandatory by default when system parameter is unset", () => {
      expect(isFieldMandatoryBySystemParam("hsn_code")).toBe(true);
    });

    it("tax_category is mandatory by default when system parameter is unset", () => {
      expect(isFieldMandatoryBySystemParam("tax_category")).toBe(true);
    });
  });

  describe("2. System Parameter Dual-Key Override (ADR-042)", () => {
    it("brand can be made optional via modern key SMRITI.CATALOG.ITEM.MANDATORY_BRAND", () => {
      (smritiSystemParameterService as any).cache.set("SMRITI.CATALOG.ITEM.MANDATORY_BRAND", false);
      expect(isFieldMandatoryBySystemParam("brand")).toBe(false);
    });

    it("brand can be made optional via legacy key ItemBrandMandatory", () => {
      (smritiSystemParameterService as any).cache.set("ItemBrandMandatory", "false");
      expect(isFieldMandatoryBySystemParam("brand")).toBe(false);
    });

    it("subcategory can be made optional via modern key SMRITI.CATALOG.ITEM.MANDATORY_SUBCATEGORY", () => {
      (smritiSystemParameterService as any).cache.set("SMRITI.CATALOG.ITEM.MANDATORY_SUBCATEGORY", "0");
      expect(isFieldMandatoryBySystemParam("subcategory")).toBe(false);
    });

    it("subcategory can be made optional via legacy key ItemSubCategoryMandatory", () => {
      (smritiSystemParameterService as any).cache.set("ItemSubCategoryMandatory", false);
      expect(isFieldMandatoryBySystemParam("subcategory")).toBe(false);
    });

    it("department can be made optional via modern key SMRITI.CATALOG.ITEM.MANDATORY_DEPARTMENT", () => {
      (smritiSystemParameterService as any).cache.set("SMRITI.CATALOG.ITEM.MANDATORY_DEPARTMENT", false);
      expect(isFieldMandatoryBySystemParam("department")).toBe(false);
    });

    it("department can be made optional via legacy key ItemDepartmentMandatory", () => {
      (smritiSystemParameterService as any).cache.set("ItemDepartmentMandatory", "false");
      expect(isFieldMandatoryBySystemParam("department")).toBe(false);
    });

    it("size_group can be made optional via modern key SMRITI.CATALOG.ITEM.MANDATORY_SIZE_GROUP", () => {
      (smritiSystemParameterService as any).cache.set("SMRITI.CATALOG.ITEM.MANDATORY_SIZE_GROUP", false);
      expect(isFieldMandatoryBySystemParam("size_group")).toBe(false);
    });

    it("size_group can be made optional via legacy key ItemSizeGroupMandatory", () => {
      (smritiSystemParameterService as any).cache.set("ItemSizeGroupMandatory", "0");
      expect(isFieldMandatoryBySystemParam("size_group")).toBe(false);
    });

    it("hsn_code can be made optional via modern key SMRITI.CATALOG.ITEM.MANDATORY_HSN_CODE", () => {
      (smritiSystemParameterService as any).cache.set("SMRITI.CATALOG.ITEM.MANDATORY_HSN_CODE", false);
      expect(isFieldMandatoryBySystemParam("hsn_code")).toBe(false);
    });

    it("hsn_code can be made optional via legacy key ItemHsnCodeMandatory", () => {
      (smritiSystemParameterService as any).cache.set("ItemHsnCodeMandatory", "false");
      expect(isFieldMandatoryBySystemParam("hsn_code")).toBe(false);
    });

    it("tax_category can be made optional via modern key SMRITI.CATALOG.ITEM.MANDATORY_TAX_CATEGORY", () => {
      (smritiSystemParameterService as any).cache.set("SMRITI.CATALOG.ITEM.MANDATORY_TAX_CATEGORY", false);
      expect(isFieldMandatoryBySystemParam("tax_category")).toBe(false);
    });

    it("tax_category can be made optional via legacy key ItemTaxCategoryMandatory", () => {
      (smritiSystemParameterService as any).cache.set("ItemTaxCategoryMandatory", "0");
      expect(isFieldMandatoryBySystemParam("tax_category")).toBe(false);
    });
  });

  describe("3. Unified Field Catalog Schema Parity", () => {
    it("brand is marked required in CORE_STANDARD_ITEM_FIELDS", () => {
      const field = CORE_STANDARD_ITEM_FIELDS.find((f) => f.key === "brand");
      expect(field).toBeDefined();
      expect(field?.required).toBe(true);
    });

    it("subCategory is marked required in CORE_STANDARD_ITEM_FIELDS", () => {
      const field = CORE_STANDARD_ITEM_FIELDS.find((f) => f.key === "subCategory");
      expect(field).toBeDefined();
      expect(field?.required).toBe(true);
    });

    it("department is marked required in CORE_STANDARD_ITEM_FIELDS", () => {
      const field = CORE_STANDARD_ITEM_FIELDS.find((f) => f.key === "department");
      expect(field).toBeDefined();
      expect(field?.required).toBe(true);
    });

    it("sizeGroup is present and marked required in CORE_STANDARD_ITEM_FIELDS", () => {
      const field = CORE_STANDARD_ITEM_FIELDS.find((f) => f.key === "size_group");
      expect(field).toBeDefined();
      expect(field?.id).toBe("sizeGroup");
      expect(field?.required).toBe(true);
    });

    it("hsnCode is marked required in CORE_STANDARD_ITEM_FIELDS", () => {
      const field = CORE_STANDARD_ITEM_FIELDS.find((f) => f.key === "hsn_code");
      expect(field).toBeDefined();
      expect(field?.required).toBe(true);
    });

    it("taxCategory is present, required, and has GOODS/SERVICES valid values in CORE_STANDARD_ITEM_FIELDS", () => {
      const field = CORE_STANDARD_ITEM_FIELDS.find((f) => f.key === "tax_category");
      expect(field).toBeDefined();
      expect(field?.id).toBe("taxCategory");
      expect(field?.required).toBe(true);
      expect(field?.validValues).toEqual(["GOODS", "SERVICES"]);
    });
  });

  describe("4. Field Validation Navigation Mapper Parity", () => {
    it("maps brand to im-field-brand", () => {
      expect(FIELD_TO_ELEMENT_ID["brand"]).toBe("im-field-brand");
    });

    it("maps subcategory aliases to im-field-subcategory", () => {
      expect(FIELD_TO_ELEMENT_ID["subcategory"]).toBe("im-field-subcategory");
      expect(FIELD_TO_ELEMENT_ID["subCategory"]).toBe("im-field-subcategory");
      expect(FIELD_TO_ELEMENT_ID["sub_category"]).toBe("im-field-subcategory");
      expect(FIELD_TO_ELEMENT_ID["subcat"]).toBe("im-field-subcategory");
    });

    it("maps department aliases to im-field-department", () => {
      expect(FIELD_TO_ELEMENT_ID["department"]).toBe("im-field-department");
      expect(FIELD_TO_ELEMENT_ID["dept"]).toBe("im-field-department");
      expect(FIELD_TO_ELEMENT_ID["division"]).toBe("im-field-department");
    });

    it("maps size_group aliases to im-field-size_group", () => {
      expect(FIELD_TO_ELEMENT_ID["size_group"]).toBe("im-field-size_group");
      expect(FIELD_TO_ELEMENT_ID["sizeGroup"]).toBe("im-field-size_group");
      expect(FIELD_TO_ELEMENT_ID["size_group_id"]).toBe("im-field-size_group");
      expect(FIELD_TO_ELEMENT_ID["sizeGroupId"]).toBe("im-field-size_group");
    });

    it("maps hsn_code aliases to im-field-hsn_code", () => {
      expect(FIELD_TO_ELEMENT_ID["hsn_code"]).toBe("im-field-hsn_code");
      expect(FIELD_TO_ELEMENT_ID["hsnCode"]).toBe("im-field-hsn_code");
      expect(FIELD_TO_ELEMENT_ID["hsn"]).toBe("im-field-hsn_code");
    });

    it("maps tax_category aliases to im-field-tax_category", () => {
      expect(FIELD_TO_ELEMENT_ID["tax_category"]).toBe("im-field-tax_category");
      expect(FIELD_TO_ELEMENT_ID["taxCategory"]).toBe("im-field-tax_category");
      expect(FIELD_TO_ELEMENT_ID["tax_cat"]).toBe("im-field-tax_category");
    });
  });
});
