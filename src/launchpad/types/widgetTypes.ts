/**
 * Project      : SMRITI Retail OS
 * Module       : Widget Engine Types (Rule SLP-002 & SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import { WorkspaceZoneId } from "./launchpadTypes.ts";

export interface LaunchpadWidgetPluginProps {
  currentUser?: { role: string; name: string } | null;
  onSelectTab: (tabId: string) => void;
}

export interface LaunchpadWidgetPlugin {
  id: string;
  title: string;
  zone: WorkspaceZoneId;
  targetRoles: string[];
  orderIndex?: number;
  renderWidget: (props: LaunchpadWidgetPluginProps) => React.ReactElement;
}
