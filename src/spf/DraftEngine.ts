/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : DraftEngine (SPF v1.0 Universal Form Draft Auto-Save Engine)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 1.0.0
 */

import { PlatformEventBus } from "./PlatformEventBus.ts";

export interface FormDraft {
  draftId: string;
  formId: string;
  workspaceId: string;
  data: any;
  updatedAt: number;
}

export class DraftEngine {
  private static STORAGE_PREFIX = "smriti_draft_";
  private static timers: Map<string, NodeJS.Timeout> = new Map();

  public static saveDraftThrottled(formId: string, workspaceId: string, data: any, delayMs = 500): void {
    if (this.timers.has(formId)) {
      clearTimeout(this.timers.get(formId));
    }

    const timer = setTimeout(() => {
      this.saveDraft(formId, workspaceId, data);
      this.timers.delete(formId);
    }, delayMs);

    this.timers.set(formId, timer);
  }

  public static saveDraft(formId: string, workspaceId: string, data: any): void {
    if (typeof window === "undefined") return;
    const draft: FormDraft = {
      draftId: `${formId}_${workspaceId}`,
      formId,
      workspaceId,
      data,
      updatedAt: Date.now()
    };
    try {
      localStorage.setItem(`${this.STORAGE_PREFIX}${formId}`, JSON.stringify(draft));
      PlatformEventBus.emit("DraftSaved", draft);
    } catch (e) {
      console.warn("[DraftEngine] Failed to save draft:", e);
    }
  }

  public static getDraft<T = any>(formId: string): FormDraft | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(`${this.STORAGE_PREFIX}${formId}`);
      if (!raw) return null;
      const draft = JSON.parse(raw) as FormDraft;
      PlatformEventBus.emit("DraftRestored", draft);
      return draft;
    } catch {
      return null;
    }
  }

  public static clearDraft(formId: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(`${this.STORAGE_PREFIX}${formId}`);
    } catch (e) {
      console.warn("[DraftEngine] Failed to clear draft:", e);
    }
  }
}
