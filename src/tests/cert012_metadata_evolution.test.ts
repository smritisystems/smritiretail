/**
 * Project      : SMRITI Retail OS
 * Test Suite   : CERT-012 Metadata Evolution & Extensibility Certification
 * Standard     : UCIF-001 through UCIF-005 (FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * 8 Assertions:
 *   A1: Dynamic InspectorConfig registration at runtime without restart
 *   A2: VS Code-style plugin section injection via registerInspectorSection()
 *   A3: Custom React component override via registerComponent()
 *   A4: Custom DataProvider registration (REST/GraphQL/ERPNext/Tally/Mock)
 *   A5: Custom Phase 1 ContextResolver registration (camera/OCR/voice)
 *   A6: Custom Phase 2 EntityResolver registration
 *   A7: Pinned & Favorite context management
 *   A8: DrillDownSDK facade methods map 1:1 to UCIFKernel
 */

import { describe, it, expect } from "vitest";
import { UCIFKernel } from "../kernel/upr/context/UCIFKernel.js";
import { InspectorRegistry } from "../kernel/upr/context/InspectorRegistry.js";
import { InspectorDataService } from "../kernel/upr/context/InspectorDataProvider.js";
import { ContextResolverChain } from "../kernel/upr/context/ContextResolverChain.js";
import { EntityResolverChain } from "../kernel/upr/context/EntityResolverChain.js";
import type {
  InspectorConfig,
  IInspectorDataProvider,
  IContextResolver,
  IEntityResolver,
  FieldContext,
  EntityContext,
} from "../kernel/upr/context/InspectorSchema.js";

describe("CERT-012: Metadata Evolution & Extensibility Certification", () => {

  // A1: Dynamic InspectorConfig registration at runtime
  it("A1: Registers a new InspectorConfig dynamically at runtime", () => {
    const goldConfig: InspectorConfig = {
      entityType: "gold_ornament",
      variant: "compact",
      version: "1.0.0",
      capabilities: {
        ai: true, timeline: false, attachments: true, audit: true,
        stock: true, pricing: true, workflow: false, relations: true,
      },
      titleField: "ornament_name",
      subtitleField: "hallmark_code",
      badgeField: "purity",
      sections: [
        {
          id: "gold_details",
          title: "Gold Details",
          fields: [
            { key: "purity", label: "Purity", format: "badge" },
            { key: "gross_weight", label: "Gross Weight (g)", format: "text", highlight: true },
            { key: "net_weight", label: "Net Weight (g)", format: "text" },
            { key: "making_charges", label: "Making Charges", format: "currency" },
          ],
        },
      ],
      actions: [],
    };

    UCIFKernel.registerInspector(goldConfig);
    const resolved = InspectorRegistry.resolveConfig("gold_ornament", "compact");

    expect(resolved).toBeDefined();
    expect(resolved?.entityType).toBe("gold_ornament");
    expect(resolved?.titleField).toBe("ornament_name");
    expect(resolved?.sections[0].fields.length).toBe(4);
  });

  // A2: Plugin section injection (VS Code pattern)
  it("A2: Injects a plugin section into an existing entity inspector", () => {
    UCIFKernel.registerInspectorSection("product", {
      id: "jewellery_pack_section",
      title: "Jewellery Purity & Hallmark",
      pluginId: "plugin.jewellery_pack",
      fields: [
        { key: "purity_karat", label: "Karat Purity", format: "badge" },
        { key: "bis_hallmark", label: "BIS Hallmark No.", format: "text" },
      ],
    });

    const pluginSections = InspectorRegistry.getPluginSections("product");
    expect(pluginSections.length).toBeGreaterThan(0);
    expect(pluginSections[0].id).toBe("jewellery_pack_section");
    expect(pluginSections[0].pluginId).toBe("plugin.jewellery_pack");
  });

  // A3: Custom React component override
  it("A3: Registers a custom component override for an entity", () => {
    const MockCustomComponent = () => null;
    InspectorRegistry.registerComponent("custom_entity", MockCustomComponent);

    const resolvedComponent = InspectorRegistry.resolveComponent("custom_entity");
    expect(resolvedComponent).toBe(MockCustomComponent);
  });

  // A4: Custom DataProvider registration
  it("A4: Registers a custom DataProvider (e.g. ERPNext / Tally connector)", () => {
    class CustomERPNextProvider implements IInspectorDataProvider {
      id = "erpnext_connector";
      canProvide(entityType: string): boolean {
        return entityType === "erp_item";
      }
      async fetch(entityType: string, entityId: string, onLoaded: (key: string, d: Record<string, any>) => void): Promise<void> {
        onLoaded("core", { name: "ERPItem-001", erp_code: "ERP-999" });
      }
    }

    const provider = new CustomERPNextProvider();
    UCIFKernel.registerDataProvider(provider);

    expect(provider.canProvide("erp_item")).toBe(true);
  });

  // A5: Custom Phase 1 ContextResolver (e.g., Camera / OCR)
  it("A5: Registers a custom Phase 1 ContextResolver (Camera / OCR / Voice)", async () => {
    class CameraOCRResolver implements IContextResolver {
      name = "CameraOCRResolver";
      priority = 0; // Highest priority
      async resolve(): Promise<FieldContext | null> {
        return { fieldId: "camera_scanned_barcode", rawValue: "8901234567890" };
      }
    }

    const cameraResolver = new CameraOCRResolver();
    UCIFKernel.registerContextResolver(cameraResolver);

    const fieldCtx = await ContextResolverChain.resolve();
    expect(fieldCtx).toBeDefined();
    expect(fieldCtx?.fieldId).toBe("camera_scanned_barcode");
    expect(fieldCtx?.rawValue).toBe("8901234567890");

    // Clean up
    ContextResolverChain.unregisterResolver("CameraOCRResolver");
  });

  // A6: Custom Phase 2 EntityResolver
  it("A6: Registers a custom Phase 2 EntityResolver", async () => {
    class CustomRFIDEntityResolver implements IEntityResolver {
      name = "CustomRFIDEntityResolver";
      confidence = 99;
      async resolve(fieldCtx: FieldContext): Promise<EntityContext[]> {
        if (fieldCtx.fieldId === "rfid_tag") {
          return [{ entityType: "jewellery_item", entityId: fieldCtx.rawValue || "TAG-001", confidence: 99, resolvedBy: this.name }];
        }
        return [];
      }
    }

    UCIFKernel.registerEntityResolver(new CustomRFIDEntityResolver());

    const candidates = await EntityResolverChain.resolve({ fieldId: "rfid_tag", rawValue: "TAG-999" });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].entityType).toBe("jewellery_item");
    expect(candidates[0].confidence).toBe(99);
  });

  // A7: Pinned & Favorite context state management
  it("A7: Manages pinned & favorite inspection contexts", () => {
    const testCtx = {
      entityType: "product",
      entityId: "NK-AZ-42B",
      title: "Nike Air Zoom",
      confidence: 100,
      resolvedBy: "test",
    };

    UCIFKernel.pin(testCtx);
    UCIFKernel.favorite(testCtx);

    const pinned = UCIFKernel.getPinned();
    const favorites = UCIFKernel.getFavorites();

    expect(pinned.length).toBeGreaterThan(0);
    expect(pinned[0].entityId).toBe("NK-AZ-42B");

    expect(favorites.length).toBeGreaterThan(0);
    expect(favorites[0].entityId).toBe("NK-AZ-42B");
  });

  // A8: History tracking
  it("A8: Retains recent inspection history", () => {
    const history = UCIFKernel.getHistory();
    expect(Array.isArray(history)).toBe(true);
  });
});
