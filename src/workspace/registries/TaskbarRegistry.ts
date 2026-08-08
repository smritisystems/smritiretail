/**
 * Project      : SMRITI Retail OS
 * Module       : Taskbar Registry Authority (ADR-UX-003 Compliant)
 * Standard     : ADR-UX-003 — SMRITI Workspace Shell Architecture
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { TaskbarEntry } from "../types/workspace.types";
import { ITaskbarRegistry } from "../interfaces/ISWSContracts";

class TaskbarRegistryImpl implements ITaskbarRegistry {
  private pinnedEntries: Map<string, TaskbarEntry> = new Map();

  constructor() {
    this.seedDefaultPinned();
  }

  private seedDefaultPinned(): void {
    const defaults: TaskbarEntry[] = [
      { tabId: "launchpad", title: "Home", icon: "home", isPinned: true },
      { tabId: "pos", title: "Billing Desk", icon: "point_of_sale", isPinned: true },
      { tabId: "dashboard", title: "Executive Hub", icon: "dashboard", isPinned: true },
      { tabId: "sales", title: "Sales Studio", icon: "receipt_long", isPinned: true }
    ];

    defaults.forEach(item => this.pinnedEntries.set(item.tabId, item));
  }

  public registerPinned(entry: TaskbarEntry): void {
    this.pinnedEntries.set(entry.tabId, { ...entry, isPinned: true });
  }

  public unregisterPinned(tabId: string): void {
    this.pinnedEntries.delete(tabId);
  }

  public getPinnedEntries(): TaskbarEntry[] {
    return Array.from(this.pinnedEntries.values());
  }
}

export const taskbarRegistry = new TaskbarRegistryImpl();
