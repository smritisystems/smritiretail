/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { GstDrawer } from "./drawers/GstDrawer";
import { TransportDrawer } from "./drawers/TransportDrawer";

export interface DrawerPluginProps {
  data: any;
  onSave: (result: any) => void;
  onClose: () => void;
}

export interface DrawerDefinition {
  id: string;
  title: string;
  icon: string;
  component: React.FC<DrawerPluginProps>;
}

export class DrawerRegistry {
  private static drawers: Map<string, DrawerDefinition> = new Map();

  public static register(drawer: DrawerDefinition): void {
    this.drawers.set(drawer.id.toLowerCase(), drawer);
  }

  public static get(id: string): DrawerDefinition | undefined {
    return this.drawers.get(id.toLowerCase());
  }

  public static getAll(): DrawerDefinition[] {
    return Array.from(this.drawers.values());
  }
}

// Initial Core Drawer Registrations
DrawerRegistry.register({
  id: "gst",
  title: "GSTIN & Tax Details",
  icon: "receipt",
  component: GstDrawer
});

DrawerRegistry.register({
  id: "transport",
  title: "Logistics & E-Way Bill",
  icon: "local_shipping",
  component: TransportDrawer
});
