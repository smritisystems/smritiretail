/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.82.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  StoreTerminalBroadcastHub,
  StoreBroadcastMessage,
} from "../sync/StoreTerminalBroadcastHub";
import { StoreBroadcastNotificationBanner } from "../components/global/StoreBroadcastNotificationBanner";

describe("SMRITI Edge-to-Edge Store Terminal Real-Time Broadcast Hub", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("STEP 1: should initialize singleton StoreTerminalBroadcastHub", () => {
    const hub = StoreTerminalBroadcastHub.getInstance();
    hub.init("POS-03", "BR-MALL-01", "Ramesh Kumar");

    const status = hub.getStatus();
    expect(status.terminalId).toBe("POS-03");
    expect(status.branchId).toBe("BR-MALL-01");
  });

  it("STEP 2: should export StoreBroadcastNotificationBanner component function", () => {
    expect(typeof StoreBroadcastNotificationBanner).toBe("function");
  });

  it("STEP 3: should broadcast message to registered subscribers", () => {
    const hub = StoreTerminalBroadcastHub.getInstance();
    let receivedMsg: StoreBroadcastMessage | null = null;

    const unsubscribe = hub.subscribe((msg) => {
      receivedMsg = msg;
    });

    const sent = hub.broadcast(
      "MANAGER_OVERRIDE_REQUEST",
      "Supervisor Auth Required",
      "Register 03 requires supervisor PIN for negative cash pull of ₹2,500.00",
      { register: "POS-03", variance: -2500 }
    );

    expect(receivedMsg).not.toBeNull();
    expect(receivedMsg?.eventType).toBe("MANAGER_OVERRIDE_REQUEST");
    expect(receivedMsg?.senderTerminalId).toBe("POS-03");
    expect(sent.title).toBe("Supervisor Auth Required");

    unsubscribe();
  });

  it("STEP 4: should filter targeted messages not meant for current terminal", () => {
    const hub = StoreTerminalBroadcastHub.getInstance();
    let callCount = 0;

    const unsubscribe = hub.subscribe(() => {
      callCount++;
    });

    // Send targeted message for POS-99 (current is POS-03)
    hub.handleIncomingMessage({
      id: "bc-test-target",
      eventType: "PRICE_UPDATE_BROADCAST",
      senderTerminalId: "SERVER",
      senderName: "HQ Admin",
      targetTerminalId: "POS-99", // Different terminal
      branchId: "BR-MALL-01",
      title: "Targeted message",
      body: "Not for POS-03",
      timestamp: new Date().toISOString(),
    });

    expect(callCount).toBe(0); // Should be ignored

    unsubscribe();
  });
});
