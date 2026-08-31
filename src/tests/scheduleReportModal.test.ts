/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.77.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ScheduleReportModal,
  ScheduleItem,
} from "../components/reports/ScheduleReportModal";
import * as apiFetchModule from "../lib/apiFetchV1";

describe("SMRITI Report Automation & Multi-Channel Distribution Hub Contract & Flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("STEP 1: should export ScheduleReportModal component function", () => {
    expect(typeof ScheduleReportModal).toBe("function");
  });

  it("STEP 2: should validate ScheduleItem shape and distribution channel types", () => {
    const item: ScheduleItem = {
      id: "sched-01",
      schedule_name: "Nightly Sales & Tax Register Dispatch",
      report_code: "RPT-SAL-001",
      cron_expression: "0 21 * * *",
      export_format: "XLSX",
      channels: ["EMAIL", "STATUTORY_VAULT"],
      recipients: {
        emails: ["director@smritibooks.com", "cfo@smritibooks.com"],
        vault_folder: "/Statutory/Compliance/2026-Q3",
      },
      is_active: true,
      next_run_at: "2026-08-28T21:00:00Z",
    };

    expect(item.schedule_name).toBe("Nightly Sales & Tax Register Dispatch");
    expect(item.export_format).toBe("XLSX");
    expect(item.channels).toContain("EMAIL");
    expect(item.channels).toContain("STATUTORY_VAULT");
    expect(item.recipients.emails?.length).toBe(2);
  });

  it("STEP 3: should post new schedule configuration to FastAPI backend", async () => {
    const postSpy = vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({
      id: "sched-created-01",
      schedule_name: "Executive Weekly Summary",
      report_code: "RPT-SAL-001",
      cron_expression: "0 8 * * 1",
      export_format: "PDF",
      channels: ["EMAIL", "WHATSAPP"],
      recipients: {
        emails: ["ceo@smritibooks.com"],
        phone_numbers: ["+919876543210"],
      },
      is_active: true,
    });

    const payload = {
      schedule_name: "Executive Weekly Summary",
      report_code: "RPT-SAL-001",
      cron_expression: "0 8 * * 1",
      export_format: "PDF",
      channels: ["EMAIL", "WHATSAPP"],
      recipients: {
        emails: ["ceo@smritibooks.com"],
        phone_numbers: ["+919876543210"],
      },
      is_active: true,
    };

    const res = await apiFetchModule.apiFetchV1("/reporting/schedules", {
      method: "POST",
      body: payload,
    });

    expect(postSpy).toHaveBeenCalledWith("/reporting/schedules", {
      method: "POST",
      body: payload,
    });
    expect(res.id).toBe("sched-created-01");
    expect(res.channels).toEqual(["EMAIL", "WHATSAPP"]);
  });

  it("STEP 4: should trigger immediate on-demand execution of schedule", async () => {
    const triggerSpy = vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({
      schedule_id: "sched-01",
      report_code: "RPT-SAL-001",
      dispatched_count: 2,
      status: "COMPLETED",
    });

    const res = await apiFetchModule.apiFetchV1("/reporting/schedules/sched-01/trigger", {
      method: "POST",
    });

    expect(triggerSpy).toHaveBeenCalledWith("/reporting/schedules/sched-01/trigger", {
      method: "POST",
    });
    expect(res.status).toBe("COMPLETED");
    expect(res.dispatched_count).toBe(2);
  });
});
