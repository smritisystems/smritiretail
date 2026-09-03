/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-09-03
 * Modified     : 2026-09-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Unit Test
 */

import { describe, it, expect } from "vitest";
import { SmritiCapability, withCapability, SmritiCapabilityMetadata } from "../types/architecture";

describe("SMRITI Architecture Governance Enforcement Layer", () => {
  it("should attach capability metadata using withCapability marker", () => {
    const dummyComponent = () => "test";
    const meta: SmritiCapabilityMetadata = {
      entity: "customer",
      capability: "customer.lookup",
      role: "CANONICAL",
      description: "Universal customer search modal",
    };

    const marked = withCapability(dummyComponent, meta);
    expect((marked as any).__smriti_capability).toBeDefined();
    expect((marked as any).__smriti_capability.entity).toBe("customer");
    expect((marked as any).__smriti_capability.capability).toBe("customer.lookup");
    expect((marked as any).__smriti_capability.role).toBe("CANONICAL");
  });

  it("should support class decoration via SmritiCapability", () => {
    const meta: SmritiCapabilityMetadata = {
      entity: "purchase_order",
      capability: "purchase.three_way_match",
      role: "CANONICAL",
    };

    class DummyService {
      process() {
        return true;
      }
    }
    SmritiCapability(meta)(DummyService);

    expect((DummyService as any).__smriti_capability).toEqual(meta);
  });

  it("should allow registering approved secondary roles with decisionId", () => {
    const meta: SmritiCapabilityMetadata = {
      entity: "sales_order",
      capability: "sales.order_entry",
      role: "COMPATIBILITY",
      canonicalOwner: "SalesOrderFormPremium.tsx",
      decisionId: "ADR-EXEMPT-006",
    };

    const wrapper = withCapability(() => null, meta);
    expect((wrapper as any).__smriti_capability.role).toBe("COMPATIBILITY");
    expect((wrapper as any).__smriti_capability.decisionId).toBe("ADR-EXEMPT-006");
  });
});
