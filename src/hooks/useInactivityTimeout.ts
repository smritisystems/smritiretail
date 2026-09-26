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
 * Description  : Enterprise Inactivity Timeout Controller and React Hook with Multi-Tab Sync & Sleep Recovery
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface UseInactivityTimeoutOptions {
  /**
   * Inactivity timeout duration in milliseconds.
   * Standard default: 15 minutes = 15 * 60 * 1000 = 900,000 ms.
   */
  timeoutMs?: number;

  /**
   * Warning countdown duration in milliseconds prior to timeout.
   * Standard default: 60 seconds = 60 * 1000 = 60,000 ms.
   */
  warningDurationMs?: number;

  /**
   * Whether inactivity tracking is currently active (e.g. true when user is authenticated).
   */
  isEnabled?: boolean;

  /**
   * Callback fired when inactivity timeout expires and session must be terminated.
   */
  onTimeout: () => void;

  /**
   * Storage key used to coordinate activity timestamps across browser tabs.
   * Default: "smriti_last_activity".
   */
  storageKey?: string;

  /**
   * Throttle duration for high-frequency events (e.g. mousemove) in milliseconds.
   * Default: 1,000 ms.
   */
  throttleMs?: number;
}

export interface InactivityState {
  isWarningOpen: boolean;
  remainingSeconds: number;
  lastActivity: number;
}

export interface UseInactivityTimeoutReturn extends InactivityState {
  resetTimer: () => void;
}

export const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_WARNING_DURATION_MS = 60 * 1000;         // 60 seconds
export const DEFAULT_INACTIVITY_STORAGE_KEY = "smriti_last_activity";
export const DEFAULT_THROTTLE_MS = 1000;

/**
 * Pure TypeScript Inactivity Controller managing timing, event listeners,
 * cross-tab synchronization via localStorage, and sleep/wake recovery.
 */
export class InactivityTimeoutController {
  public timeoutMs: number;
  public warningDurationMs: number;
  public storageKey: string;
  public throttleMs: number;
  private onTimeout: () => void;

  private isRunning: boolean = false;
  private lastActivity: number;
  private lastThrottledWrite: number = 0;
  private isWarningOpen: boolean = false;
  private remainingSeconds: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(state: InactivityState) => void> = new Set();

  // Bound event handlers for DOM registration/cleanup
  private handleImmediateActivityBound: () => void;
  private handleThrottledActivityBound: () => void;
  private handleStorageEventBound: (e: StorageEvent) => void;
  private handleVisibilityOrFocusBound: () => void;

  constructor(options: UseInactivityTimeoutOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_INACTIVITY_TIMEOUT_MS;
    this.warningDurationMs = options.warningDurationMs ?? DEFAULT_WARNING_DURATION_MS;
    this.storageKey = options.storageKey ?? DEFAULT_INACTIVITY_STORAGE_KEY;
    this.throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
    this.onTimeout = options.onTimeout;

    this.remainingSeconds = Math.ceil(this.warningDurationMs / 1000);

    let initialTime = Date.now();
    if (typeof window !== "undefined") {
      try {
        const stored = Number(localStorage.getItem(this.storageKey));
        if (!isNaN(stored) && stored > 0) {
          initialTime = stored;
        }
      } catch {}
    }
    this.lastActivity = initialTime;

    this.handleImmediateActivityBound = () => this.recordActivity(true);
    this.handleThrottledActivityBound = () => this.recordActivity(false);
    this.handleStorageEventBound = (e: StorageEvent) => this.handleStorageEvent(e);
    this.handleVisibilityOrFocusBound = () => this.handleVisibilityOrFocus();
  }

  public updateOnTimeout(onTimeout: () => void) {
    this.onTimeout = onTimeout;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const now = Date.now();
    this.lastThrottledWrite = now;
    try {
      if (typeof window !== "undefined") {
        const stored = Number(localStorage.getItem(this.storageKey));
        if (!isNaN(stored) && stored > 0 && stored <= now) {
          this.lastActivity = stored;
        } else {
          localStorage.setItem(this.storageKey, String(now));
          this.lastActivity = now;
        }
      }
    } catch {
      this.lastActivity = now;
    }

    if (typeof window !== "undefined") {
      const discreteEvents = ["mousedown", "pointerdown", "keydown", "touchstart", "click"];
      const throttledEvents = ["mousemove", "touchmove", "scroll", "wheel"];

      discreteEvents.forEach((evt) => {
        window.addEventListener(evt, this.handleImmediateActivityBound, { passive: true });
      });

      throttledEvents.forEach((evt) => {
        window.addEventListener(evt, this.handleThrottledActivityBound, { passive: true });
      });

      window.addEventListener("storage", this.handleStorageEventBound);
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", this.handleVisibilityOrFocusBound);
      }
      window.addEventListener("focus", this.handleVisibilityOrFocusBound);
    }

    this.intervalId = setInterval(() => {
      this.evaluateInactivity();
    }, 1000);

    this.notify();
  }

  public stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (typeof window !== "undefined") {
      const discreteEvents = ["mousedown", "pointerdown", "keydown", "touchstart", "click"];
      const throttledEvents = ["mousemove", "touchmove", "scroll", "wheel"];

      discreteEvents.forEach((evt) => {
        window.removeEventListener(evt, this.handleImmediateActivityBound);
      });

      throttledEvents.forEach((evt) => {
        window.removeEventListener(evt, this.handleThrottledActivityBound);
      });

      window.removeEventListener("storage", this.handleStorageEventBound);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", this.handleVisibilityOrFocusBound);
      }
      window.removeEventListener("focus", this.handleVisibilityOrFocusBound);
    }

    this.isWarningOpen = false;
    this.notify();
  }

  public resetTimer() {
    const now = Date.now();
    this.lastActivity = now;
    this.isWarningOpen = false;
    this.remainingSeconds = Math.ceil(this.warningDurationMs / 1000);

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(this.storageKey, String(now));
      }
    } catch {}

    this.notify();
  }

  public recordActivity(immediate = false) {
    if (!this.isRunning) return;

    const now = Date.now();
    this.lastActivity = now;

    if (this.isWarningOpen) {
      this.isWarningOpen = false;
      this.remainingSeconds = Math.ceil(this.warningDurationMs / 1000);
    }

    if (immediate || now - this.lastThrottledWrite >= this.throttleMs) {
      this.lastThrottledWrite = now;
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(this.storageKey, String(now));
        }
      } catch {}
    }

    this.notify();
  }

  public handleStorageEvent(e: StorageEvent) {
    if (e.key === this.storageKey && e.newValue) {
      const remoteTime = Number(e.newValue);
      if (!isNaN(remoteTime) && remoteTime > this.lastActivity) {
        this.lastActivity = remoteTime;
        this.isWarningOpen = false;
        this.remainingSeconds = Math.ceil(this.warningDurationMs / 1000);
        this.notify();
      }
    }
  }

  public handleVisibilityOrFocus() {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      this.evaluateInactivity();
    }
  }

  public evaluateInactivity() {
    if (!this.isRunning) return;

    const now = Date.now();

    // Check if another tab recorded more recent activity
    try {
      if (typeof window !== "undefined") {
        const stored = Number(localStorage.getItem(this.storageKey));
        if (!isNaN(stored) && stored > this.lastActivity) {
          this.lastActivity = stored;
        }
      }
    } catch {}

    const elapsed = now - this.lastActivity;

    if (elapsed >= this.timeoutMs) {
      this.isWarningOpen = false;
      this.notify();
      this.onTimeout();
      return;
    }

    const remainingMs = this.timeoutMs - elapsed;
    if (remainingMs <= this.warningDurationMs) {
      const secs = Math.max(1, Math.ceil(remainingMs / 1000));
      this.isWarningOpen = true;
      this.remainingSeconds = secs;
      this.notify();
    } else {
      if (this.isWarningOpen) {
        this.isWarningOpen = false;
        this.remainingSeconds = Math.ceil(this.warningDurationMs / 1000);
        this.notify();
      }
    }
  }

  public getState(): InactivityState {
    return {
      isWarningOpen: this.isWarningOpen,
      remainingSeconds: this.remainingSeconds,
      lastActivity: this.lastActivity,
    };
  }

  public subscribe(listener: (state: InactivityState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  public destroy() {
    this.stop();
    this.listeners.clear();
  }
}

/**
 * Authoritative React Hook for session inactivity auto-logout monitoring.
 */
export function useInactivityTimeout(options: UseInactivityTimeoutOptions): UseInactivityTimeoutReturn {
  const {
    timeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS,
    warningDurationMs = DEFAULT_WARNING_DURATION_MS,
    isEnabled = true,
    onTimeout,
    storageKey = DEFAULT_INACTIVITY_STORAGE_KEY,
    throttleMs = DEFAULT_THROTTLE_MS,
  } = options;

  const [state, setState] = useState<InactivityState>(() => ({
    isWarningOpen: false,
    remainingSeconds: Math.ceil(warningDurationMs / 1000),
    lastActivity: Date.now(),
  }));

  const controllerRef = useRef<InactivityTimeoutController | null>(null);

  useEffect(() => {
    const controller = new InactivityTimeoutController({
      timeoutMs,
      warningDurationMs,
      isEnabled,
      onTimeout,
      storageKey,
      throttleMs,
    });
    controllerRef.current = controller;

    const unsubscribe = controller.subscribe((nextState) => {
      setState(nextState);
    });

    if (isEnabled) {
      controller.start();
    }

    return () => {
      unsubscribe();
      controller.destroy();
    };
  }, [isEnabled, timeoutMs, warningDurationMs, storageKey, throttleMs]);

  useEffect(() => {
    controllerRef.current?.updateOnTimeout(onTimeout);
  }, [onTimeout]);

  const resetTimer = useCallback(() => {
    controllerRef.current?.resetTimer();
  }, []);

  return {
    ...state,
    resetTimer,
  };
}
