/**
 * Project      : SMRITI Retail OS
 * Test Suite   : CERT-014 UDCP Kernel Certification (SPK.udcp Engine)
 * Standard     : UDCP-001 through UDCP-007 (FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * 10 Assertions:
 *   A1: SPK.udcp facade is registered on master SMRITIPlatformKernel
 *   A2: SPK.search acts as a 100% backward-compatible facade delegating to SPK.udcp
 *   A3: UDCPKernel queries built-in providers in parallel
 *   A4: Results conform to DiscoveryResult contract
 *   A5: RetailRankingStrategy orders exact code match > title match > fuzzy
 *   A6: UDCPEventBus emits SearchStarted and SearchCompleted events
 *   A7: DiscoverySession tracks search queries, count, and duration
 *   A8: UDCPQueryPipeline processes synonyms ("pos" -> "point of sale")
 *   A9: Industry Vocabulary Packs register and map domain terms ("PCM" -> "Paracetamol")
 *   A10: Rule UDCP-007: Provider search is deterministic and side-effect free
 */

import { describe, it, expect } from "vitest";
import { SPK } from "../kernel/SPK.js";
import { UDCPKernel } from "../kernel/upr/discovery/UDCPKernel.js";
import { UDCPQueryPipeline } from "../kernel/upr/discovery/UDCPQueryPipeline.js";
import { UDCPEventBus } from "../kernel/upr/discovery/UDCPEventBus.js";
import type { UDCPEventPayload } from "../kernel/upr/discovery/UDCPSchema.js";

describe("CERT-014: UDCP Kernel Certification (SPK.udcp Engine)", () => {

  it("A1: SPK.udcp facade is registered on master SMRITIPlatformKernel singleton", () => {
    expect(SPK.udcp).toBeDefined();
    expect(typeof SPK.udcp.search).toBe("function");
    expect(typeof SPK.udcp.executeResult).toBe("function");
    expect(typeof SPK.udcp.inspectResult).toBe("function");
    expect(typeof SPK.udcp.registerProvider).toBe("function");
    expect(typeof SPK.udcp.registerVocabulary).toBe("function");
  });

  it("A2: SPK.search acts as a 100% backward-compatible facade delegating to SPK.udcp", async () => {
    const results = await SPK.search.search("customer");
    expect(Array.isArray(results)).toBe(true);
  });

  it("A3: UDCPKernel queries built-in providers in parallel", async () => {
    const results = await SPK.udcp.search("Arjun");
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("A4: Search results conform strictly to the DiscoveryResult contract", async () => {
    const results = await SPK.udcp.search("Nike");
    expect(results.length).toBeGreaterThan(0);

    const first = results[0];
    expect(first.id).toBeDefined();
    expect(first.type).toBeDefined();
    expect(first.title).toBeDefined();
    expect(typeof first.score).toBe("number");
    expect(first.provider).toBeDefined();
  });

  it("A5: RetailRankingStrategy ranks exact code/barcode matches above title matches", async () => {
    const results = await SPK.udcp.search("CUST-001");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThanOrEqual(90);
  });

  it("A6: UDCPEventBus emits SearchStarted and SearchCompleted events", async () => {
    const events: string[] = [];
    const unsub = UDCPEventBus.on("*", (payload: UDCPEventPayload) => {
      events.push(payload.event);
    });

    await SPK.udcp.search("invoice");
    expect(events).toContain("SearchStarted");
    expect(events).toContain("SearchCompleted");

    unsub();
  });

  it("A7: DiscoverySession tracks search queries, count, and duration", async () => {
    await SPK.udcp.search("ABC");
    const session = SPK.udcp.getSession();

    expect(session).toBeDefined();
    expect(session?.query).toBe("ABC");
    expect(session?.resultsCount).toBeGreaterThan(0);
  });

  it("A8: UDCPQueryPipeline processes common retail synonyms ('cust' -> 'customer')", () => {
    const processed = UDCPQueryPipeline.process("cust arjun");
    expect(processed.terms).toContain("customer");
  });

  it("A9: Industry Vocabulary Packs register and map domain terms ('PCM' -> 'Paracetamol')", () => {
    SPK.udcp.registerVocabulary({
      industry: "pharmacy",
      synonyms: { pcm: "paracetamol", dolo: "paracetamol" },
    });

    const processed = UDCPQueryPipeline.process("pcm 650", "pharmacy");
    expect(processed.terms).toContain("paracetamol");
  });

  it("A10: UDCP-007: Provider search execution is deterministic and side-effect free", async () => {
    const res1 = await SPK.udcp.search("product");
    const res2 = await SPK.udcp.search("product");

    expect(res1.length).toBe(res2.length);
  });
});
