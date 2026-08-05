/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Discovery Keyboard Manager (SCS-UIX Lookup Rule-001)
 * Standard     : SCS-UIX Lookup Rule-001 — Universal Keyboard & F2 Lookup DNA
 * Author       : Jawahar Ramkripal Mallah & Antigravity AI
 * Version      : 2.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * Rules:
 *   Rule 1 (Empty + F2)     : F2 on empty field opens full lookup dialog (browse mode).
 *   Rule 2 (Partial + F2)   : F2 on text field opens filtered lookup pre-filled with text.
 *   Rule 3 (Typing)         : Typing inline displays live auto-suggestions dropdown.
 *   Rule 4 (Ctrl + F2)      : Ctrl+F2 opens Advanced Multi-Criteria Search modal.
 *
 * Universal Keyboard Standard:
 *   F2  : Open Lookup (unconditional browse/filter)
 *   F3  : Create New (Quick Create)
 *   F4  : Edit Selected / Open Payment
 *   F5  : Refresh Data
 *   F6  : Recent Items / Scan Barcode
 *   Esc : Close Dialog / Cancel
 *   Enter: Select Item
 *   ↑/↓ : Navigate List
 */

export type KeyboardDiscoveryAction =
  | "CONTEXT_DISCOVERY"
  | "ADVANCED_SEARCH"
  | "GLOBAL_DISCOVERY"
  | "SAVED_VIEWS"
  | "QUICK_CREATE"
  | "EDIT_SELECTED"
  | "REFRESH"
  | "RECENT_ITEMS"
  | "CLOSE";

export type KeyboardDiscoveryHandler = (
  action: KeyboardDiscoveryAction,
  context: { activeElement?: HTMLElement; domain?: string; searchText?: string }
) => void;

export class KeyboardDiscoveryManagerService {
  private handlers = new Set<KeyboardDiscoveryHandler>();
  private isListening = false;

  public start(): void {
    if (this.isListening || typeof window === "undefined") return;
    window.addEventListener("keydown", this.handleGlobalKeyDown);
    this.isListening = true;
  }

  public stop(): void {
    if (!this.isListening || typeof window === "undefined") return;
    window.removeEventListener("keydown", this.handleGlobalKeyDown);
    this.isListening = false;
  }

  public subscribe(handler: KeyboardDiscoveryHandler): () => void {
    this.handlers.add(handler);
    if (!this.isListening) {
      this.start();
    }
    return () => {
      this.handlers.delete(handler);
    };
  }

  private handleGlobalKeyDown = (e: KeyboardEvent): void => {
    const activeEl = document.activeElement as HTMLElement | undefined;
    const isInput = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable);
    const inputValue = isInput ? (activeEl as HTMLInputElement).value || "" : "";

    // ── Rule 1 & 4: F2 and Ctrl+F2 Universal Lookup ──────────────────────────
    if (e.key === "F2") {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+F2 -> Advanced Multi-Criteria Search
        this.dispatch("ADVANCED_SEARCH", activeEl, inputValue);
      } else {
        // F2 -> Open Lookup (unconditional: empty = browse all, text = filter)
        this.dispatch("CONTEXT_DISCOVERY", activeEl, inputValue);
      }
    } else if (e.key === "F3") {
      e.preventDefault();
      this.dispatch("QUICK_CREATE", activeEl);
    } else if (e.key === "F4" && !e.altKey) {
      e.preventDefault();
      this.dispatch("EDIT_SELECTED", activeEl);
    } else if (e.key === "F5") {
      // Allow browser hard refresh with Ctrl+F5 or Shift+F5
      if (!e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        this.dispatch("REFRESH", activeEl);
      }
    } else if (e.key === "F6") {
      e.preventDefault();
      this.dispatch("RECENT_ITEMS", activeEl);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      if (e.shiftKey) {
        e.preventDefault();
        this.dispatch("SAVED_VIEWS", activeEl);
      } else {
        e.preventDefault();
        this.dispatch("GLOBAL_DISCOVERY", activeEl);
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      this.dispatch("QUICK_CREATE", activeEl);
    } else if (e.key === "Escape") {
      this.dispatch("CLOSE", activeEl);
    }
  };

  private dispatch(action: KeyboardDiscoveryAction, activeElement?: HTMLElement, searchText?: string): void {
    const context = { activeElement, searchText };
    this.handlers.forEach((h) => {
      try { h(action, context); } catch { /* ignore individual handler errors */ }
    });
  }
}

export const KeyboardDiscoveryManager = new KeyboardDiscoveryManagerService();
