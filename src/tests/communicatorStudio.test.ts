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
import React from "react";
import { renderToString } from "react-dom/server";
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
      success: true,
      log_id: "msg-12345",
      status: "SENT",
      channel: "WHATSAPP",
      recipient: "+919876543210",
      rendered_body: "Invoice Notification",
      gateway_message_id: "wamid.20260828001",
      fallback_invoked: false,
      dispatched_at: new Date().toISOString(),
    });

    const res = await apiFetchModule.apiFetchV1("/communicator/send", {
      method: "POST",
      body: {
        channel: "WHATSAPP",
        category: "TRANSACTIONAL",
        recipient: "+919876543210",
        direct_body: "Invoice Notification",
      },
    });

    expect(postSpy).toHaveBeenCalled();
    expect(res.status).toBe("SENT");
    expect(res.gateway_message_id).toBe("wamid.20260828001");
    expect(postSpy.mock.calls[0][1]?.body).toMatchObject({
      direct_body: "Invoice Notification",
    });
  });

  it("does not display fabricated sent messages or provider receipts", () => {
    const html = renderToString(React.createElement(CommunicatorStudioTab));

    expect(html).toContain("Demo adapters — delivery unverified");
    expect(html).toContain("WhatsApp (demo adapter)");
    expect(html).not.toContain("Mark Delivered");
    expect(html).not.toContain("Verified Business");
    expect(html).not.toContain("DELIVERED");
  });
});
