/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Discovery Keyboard Manager
 * Standard     : SMAP Constitution v1.0 — Platform Keyboard DNA
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export type KeyboardDiscoveryAction = "CONTEXT_DISCOVERY" | "GLOBAL_DISCOVERY" | "SAVED_VIEWS" | "QUICK_CREATE" | "CLOSE";

export type KeyboardDiscoveryHandler = (action: KeyboardDiscoveryAction, context: { activeElement?: HTMLElement; domain?: string }) => void;

export class KeyboardDiscoveryManagerService {
  private handlers = new Set<KeyboardDiscoveryHandler>();
  private isListening = false;

  public start(): void {
    if (this.isListening) return;
    window.addEventListener("keydown", this.handleGlobalKeyDown);
    this.isListening = true;
  }

  public stop(): void {
    if (!this.isListening) return;
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

    if (e.key === "F2") {
      e.preventDefault();
      this.dispatch("CONTEXT_DISCOVERY", activeEl);
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

  private dispatch(action: KeyboardDiscoveryAction, activeElement?: HTMLElement): void {
    const context = { activeElement };
    this.handlers.forEach((h) => {
      try { h(action, context); } catch { /* ignore individual handler errors */ }
    });
  }
}

export const KeyboardDiscoveryManager = new KeyboardDiscoveryManagerService();
