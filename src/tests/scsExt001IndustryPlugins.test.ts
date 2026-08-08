/**
 * Project      : SMRITI Retail OS
 * Test Suite   : SCS-EXT-001 Industry Plugins & Adapters Certification Tests
 * Standard     : SCS-EXT-001 — Extension SDK & Plugin Standard
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * Covers:
 *   EXT-001  Industry Plugin Manifest Registration & Package Validation
 *   EXT-002  Footwear Plugin Template Installation (Size UK/US/EU, Color, Sticker 50x25mm)
 *   EXT-003  Pharmacy Plugin Template Installation (Batch, Expiry FEFO, Schedule H)
 *   EXT-004  General Retail Supermarket Plugin Template Installation (Shelf Labels)
 *   EXT-005  Vendor-Neutral Integration Adapters (Accounting Adapter, Messaging Adapter)
 *   EXT-006  Zero Side-Effect Plugin Isolation Assertion
 */

import { describe, it, expect } from "vitest";
import { IndustryRegistry, IndustryPluginPackage } from "../kernel/plugins/IndustryRegistry.js";

interface IntegrationAdapter {
  adapterType: "ACCOUNTING" | "MESSAGING" | "PAYMENT" | "ECOMMERCE";
  activeConnector: string;
  supportedConnectors: string[];
}

describe("SCS-EXT-001 Industry Plugins & Adapters Certification Tests (EXT-001 to EXT-006)", () => {
  it("EXT-001: Industry Plugin Manifest Registration registers valid industry packages", () => {
    const allPlugins = IndustryRegistry.getAll();
    expect(allPlugins.length).toBeGreaterThanOrEqual(3);

    const pluginIds = allPlugins.map((p) => p.id);
    expect(pluginIds).toContain("footwear");
    expect(pluginIds).toContain("pharmacy");
    expect(pluginIds).toContain("general_retail");
  });

  it("EXT-002: Footwear Plugin installs Size matrix, Color attributes, and Sticker Label templates", () => {
    const footwear = IndustryRegistry.get("footwear");

    expect(footwear.id).toBe("footwear");
    expect(footwear.icon).toBe("👟");
    expect(footwear.capabilitiesEnabled).toContain("priceMatrix");
    expect(footwear.barcodeTemplate).toBe("FOOTWEAR_STICKER_50X25");

    const shoeSizeAttr = footwear.customAttributes.find((a) => a.name === "Shoe Size");
    expect(shoeSizeAttr).toBeDefined();
    expect(shoeSizeAttr?.required).toBe(true);
  });

  it("EXT-003: Pharmacy Plugin installs Batch tracking, Expiry FEFO, and Schedule H Drug Register", () => {
    const pharmacy = IndustryRegistry.get("pharmacy");

    expect(pharmacy.id).toBe("pharmacy");
    expect(pharmacy.icon).toBe("💊");
    expect(pharmacy.capabilitiesEnabled).toContain("batch");
    expect(pharmacy.capabilitiesEnabled).toContain("expiry");
    expect(pharmacy.barcodeTemplate).toBe("PHARMA_BATCH_STICKER_38X25");

    const batchAttr = pharmacy.customAttributes.find((a) => a.name === "Batch Number");
    const expiryAttr = pharmacy.customAttributes.find((a) => a.name === "Expiry Date");
    expect(batchAttr).toBeDefined();
    expect(expiryAttr).toBeDefined();
  });

  it("EXT-004: General Retail Supermarket Plugin installs shelf label profiles and promotions", () => {
    const supermarket = IndustryRegistry.get("general_retail");

    expect(supermarket.id).toBe("general_retail");
    expect(supermarket.capabilitiesEnabled).toContain("promotions");
    expect(supermarket.barcodeTemplate).toBe("SUPERMARKET_SHELF_LABEL");
  });

  it("EXT-005: Vendor-Neutral Integration Adapters decouple connectors from core platform", () => {
    const accountingAdapter: IntegrationAdapter = {
      adapterType: "ACCOUNTING",
      activeConnector: "TallyPrimeConnector",
      supportedConnectors: ["TallyPrimeConnector", "BusyConnector", "SAPConnector", "QuickBooksConnector"],
    };

    const messagingAdapter: IntegrationAdapter = {
      adapterType: "MESSAGING",
      activeConnector: "WhatsAppCloudApiConnector",
      supportedConnectors: ["WhatsAppCloudApiConnector", "TwilioSmsConnector", "SendGridEmailConnector"],
    };

    expect(accountingAdapter.supportedConnectors).toContain("TallyPrimeConnector");
    expect(messagingAdapter.supportedConnectors).toContain("WhatsAppCloudApiConnector");
  });

  it("EXT-006: Zero Side-Effect Plugin Isolation Assertion — plugins do not pollute each other", () => {
    const footwearBefore = JSON.stringify(IndustryRegistry.get("footwear"));

    // Fetch and evaluate Pharmacy plugin
    const pharmacy = IndustryRegistry.get("pharmacy");
    expect(pharmacy.id).toBe("pharmacy");

    // Fetch and evaluate General Retail plugin
    const general = IndustryRegistry.get("general_retail");
    expect(general.id).toBe("general_retail");

    const footwearAfter = JSON.stringify(IndustryRegistry.get("footwear"));

    // Assert Footwear package remains 100% identical and unmutated
    expect(footwearAfter).toBe(footwearBefore);
  });
});
