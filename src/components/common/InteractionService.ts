/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : Universal Interaction Service (SIF Standard v1.0 Facade)
 * Standard     : SIF-001 (Universal Interaction Mandate) & Rule PBC-001
 * Author       : Jawahar Ramkripal Mallah
 * Document Type: SMRITI Constitutional Standard
 * Ownership    : SMRITI Retail OS Architecture Team
 * Copyright    : © Jawahar Ramkripal Mallah. All Rights Reserved.
 *
 * SIF Compliance Declaration
 * SIF Compatible : Yes
 * Surface        : Declarative Surface Facade Service
 * Interaction    : InteractionService.*
 * Accessibility  : PASS
 * Keyboard       : PASS
 */

import React from "react";
import { SEEFDialogMode } from "../../layout_engine/SEEFTypes.ts";

export interface ConfirmOptions {
  title?: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger" | "success" | "warning";
}

export interface AlertOptions {
  title?: string;
  message: string | React.ReactNode;
  buttonLabel?: string;
  variant?: "info" | "warning" | "error" | "success";
}

export interface DrawerOptions {
  title: string;
  subtitle?: string;
  width?: number | string;
  content: React.ReactNode;
  footer?: React.ReactNode;
}

export interface WizardOptions {
  title: string;
  subtitle?: string;
  stepsCount: number;
  width?: number | string;
  content: React.ReactNode;
  footer?: React.ReactNode;
}

export interface AIOptions {
  title: string;
  mode?: "inspector" | "chat" | "wizard";
  content: React.ReactNode;
}

export interface PreviewOptions {
  title: string;
  content: React.ReactNode;
  footer?: React.ReactNode;
}

export interface NotifyOptions {
  message: string;
  type?: "info" | "success" | "warning" | "error";
  duration?: number;
}

export interface ProgressOptions {
  title: string;
  progressPercent: number;
  statusMessage?: string;
}

export interface LoadingOptions {
  title?: string;
  message?: string;
}

export interface ErrorOptions {
  title?: string;
  errorCode?: string;
  errorMessage: string;
}

export interface ActiveInteractionState {
  id: string;
  type: "confirm" | "alert" | "drawer" | "wizard" | "ai" | "preview" | "loading" | "error";
  mode: SEEFDialogMode;
  open: boolean;
  title?: string;
  subtitle?: string;
  width?: number | string;
  content?: React.ReactNode;
  footer?: React.ReactNode;
  resolvePromise?: (val: any) => void;
}

type Listener = (state: ActiveInteractionState | null) => void;

class InteractionServiceManager {
  private activeState: ActiveInteractionState | null = null;
  private listeners: Set<Listener> = new Set();

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange() {
    this.listeners.forEach((l) => l(this.activeState));
  }

  public getState(): ActiveInteractionState | null {
    return this.activeState;
  }

  public close() {
    if (this.activeState) {
      if (this.activeState.resolvePromise) {
        this.activeState.resolvePromise(false);
      }
      this.activeState = null;
      this.emitChange();
    }
  }

  public confirm(opts: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.activeState = {
        id: `confirm-${Date.now()}`,
        type: "confirm",
        mode: "centered",
        open: true,
        title: opts.title || "Confirm Action",
        width: 448,
        content: opts.message,
        resolvePromise: resolve
      };
      this.emitChange();
    });
  }

  public alert(opts: AlertOptions): Promise<void> {
    return new Promise((resolve) => {
      this.activeState = {
        id: `alert-${Date.now()}`,
        type: "alert",
        mode: "centered",
        open: true,
        title: opts.title || "System Notification",
        width: 448,
        content: opts.message,
        resolvePromise: resolve
      };
      this.emitChange();
    });
  }

  public drawer(opts: DrawerOptions): void {
    this.activeState = {
      id: `drawer-${Date.now()}`,
      type: "drawer",
      mode: "right-panel",
      open: true,
      title: opts.title,
      subtitle: opts.subtitle,
      width: opts.width || 560,
      content: opts.content,
      footer: opts.footer
    };
    this.emitChange();
  }

  public wizard(opts: WizardOptions): void {
    this.activeState = {
      id: `wizard-${Date.now()}`,
      type: "wizard",
      mode: "centered",
      open: true,
      title: opts.title,
      subtitle: opts.subtitle,
      width: opts.width || 896,
      content: opts.content,
      footer: opts.footer
    };
    this.emitChange();
  }

  public ai(opts: AIOptions): void {
    const mode: SEEFDialogMode = opts.mode === "chat" ? "split-view" : "right-panel";
    this.activeState = {
      id: `ai-${Date.now()}`,
      type: "ai",
      mode,
      open: true,
      title: opts.title || "SMRITI AI Advisory Inspector",
      width: 480,
      content: opts.content
    };
    this.emitChange();
  }

  public preview(opts: PreviewOptions): void {
    this.activeState = {
      id: `preview-${Date.now()}`,
      type: "preview",
      mode: "fullscreen",
      open: true,
      title: opts.title,
      content: opts.content,
      footer: opts.footer
    };
    this.emitChange();
  }

  public notify(opts: NotifyOptions): void {
    // Delegates to Toast Stream
    console.log(`[SIF Toast Notify ${opts.type || "info"}]:`, opts.message);
  }

  public progress(opts: ProgressOptions): void {
    console.log(`[SIF Progress ${opts.progressPercent}%]:`, opts.title, opts.statusMessage);
  }

  public loading(opts: LoadingOptions): void {
    this.activeState = {
      id: `loading-${Date.now()}`,
      type: "loading",
      mode: "centered",
      open: true,
      title: opts.title || "Processing Request...",
      width: 400,
      content: opts.message || "Please wait while the system completes the transaction."
    };
    this.emitChange();
  }

  public error(opts: ErrorOptions): void {
    this.activeState = {
      id: `error-${Date.now()}`,
      type: "error",
      mode: "centered",
      open: true,
      title: opts.title || `Error ${opts.errorCode || "SIF-500"}`,
      width: 448,
      content: opts.errorMessage
    };
    this.emitChange();
  }
}

export const InteractionService = new InteractionServiceManager();
