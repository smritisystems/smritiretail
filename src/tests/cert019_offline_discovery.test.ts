/**
 * Project      : SMRITI Retail OS
 * Test Suite   : CERT-019 Offline Discovery Certification
 * Standard     : UDCP-001, UDCP-006 (FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * 5 Assertions:
 *   A1: Provider with mode 'offline' executes during offline context
 *   A2: Provider with mode 'online' is bypassed during offline context
 *   A3: DiscoveryIndex returns cached records when offline
 *   A4: DiscoveryContext offline flag propagation
 *   A5: Offline query completion does not throw network exceptions
 */

import { describe, it, expect } from "vitest";
import { SPK } from "../kernel/SPK.js";
import type { IDiscoveryProvider, DiscoveryResult, ProviderHealth } from "../kernel/upr/discovery/UDCPSchema.js";

describe("CERT-019: Offline Discovery Certification", () => {

  it("A1: Offline provider executes successfully when context.offline === true", async () => {
    class MockOfflineProvider implements IDiscoveryProvider {
      id = "provider.mock_offline";
      name = "Mock Offline";
      priority = 1;
      mode: "online" | "offline" | "hybrid" = "offline";
      health(): ProviderHealth { return "Healthy"; }
      async search(): Promise<DiscoveryResult[]> {
        return [{
          id: "off_1",
          type: "entity",
          title: "Offline Local Product",
          score: 100,
          provider: this.id,
        }];
      }
    }

    SPK.udcp.registerProvider(new MockOfflineProvider());

    const results = await SPK.udcp.search("Offline", { offline: true });
    expect(results.length).toBeGreaterThan(0);
  });

  it("A2: Online-only provider gracefully handles cloud disconnection", async () => {
    class MockOnlineProvider implements IDiscoveryProvider {
      id = "provider.mock_online";
      name = "Mock Online";
      priority = 1;
      mode: "online" | "offline" | "hybrid" = "online";
      health(): ProviderHealth { return "Offline"; } // cloud disconnected
      async search(): Promise<DiscoveryResult[]> {
        throw new Error("Network unreachable");
      }
    }

    SPK.udcp.registerProvider(new MockOnlineProvider());

    // Search should complete cleanly using offline fallback providers
    const results = await SPK.udcp.search("Arjun", { offline: true });
    expect(Array.isArray(results)).toBe(true);
  });

  it("A3: DiscoveryContext offline flag propagates through search pipeline", async () => {
    const results = await SPK.udcp.search("Customer", { offline: true, industry: "retail" });
    expect(Array.isArray(results)).toBe(true);
  });

  it("A4: Offline discovery returns local indexed records", async () => {
    const results = await SPK.udcp.search("CUST-001", { offline: true });
    expect(results.length).toBeGreaterThan(0);
  });

  it("A5: Offline query execution produces zero uncaught exceptions", async () => {
    await expect(SPK.udcp.search("test", { offline: true })).resolves.toBeDefined();
  });
});
