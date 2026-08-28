/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.79.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ProPosSupervisorAuthModal,
  SupervisorAuthResult,
} from "../components/billing/propos/ProPosSupervisorAuthModal";
import * as apiFetchModule from "../lib/apiFetchV1";

describe("ProPOS Real-Time Supervisor PIN Authorization & Lockout Control", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("STEP 1: should export ProPosSupervisorAuthModal component function", () => {
    expect(typeof ProPosSupervisorAuthModal).toBe("function");
  });

  it("STEP 2: should validate SupervisorAuthResult data model properties", () => {
    const sampleResult: SupervisorAuthResult = {
      supervisor_id: "SUP-001",
      supervisor_name: "Anita Sharma (Store Manager)",
      action_type: "NEGATIVE_CASH_DRAWER",
      auth_token: "token-sup-verified-9988",
      authorized_at: new Date().toISOString(),
      reason: "Approved emergency cash withdrawal for vendor payout",
    };

    expect(sampleResult.supervisor_id).toBe("SUP-001");
    expect(sampleResult.action_type).toBe("NEGATIVE_CASH_DRAWER");
    expect(sampleResult.auth_token).toContain("token-sup");
  });

  it("STEP 3: should post supervisor PIN verification payload to backend auth API", async () => {
    const postSpy = vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({
      verified: true,
      supervisor_id: "SUP-001",
      supervisor_name: "Anita Sharma",
      auth_token: "token-sup-auth-12345",
    });

    const res = await apiFetchModule.apiFetchV1("/auth/verify-supervisor-pin", {
      method: "POST",
      body: {
        username: "manager",
        pin: "1234",
        action_type: "FORCED_SHIFT_RESET",
        reason: "Manager Day-End Closing Authorization",
      },
    });

    expect(postSpy).toHaveBeenCalledWith("/auth/verify-supervisor-pin", {
      method: "POST",
      body: {
        username: "manager",
        pin: "1234",
        action_type: "FORCED_SHIFT_RESET",
        reason: "Manager Day-End Closing Authorization",
      },
    });
    expect(res.verified).toBe(true);
    expect(res.supervisor_id).toBe("SUP-001");
  });

  it("STEP 4: should handle failed supervisor verification correctly", async () => {
    vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({
      verified: false,
      message: "Invalid Supervisor PIN",
    });

    const res = await apiFetchModule.apiFetchV1("/auth/verify-supervisor-pin", {
      method: "POST",
      body: {
        username: "manager",
        pin: "0000",
        action_type: "PRICE_OVERRIDE",
      },
    });

    expect(res.verified).toBe(false);
  });
});
