/**
 * Project      : SMRITI Retail OS
 * Test Suite   : CERT-017 Relevance Ranking Engine Certification
 * Standard     : UDCP-001, UDCP-006 (FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * 5 Assertions:
 *   A1: Exact Barcode / Code match gets top score (100)
 *   A2: Exact SKU / Title match gets 95 score
 *   A3: Title Starts With gets 90 score
 *   A4: Title Includes gets 85 score
 *   A5: Subtitle / Tag match gets 70 score
 */

import { describe, it, expect } from "vitest";
import { UDCPRankingEngine, RetailRankingStrategy } from "../kernel/upr/discovery/UDCPRankingEngine.js";
import type { DiscoveryResult } from "../kernel/upr/discovery/UDCPSchema.js";

describe("CERT-017: Relevance Ranking Engine Certification", () => {
  const strategy = new RetailRankingStrategy();

  it("A1: Exact Code match scores 100", () => {
    const res: DiscoveryResult = {
      id: "1", type: "entity", title: "Nike Air Zoom", entityType: "product", entityId: "NK-AZ-42B", score: 0, provider: "test"
    };

    const score = strategy.score(res, ["nk-az-42b"]);
    expect(score).toBe(100);
  });

  it("A2: Exact Title match scores 95", () => {
    const res: DiscoveryResult = {
      id: "2", type: "entity", title: "Arjun Traders", score: 0, provider: "test"
    };

    const score = strategy.score(res, ["arjun", "traders"]);
    expect(score).toBe(95);
  });

  it("A3: Title Starts With scores 90", () => {
    const res: DiscoveryResult = {
      id: "3", type: "entity", title: "Nike Running Shoes", score: 0, provider: "test"
    };

    const score = strategy.score(res, ["nike"]);
    expect(score).toBe(90);
  });

  it("A4: Title Includes scores 85", () => {
    const res: DiscoveryResult = {
      id: "4", type: "entity", title: "Mens Nike Sneakers", score: 0, provider: "test"
    };

    const score = strategy.score(res, ["nike"]);
    expect(score).toBe(85);
  });

  it("A5: Subtitle match scores 70", () => {
    const res: DiscoveryResult = {
      id: "5", type: "entity", title: "Custom Item", subtitle: "Category: Footwear", score: 0, provider: "test"
    };

    const score = strategy.score(res, ["footwear"]);
    expect(score).toBe(70);
  });
});
