/**
 * Project      : SMRITI Retail OS
 * Module       : Zone-Based Widget Registry (Rule SLP-002 & SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import { LaunchpadWidgetPlugin } from "../types/widgetTypes.ts";
import { WorkspaceZoneId } from "../types/launchpadTypes.ts";

class WidgetRegistryImpl {
  private widgets: Map<string, LaunchpadWidgetPlugin> = new Map();

  public register(plugin: LaunchpadWidgetPlugin): void {
    this.widgets.set(plugin.id, plugin);
  }

  public getWidgetsForZone(
    zone: WorkspaceZoneId,
    userRole?: string
  ): LaunchpadWidgetPlugin[] {
    const list = Array.from(this.widgets.values()).filter((w) => w.zone === zone);
    if (!userRole) return list;

    const normalizedRole = userRole.toLowerCase();
    return list.filter(
      (w) =>
        w.targetRoles.includes("*") ||
        w.targetRoles.some((r) => normalizedRole.includes(r.toLowerCase()))
    ).sort((a, b) => (a.orderIndex || 99) - (b.orderIndex || 99));
  }

  public getAll(): LaunchpadWidgetPlugin[] {
    return Array.from(this.widgets.values());
  }
}

export const WidgetRegistry = new WidgetRegistryImpl();
