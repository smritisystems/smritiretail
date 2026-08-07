/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : SMRITI Workspace Shell (SWS) Architecture v1.0
 * Standard     : ADR-UX-001 | ADR-UX-002 | ADR-UX-003 (FROZEN v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React from "react";
import { SEEFTheme, SEEFDensity } from "../../layout_engine/SEEFTypes";

export type WorkspaceLifecycleState =
  | "Uninitialized"
  | "Initializing"
  | "Ready"
  | "OpeningTab"
  | "TabActivated"
  | "TabSuspended"
  | "Locked"
  | "Error";

export type OverlayType =
  | "none"
  | "command-palette"
  | "notification-center"
  | "lock-screen"
  | "logout-dialog"
  | "session-expired"
  | "quick-create"
  | "help-panel";

export interface NavigationMetadataEntry {
  id: string;
  domain: string;
  module: string;
  label: string;
  icon: string | React.ElementType;
  route: string;
  permission: string;
  priority: number;
  workspace: string;
  featureFlag?: string;
  badgeProvider?: () => { count?: number; status?: "live" | "alert" | "info" };
}

export interface TaskbarEntry {
  tabId: string;
  title: string;
  icon: string;
  isPinned?: boolean;
  hasUnsavedChanges?: boolean;
}

export interface NotificationItem {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  category: "Alerts" | "Sync" | "Approvals" | "System";
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

export interface CommandPaletteProviderItem {
  id: string;
  type: "navigation" | "document" | "action" | "recent" | "report";
  title: string;
  subtitle?: string;
  category: string;
  icon?: string | React.ElementType;
  action: () => void;
  keywords?: string[];
}

export interface WorkspaceShellState {
  lifecycle: WorkspaceLifecycleState;
  activeDomain: string;
  activeTab: string;
  isSidebarOpen: boolean;
  isRailMode: boolean;
  activeOverlay: OverlayType;
  theme: SEEFTheme;
  density: SEEFDensity;
  unreadNotificationCount: number;
  breakpoint: "desktop" | "tablet" | "mobile";
  tenantId?: string;
}
