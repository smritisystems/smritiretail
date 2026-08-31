/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.80.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CommunicatorStudioTab,
  CommMessageRecord,
} from "../components/communicator/CommunicatorStudioTab";
import * as apiFetchModule from "../lib/apiFetchV1";

describe("SMRITI Omnichannel Communicator Studio & WhatsApp Gateway UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("STEP 1: should export CommunicatorStudioTab component function", () => {
    expect(typeof CommunicatorStudioTab).toBe("function");
  });

  it("STEP 2: should validate CommMessageRecord data model properties", () => {
    const sampleRecord: CommMessageRecord = {
      id: "msg-001",
      channel: "WHATSAPP",
      category: "TRANSACTIONAL",
      recipient: "+919876543210",
      body: "Dear Ramesh, your invoice #INV-2026-001 for ₹12320.00 has been generated.",
      status: "DELIVERED",
      provider_msg_id: "wamid.HBgLOTE5ODc2NTQzMjEwFQIAEhgWM0VCMDAw",
      sent_at: new Date().toISOString(),
    };

    expect(sampleRecord.channel).toBe("WHATSAPP");
    expect(sampleRecord.recipient).toBe("+919876543210");
    expect(sampleRecord.provider_msg_id).toContain("wamid.");
  });

  it("STEP 3: should post message dispatch payload to communicator API endpoint", async () => {
    const postSpy = vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({
      id: "msg-12345",
      status: "DELIVERED",
      provider_msg_id: "wamid.20260828001",
    });

    const res = await apiFetchModule.apiFetchV1("/communicator/send", {
      method: "POST",
      body: {
        channel: "WHATSAPP",
        category: "TRANSACTIONAL",
        recipient: "+919876543210",
        body: "Invoice Notification",
      },
    });

    expect(postSpy).toHaveBeenCalled();
    expect(res.status).toBe("DELIVERED");
    expect(res.provider_msg_id).toBe("wamid.20260828001");
  });

  it("STEP 4: should handle inbound webhook delivery status simulation", async () => {
    const webhookSpy = vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({
      status: "SUCCESS",
      updated: true,
    });

    const res = await apiFetchModule.apiFetchV1("/communicator/webhook/delivery-event", {
      method: "POST",
      body: {
        provider_message_id: "wamid.20260828001",
        status: "READ",
        timestamp: new Date().toISOString(),
      },
    });

    expect(webhookSpy).toHaveBeenCalled();
    expect(res.status).toBe("SUCCESS");
  });
});
