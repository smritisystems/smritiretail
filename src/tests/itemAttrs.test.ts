/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.1
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import { AttributeDefinition, Product } from "../types.ts";
import { 
  transformAttributeDefinitionToItemField,
  buildUnifiedItemMasterFields,
  validateProductAttributes,
  DEFAULT_MANDATORY_FIELDS,
  ItemMasterFieldDefinition,
  ItemMasterGridRow
} from "../components/itemMaster/types.ts";
import { 
  resolveItemMasterCatalog, 
  getUnifiedItemMasterFields, 
  getUnifiedHeaderMappingFields, 
  serializeProductAttributes,
  CORE_STANDARD_ITEM_FIELDS
} from "../services/unifiedFieldCatalog.ts";
import { getSmritiItemMasterFields } from "../lib/headerMapping/HeaderAliasRegistry.ts";
import { HeaderMappingEngine } from "../lib/headerMapping/HeaderMappingEngine.ts";

describe("Item Master Attribute Unification — Authoritative Single Source of Truth", () => {

  const dynamicDefinitions: AttributeDefinition[] = [
    {
      id: "def-fabric-001",
      name: "fabric_type",
      label: "Fabric Type",
      dataType: "select",
      isVariantDimension: true,
      isMandatory: true,
      validValues: ["Cotton", "Polyester", "Linen", "Denim", "Silk Blend"]
    },
    {
      id: "def-care-002",
      name: "care_instructions",
      label: "Care Instructions",
      dataType: "text",
      isVariantDimension: false,
      isMandatory: false,
      validValues: ["Dry Clean Only", "Machine Wash Cold", "Hand Wash"]
    }
  ];

  // TEST 1 — Create Attribute
  it("TEST 1: should create dynamic attribute definition and transform it into an authoritative field", () => {
    const fabricDef = dynamicDefinitions[0];
    const itemField = transformAttributeDefinitionToItemField(fabricDef);

    expect(itemField.key).toBe("fabric_type");
    expect(itemField.label).toBe("Fabric Type");
    expect(itemField.type).toBe("select");
    expect(itemField.options).toEqual(["Cotton", "Polyester", "Linen", "Denim", "Silk Blend"]);
    expect(itemField.isDynamic).toBe(true);
    expect(itemField.attributeId).toBe("def-fabric-001");
  });

  // TEST 2 — Prime Visibility
  it("TEST 2: should make Fabric Type visible and selectable in Item Master Prime (Field Selection & Details Grid)", () => {
    const fields = buildUnifiedItemMasterFields(dynamicDefinitions);
    const fabricField = fields.find(f => f.key === "fabric_type");

    expect(fabricField).toBeDefined();
    expect(fabricField?.label).toBe("Fabric Type");
    expect(fabricField?.type).toBe("select");
    expect(fabricField?.options).toContain("Cotton");
    expect(fabricField?.isMandatory).toBe(true);
  });

  // TEST 3 — Excel Visibility
  it("TEST 3: should make Fabric Type available in Excel Quick Entry header mapping and grid definitions", () => {
    const dynamicAttrsList = dynamicDefinitions.map(a => ({
      key: a.name,
      label: a.label,
      aliases: [a.name, a.label]
    }));

    const allAvailableFields = getSmritiItemMasterFields(dynamicAttrsList);
    const fabricField = allAvailableFields.find(f => f.key === "attr_fabric_type");

    expect(fabricField).toBeDefined();
    expect(fabricField?.label).toBe("FABRIC TYPE");
    expect(fabricField?.aliases).toContain("Fabric Type");
  });

  // TEST 4 — Header Alias
  it("TEST 4: should resolve configured vendor aliases (Fabric, Material, Fabric Type, Cloth) to canonical fabric_type", () => {
    const dynamicAttrsList = [
      {
        key: "fabric_type",
        label: "Fabric Type",
        aliases: ["Fabric", "Material", "Fabric Type", "Cloth"]
      }
    ];

    const allAvailableFields = getSmritiItemMasterFields(dynamicAttrsList);
    const engine = new HeaderMappingEngine(allAvailableFields);

    const resFabric = engine.mapHeaders(["SKU Code", "Item Name", "Barcode", "Fabric"], "ITEM_MASTER");
    expect(resFabric.columns.find(c => c.sourceHeader === "Fabric")?.mappedFieldKey).toBe("attr_fabric_type");

    const resMaterial = engine.mapHeaders(["SKU Code", "Item Name", "Barcode", "Material"], "ITEM_MASTER");
    expect(resMaterial.columns.find(c => c.sourceHeader === "Material")?.mappedFieldKey).toBe("attr_fabric_type");

    const resCloth = engine.mapHeaders(["SKU Code", "Item Name", "Barcode", "Cloth"], "ITEM_MASTER");
    expect(resCloth.columns.find(c => c.sourceHeader === "Cloth")?.mappedFieldKey).toBe("attr_fabric_type");

    const resFabricType = engine.mapHeaders(["SKU Code", "Item Name", "Barcode", "Fabric Type"], "ITEM_MASTER");
    expect(resFabricType.columns.find(c => c.sourceHeader === "Fabric Type")?.mappedFieldKey).toBe("attr_fabric_type");
  });

  // TEST 5 — Validation
  it("TEST 5: should enforce valid values validation (Cotton/Polyester = valid, Invalid = rejected)", () => {
    // Valid values
    const validResult = validateProductAttributes(
      { fabric_type: "Cotton", care_instructions: "Machine Wash Cold" },
      dynamicDefinitions
    );
    expect(validResult.isValid).toBe(true);
    expect(validResult.errors.length).toBe(0);

    // Invalid value
    const invalidResult = validateProductAttributes(
      { fabric_type: "Synthetic Plastic" },
      dynamicDefinitions
    );
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors[0]).toContain("invalid value");

    // Missing mandatory attribute
    const missingResult = validateProductAttributes(
      { care_instructions: "Machine Wash Cold" },
      dynamicDefinitions
    );
    expect(missingResult.isValid).toBe(false);
    expect(missingResult.errors[0]).toContain("is mandatory");
  });

  // TEST 6 — Prime Persistence
  it("TEST 6: should serialize Prime row into canonical products.attributes JSON payload", () => {
    const primeRow: ItemMasterGridRow = {
      id: "row-1",
      stockNo: "SKU-OXF-001",
      barcode: "8901234567890",
      product: "Oxford Shirt",
      brand: "SMRITI",
      style: "OXF-01",
      shade: "Blue",
      size: "40",
      itemDescription: "Classic Oxford Shirt",
      mrp: "1999.00",
      sellingPrice: "1499.00",
      dealerPrice: "1100.00",
      costPrice: "850.00",
      productTax: "STD_18",
      hsnCode: "62052000",
      uom: "Pcs",
      fabric_type: "Cotton"
    };

    const attributesPayload = serializeProductAttributes(primeRow, dynamicDefinitions);
    expect(attributesPayload.fabric_type).toBe("Cotton");
    expect(attributesPayload.brand).toBe("SMRITI");
  });

  // TEST 7 — Excel Persistence
  it("TEST 7: should serialize Excel row into identical canonical products.attributes JSON payload", () => {
    const excelRow = {
      code: "SKU-OXF-001",
      name: "Oxford Shirt",
      barcode: "8901234567890",
      brand: "SMRITI",
      category: "Apparel",
      subCategory: "Shirts",
      size: "40",
      colour: "Blue",
      price: "1499.00",
      mrp: "1999.00",
      costPrice: "850.00",
      gstPercentage: "18.00",
      hsnCode: "62052000",
      uom: "Pcs",
      imageLink: "",
      styleCode: "OXF-01",
      attributes: {
        fabric_type: "Cotton"
      }
    };

    const attributesPayload = serializeProductAttributes(excelRow, dynamicDefinitions);
    expect(attributesPayload.fabric_type).toBe("Cotton");
    expect(attributesPayload.brand).toBe("SMRITI");
  });

  // TEST 8 — Retrieval
  it("TEST 8: should retrieve product and populate canonical attributes seamlessly", () => {
    const retrievedProduct: Product = {
      id: "prod-101",
      code: "SKU-OXF-001",
      name: "Oxford Shirt",
      price: 1499.00,
      mrp: 1999.00,
      stock: 100,
      category: "Apparel",
      barcode: "8901234567890",
      brand: "SMRITI",
      color: "Blue",
      size: "40",
      attributes: {
        fabric_type: "Cotton"
      }
    };

    expect(retrievedProduct.attributes?.fabric_type).toBe("Cotton");
  });

  // TEST 9 — Edit Definition
  it("TEST 9: should automatically propagate new option 'Wool' to both Prime and Excel when definition is updated", () => {
    const updatedDefinitions: AttributeDefinition[] = [
      {
        ...dynamicDefinitions[0],
        validValues: [...dynamicDefinitions[0].validValues, "Wool"]
      },
      dynamicDefinitions[1]
    ];

    // Prime catalog verification
    const primeFields = buildUnifiedItemMasterFields(updatedDefinitions);
    const primeFabricField = primeFields.find(f => f.key === "fabric_type");
    expect(primeFabricField?.options).toContain("Wool");

    // Validation verification
    const validationResult = validateProductAttributes(
      { fabric_type: "Wool" },
      updatedDefinitions
    );
    expect(validationResult.isValid).toBe(true);
  });

  // TEST 10 — Deactivation
  it("TEST 10: should hide deactivated attribute from new entry workflows while preserving historical data", () => {
    const deactivatedDefinitions: AttributeDefinition[] = [
      {
        ...dynamicDefinitions[0],
        ...({ isEnabled: false } as any)
      },
      dynamicDefinitions[1]
    ];

    // Verify excluded from Prime fields
    const primeFields = buildUnifiedItemMasterFields(deactivatedDefinitions);
    expect(primeFields.find(f => f.key === "fabric_type")).toBeUndefined();

    // Verify historical product records retain fabric_type
    const historicalProduct: Product = {
      id: "prod-hist-01",
      code: "SKU-HIST-01",
      name: "Vintage Oxford Shirt",
      price: 1200,
      stock: 10,
      category: "Apparel",
      barcode: "8909998887776",
      attributes: {
        fabric_type: "Cotton"
      }
    };

    expect(historicalProduct.attributes?.fabric_type).toBe("Cotton");
  });

  // TEST 11 — No Duplicate Schema
  it("TEST 11: should ensure Prime and Excel resolve the same unified field catalog with no duplicate keys", () => {
    const catalog = resolveItemMasterCatalog(dynamicDefinitions);
    const keys = catalog.map(c => c.key.toLowerCase());

    expect(new Set(keys).size).toBe(keys.length);
    expect(catalog.find(c => c.key === "fabric_type")?.source).toBe("dynamic");
    expect(catalog.find(c => c.key === "code")?.source).toBe("core");
    expect(catalog.find(c => c.key === "barcode")?.source).toBe("core");
  });

});
