/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Workspace Shell (SWS) Service Contracts
 * Standard     : ADR-UX-001 | ADR-UX-002 | ADR-UX-003 (FROZEN v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import {
  WorkspaceShellState,
  NavigationMetadataEntry,
  TaskbarEntry,
  NotificationItem,
  CommandPaletteProviderItem,
  OverlayType,
} from "../types/workspace.types";
import { SEEFTheme } from "../../layout_engine/SEEFTypes";

export interface INavigationRegistry {
  register(entry: NavigationMetadataEntry): void;
  unregister(id: string): void;
  getSidebarModules(activeDomain: string, userPermissions?: string[]): NavigationMetadataEntry[];
  getAllRegisteredModules(): NavigationMetadataEntry[];
}

export interface ITaskbarRegistry {
  registerPinned(entry: TaskbarEntry): void;
  unregisterPinned(tabId: string): void;
  getPinnedEntries(): TaskbarEntry[];
}

export interface INotificationService {
  publishNotification(notification: Omit<NotificationItem, "id" | "timestamp" | "read">): void;
  markAsRead(id: string): void;
  markAllAsRead(): void;
  getNotifications(): NotificationItem[];
  getUnreadCount(): number;
  subscribe(listener: (notifications: NotificationItem[]) => void): () => void;
}

export interface IThemeManager {
  resolveTheme(userPreference?: SEEFTheme, tenantOverride?: SEEFTheme): SEEFTheme;
  applyThemeTokens(theme: SEEFTheme): void;
  getCurrentTheme(): SEEFTheme;
}

export interface IOverlayManager {
  openOverlay(overlay: OverlayType): void;
  closeOverlay(): void;
  getActiveOverlay(): OverlayType;
  subscribe(listener: (overlay: OverlayType) => void): () => void;
}

export interface IWorkspaceShellController {
  getState(): WorkspaceShellState;
  setActiveDomain(domain: string): void;
  setActiveTab(tabId: string): void;
  toggleSidebar(open?: boolean): void;
  toggleRailMode(rail?: boolean): void;
  setOverlay(overlay: OverlayType): void;
  setTheme(theme: SEEFTheme): void;
  registerCommandProvider(provider: () => CommandPaletteProviderItem[]): void;
  getCommandItems(): CommandPaletteProviderItem[];
  subscribe(listener: (state: WorkspaceShellState) => void): () => void;
}
