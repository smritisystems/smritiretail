/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * Websites     : aitdl.com | erpnbook.com | smritibooks.com
 * Version      : 6.45.2
 * Created      : 2026-09-26
 * Modified     : 2026-09-26
 * Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Description  : Comprehensive Vitest suite for 15-minute inactivity timeout, multi-tab sync, and sleep recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  InactivityTimeoutController,
  DEFAULT_INACTIVITY_TIMEOUT_MS,
  DEFAULT_WARNING_DURATION_MS,
  DEFAULT_INACTIVITY_STORAGE_KEY,
} from "../hooks/useInactivityTimeout.ts";
import { clearAuthSession } from "../lib/apiFetchV1.ts";

class MockDOMEventTarget {
  private listeners: Record<string, Set<(evt: any) => void>> = {};

  addEventListener(type: string, listener: (evt: any) => void) {
    if (!this.listeners[type]) this.listeners[type] = new Set();
    this.listeners[type].add(listener);
  }

  removeEventListener(type: string, listener: (evt: any) => void) {
    if (this.listeners[type]) {
      this.listeners[type].delete(listener);
    }
  }

  dispatchEvent(event: any) {
    const handlers = this.listeners[event.type];
    if (handlers) {
      handlers.forEach((h) => h(event));
    }
    return true;
  }
}

describe("SMRITI Enterprise 15-Minute Session Inactivity Timeout Guard", () => {
  const mockStorage: Record<string, string> = {};
  let mockWindow: any;
  let mockDocument: any;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);

    // Mock localStorage
    (global as any).localStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = String(val);
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      }),
      length: 0,
      key: vi.fn(),
    };

    mockWindow = new MockDOMEventTarget();
    mockDocument = new MockDOMEventTarget();
    mockDocument.visibilityState = "visible";

    (global as any).window = mockWindow;
    (global as any).document = mockDocument;

    (global as any).StorageEvent = class StorageEvent extends Event {
      key: string;
      newValue: string;
      constructor(type: string, init?: any) {
        super(type);
        this.key = init?.key;
        this.newValue = init?.newValue;
      }
    };

    (global as any).KeyboardEvent = class KeyboardEvent extends Event {
      key: string;
      constructor(type: string, init?: any) {
        super(type);
        this.key = init?.key;
      }
    };

    (global as any).MouseEvent = class MouseEvent extends Event {
      constructor(type: string) {
        super(type);
      }
    };

    (global as any).CustomEvent = class CustomEvent extends Event {
      detail: any;
      constructor(type: string, init?: any) {
        super(type);
        this.detail = init?.detail;
      }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should have authoritative 15-minute defaults (900,000ms timeout and 60,000ms warning)", () => {
    expect(DEFAULT_INACTIVITY_TIMEOUT_MS).toBe(15 * 60 * 1000); // 900,000 ms
    expect(DEFAULT_WARNING_DURATION_MS).toBe(60 * 1000);         // 60,000 ms
    expect(DEFAULT_INACTIVITY_STORAGE_KEY).toBe("smriti_last_activity");
  });

  it("should initialize with current timestamp and sync to localStorage on start", () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);

    const onTimeout = vi.fn();
    const controller = new InactivityTimeoutController({
      isEnabled: true,
      onTimeout,
    });

    controller.start();

    const state = controller.getState();
    expect(state.isWarningOpen).toBe(false);
    expect(state.lastActivity).toBe(startTime);
    expect(localStorage.getItem("smriti_last_activity")).toBe(String(startTime));
    expect(onTimeout).not.toHaveBeenCalled();

    controller.destroy();
  });

  it("should record user activity on discrete events and reset warning state", () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);

    const onTimeout = vi.fn();
    const controller = new InactivityTimeoutController({
      isEnabled: true,
      onTimeout,
    });
    controller.start();

    // Fast-forward 5 minutes (300,000 ms)
    vi.advanceTimersByTime(300 * 1000);
    const activeTime = 1000000 + 300 * 1000;
    vi.setSystemTime(activeTime);

    // Simulate keydown user interaction
    window.dispatchEvent(new (global as any).KeyboardEvent("keydown", { key: "Enter" }));

    const state = controller.getState();
    expect(state.lastActivity).toBe(activeTime);
    expect(localStorage.getItem("smriti_last_activity")).toBe(String(activeTime));

    controller.destroy();
  });

  it("should throttle high-frequency events (e.g. mousemove) to avoid storage write flooding", () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);

    const setItemSpy = vi.spyOn(localStorage, "setItem");
    const onTimeout = vi.fn();

    const controller = new InactivityTimeoutController({
      isEnabled: true,
      throttleMs: 1000,
      onTimeout,
    });
    controller.start();

    const initialCalls = setItemSpy.mock.calls.length;

    // Trigger rapid mouse moves within 500ms
    vi.advanceTimersByTime(100);
    vi.setSystemTime(startTime + 100);
    window.dispatchEvent(new (global as any).MouseEvent("mousemove"));

    vi.advanceTimersByTime(100);
    vi.setSystemTime(startTime + 200);
    window.dispatchEvent(new (global as any).MouseEvent("mousemove"));

    vi.advanceTimersByTime(100);
    vi.setSystemTime(startTime + 300);
    window.dispatchEvent(new (global as any).MouseEvent("mousemove"));

    // Throttled: no extra storage writes should have occurred yet within 1000ms
    expect(setItemSpy.mock.calls.length).toBe(initialCalls);

    // Advance past throttle threshold (1000ms)
    vi.advanceTimersByTime(800);
    vi.setSystemTime(startTime + 1100);
    window.dispatchEvent(new (global as any).MouseEvent("mousemove"));

    expect(setItemSpy.mock.calls.length).toBeGreaterThan(initialCalls);

    controller.destroy();
  });

  it("should synchronize activity from other open browser tabs via StorageEvent", () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);

    const onTimeout = vi.fn();
    const controller = new InactivityTimeoutController({
      isEnabled: true,
      onTimeout,
    });
    controller.start();

    // Fast-forward 14 minutes and 10 seconds into warning window (850 seconds)
    vi.advanceTimersByTime(850 * 1000);
    vi.setSystemTime(startTime + 850 * 1000);

    expect(controller.getState().isWarningOpen).toBe(true);

    // Simulate Tab 2 recording user activity at 855 seconds
    const remoteActiveTime = startTime + 855 * 1000;
    window.dispatchEvent(
      new (global as any).StorageEvent("storage", {
        key: "smriti_last_activity",
        newValue: String(remoteActiveTime),
      })
    );

    // Local tab should instantly adopt remote activity timestamp and dismiss warning
    const state = controller.getState();
    expect(state.lastActivity).toBe(remoteActiveTime);
    expect(state.isWarningOpen).toBe(false);

    controller.destroy();
  });

  it("should trigger warning countdown at 14 minutes of inactivity (60s before 15m timeout)", () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);

    const onTimeout = vi.fn();
    const controller = new InactivityTimeoutController({
      isEnabled: true,
      onTimeout,
    });
    controller.start();

    // Advance 13 minutes and 55 seconds (835s) — before warning threshold
    vi.advanceTimersByTime(835 * 1000);
    vi.setSystemTime(startTime + 835 * 1000);

    expect(controller.getState().isWarningOpen).toBe(false);

    // Advance to 14 minutes (840s = 15m - 60s warning window)
    vi.advanceTimersByTime(5 * 1000);
    vi.setSystemTime(startTime + 840 * 1000);

    const warningState = controller.getState();
    expect(warningState.isWarningOpen).toBe(true);
    expect(warningState.remainingSeconds).toBe(60);

    // Advance 10 more seconds — remaining seconds should decrement
    vi.advanceTimersByTime(10 * 1000);
    vi.setSystemTime(startTime + 850 * 1000);

    const updatedState = controller.getState();
    expect(updatedState.isWarningOpen).toBe(true);
    expect(updatedState.remainingSeconds).toBe(50);

    controller.destroy();
  });

  it("should reset timer and dismiss warning when resetTimer() is invoked", () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);

    const onTimeout = vi.fn();
    const controller = new InactivityTimeoutController({
      isEnabled: true,
      onTimeout,
    });
    controller.start();

    // Advance to 14 minutes and 30 seconds (870s)
    vi.advanceTimersByTime(870 * 1000);
    vi.setSystemTime(startTime + 870 * 1000);

    expect(controller.getState().isWarningOpen).toBe(true);
    expect(controller.getState().remainingSeconds).toBe(30);

    // Click 'Stay Logged In' -> resetTimer()
    controller.resetTimer();

    const state = controller.getState();
    expect(state.isWarningOpen).toBe(false);
    expect(state.remainingSeconds).toBe(60);
    expect(state.lastActivity).toBe(startTime + 870 * 1000);
    expect(localStorage.getItem("smriti_last_activity")).toBe(String(startTime + 870 * 1000));

    controller.destroy();
  });

  it("should automatically terminate session and trigger onTimeout when 15 minutes elapse", () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);

    const onTimeout = vi.fn();
    const controller = new InactivityTimeoutController({
      isEnabled: true,
      onTimeout,
    });
    controller.start();

    expect(onTimeout).not.toHaveBeenCalled();

    // Advance 15 minutes (900 seconds)
    vi.advanceTimersByTime(900 * 1000);
    vi.setSystemTime(startTime + 900 * 1000);

    expect(onTimeout).toHaveBeenCalledTimes(1);

    controller.destroy();
  });

  it("should trigger immediate logout upon laptop wake / tab switch if 15 minutes elapsed during sleep", () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);

    const onTimeout = vi.fn();
    const controller = new InactivityTimeoutController({
      isEnabled: true,
      onTimeout,
    });
    controller.start();

    // Simulate machine sleeping for 30 minutes (timers paused, system clock jumped)
    vi.setSystemTime(startTime + 1800 * 1000); // 30 minutes later

    // User opens laptop lid -> document becomes visible
    mockDocument.visibilityState = "visible";
    mockDocument.dispatchEvent(new Event("visibilitychange"));

    // Immediate auto-logout should have fired without waiting for next interval tick
    expect(onTimeout).toHaveBeenCalledTimes(1);

    controller.destroy();
  });

  it("should purge smriti_last_activity when clearAuthSession is called", () => {
    localStorage.setItem("smriti_jwt_token", "jwt-token-abc");
    localStorage.setItem("smriti_last_activity", "123456789");

    expect(localStorage.getItem("smriti_last_activity")).toBe("123456789");

    clearAuthSession("inactivity_timeout");

    expect(localStorage.getItem("smriti_jwt_token")).toBeNull();
    expect(localStorage.getItem("smriti_last_activity")).toBeNull();
  });
});
