/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : PlatformServices (SPF v1.0 Cross-Cutting Utilities)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 1.0.0
 */

export class ClipboardService {
  public static async copyText(text: string): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.clipboard) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  public static async readText(): Promise<string> {
    if (typeof navigator === "undefined" || !navigator.clipboard) return "";
    try {
      return await navigator.clipboard.readText();
    } catch {
      return "";
    }
  }
}

export class KeyboardShortcutManager {
  private static handlers: Map<string, (e: KeyboardEvent) => void> = new Map();

  public static register(shortcut: string, handler: (e: KeyboardEvent) => void): void {
    this.handlers.set(shortcut.toLowerCase(), handler);
  }

  public static unregister(shortcut: string): void {
    this.handlers.delete(shortcut.toLowerCase());
  }
}

export class GlobalBusyIndicator {
  private static activeCount = 0;
  private static listeners: Set<(isBusy: boolean) => void> = new Set();

  public static show(): void {
    this.activeCount++;
    this.notify();
  }

  public static hide(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
    this.notify();
  }

  public static subscribe(callback: (isBusy: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private static notify(): void {
    const busy = this.activeCount > 0;
    this.listeners.forEach((fn) => fn(busy));
  }
}
