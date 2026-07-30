/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Autosave & Recovery Engine
 */

import { SAWFEventBus } from "./EventBus.ts";

export class AutosaveEngine {
  private timer: number | null = null;
  private intervalMs: number = 30000; // 30 seconds

  start(onSaveDraft: () => void): void {
    this.stop();
    this.timer = window.setInterval(() => {
      try {
        onSaveDraft();
        SAWFEventBus.publish("studio:autosave_triggered", { timestamp: Date.now() });
      } catch (e) {
        console.error("[AutosaveEngine] Background draft autosave failed:", e);
      }
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
