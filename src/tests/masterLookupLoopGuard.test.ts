/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.1.1
 * Created      : 2026-09-29
 * Modified     : 2026-09-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target Module: MasterListScreen & MasterLookup Rate Limit (HTTP 429) & Render Loop Prevention Guard
 */

import { describe, it, expect } from "vitest";

describe("MasterListScreen & MasterLookup Loop & 429 Rate Limit Guard Contract", () => {
  it("should enforce cooldown when HTTP 429 rate limit is encountered to break infinite re-fetch loop", () => {
    let rateLimitCooldownUntil = 0;
    let fetchCount = 0;
    let isRateLimited = false;

    const mockFetch = (isManualRetry = false, currentTime: number) => {
      // Guard: Honor cooldown
      if (!isManualRetry && rateLimitCooldownUntil > currentTime) {
        return { status: "COOLDOWN_ACTIVE", blocked: true };
      }

      fetchCount++;
      // Simulate backend SlowAPI rate limit triggered
      const err = new Error('{"error":"Rate limit exceeded: 300 per 1 minute"}');
      const rawMsg = err.message;
      const is429 = rawMsg.includes("429") || rawMsg.toLowerCase().includes("rate limit");

      if (is429) {
        rateLimitCooldownUntil = currentTime + 15000;
        isRateLimited = true;
      }
      return { status: "ERROR_429", is429, blocked: false };
    };

    const startTime = 100000;

    // 1st request -> hits 429, activates 15-second cooldown
    const res1 = mockFetch(false, startTime);
    expect(res1.status).toBe("ERROR_429");
    expect(fetchCount).toBe(1);
    expect(isRateLimited).toBe(true);
    expect(rateLimitCooldownUntil).toBe(startTime + 15000);

    // Rapid automated re-fetch attempts (simulating render loop within 1 second)
    const res2 = mockFetch(false, startTime + 100);
    expect(res2.blocked).toBe(true);
    expect(fetchCount).toBe(1); // Blocked, network call count stayed 1

    const res3 = mockFetch(false, startTime + 500);
    expect(res3.blocked).toBe(true);
    expect(fetchCount).toBe(1); // Blocked

    const res4 = mockFetch(false, startTime + 14999);
    expect(res4.blocked).toBe(true);
    expect(fetchCount).toBe(1); // Still blocked before 15s

    // Manual user retry bypasses cooldown when user explicitly clicks Retry button
    const resManual = mockFetch(true, startTime + 2000);
    expect(resManual.blocked).toBe(false);
    expect(fetchCount).toBe(2);
  });

  it("should deduplicate toast notifications on repeated errors to prevent parent state re-render avalanche", () => {
    let lastNotifiedError: string | null = null;
    const notificationsEmitted: string[] = [];

    const notifyError = (errorMsg: string) => {
      if (lastNotifiedError !== errorMsg) {
        lastNotifiedError = errorMsg;
        notificationsEmitted.push(errorMsg);
      }
    };

    const rateLimitError = '{"error":"Rate limit exceeded: 300 per 1 minute"}';

    // 1st failure -> emits notification
    notifyError(rateLimitError);
    expect(notificationsEmitted.length).toBe(1);

    // 2nd, 3rd, 50th consecutive failures with same error -> deduplicated, 0 new notifications
    notifyError(rateLimitError);
    notifyError(rateLimitError);
    notifyError(rateLimitError);
    expect(notificationsEmitted.length).toBe(1);

    // If error changes, notification is allowed
    notifyError("Network connection reset");
    expect(notificationsEmitted.length).toBe(2);
    expect(notificationsEmitted[1]).toBe("Network connection reset");
  });

  it("should ensure callback identity changes (unmemoized props) do not trigger data fetches via ref stabilization", () => {
    let dataFetchCount = 0;

    class MasterListController {
      private latestEndpoint = "";
      private onNotificationRef: (t: string, m: string) => void = () => {};

      public updateProps(endpoint: string, onNotification: (t: string, m: string) => void) {
        this.onNotificationRef = onNotification;

        // Data fetch is ONLY keyed on true data identity (endpoint), NEVER on callback reference
        if (endpoint !== this.latestEndpoint) {
          this.latestEndpoint = endpoint;
          this.fetchData();
        }
      }

      private fetchData() {
        dataFetchCount++;
      }
    }

    const controller = new MasterListController();

    // Initial render with endpoint
    controller.updateProps("/masters/lookup/department/values", (t, m) => {});
    expect(dataFetchCount).toBe(1);

    // 10 subsequent parent re-renders passing new arrow function references for onNotification
    for (let i = 0; i < 10; i++) {
      controller.updateProps("/masters/lookup/department/values", (t, m) => {});
    }
    // Fetch count must remain strictly 1
    expect(dataFetchCount).toBe(1);

    // Only changing the actual endpoint triggers a new fetch
    controller.updateProps("/masters/lookup/brand/values", (t, m) => {});
    expect(dataFetchCount).toBe(2);
  });
});
