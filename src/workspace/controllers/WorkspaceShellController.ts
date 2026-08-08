/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Workspace Shell Controller (ADR-UX-003 Compliant)
 * Standard     : ADR-UX-003 — SMRITI Workspace Shell Architecture
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import {
  WorkspaceShellState,
  CommandPaletteProviderItem,
  OverlayType,
} from "../types/workspace.types";
import { IWorkspaceShellController } from "../interfaces/ISWSContracts";
import { themeManager } from "../services/ThemeManager";
import { notificationService } from "../services/NotificationService";
import { overlayService } from "../services/OverlayService";
import { navigationRegistry } from "../registries/NavigationRegistry";
import { SEEFTheme } from "../../layout_engine/SEEFTypes";
import { workspaceEventBus } from "../events/workspaceEvents";

class WorkspaceShellControllerImpl implements IWorkspaceShellController {
  private state: WorkspaceShellState = {
    lifecycle: "Ready",
    activeDomain: "sales",
    activeTab: "launchpad",
    isSidebarOpen: true,
    isRailMode: false,
    activeOverlay: "none",
    theme: "enterprise",
    density: "comfortable",
    unreadNotificationCount: 0,
    breakpoint: "desktop",
  };

  private listeners: Set<(state: WorkspaceShellState) => void> = new Set();
  private commandProviders: Set<() => CommandPaletteProviderItem[]> = new Set();

  constructor() {
    this.init();
  }

  private init(): void {
    this.state.theme = themeManager.getCurrentTheme();
    this.state.unreadNotificationCount = notificationService.getUnreadCount();

    notificationService.subscribe(() => {
      this.state.unreadNotificationCount = notificationService.getUnreadCount();
      this.notify();
    });

    overlayService.subscribe((overlay) => {
      this.state.activeOverlay = overlay;
      this.notify();
    });

    this.registerDefaultCommandProviders();
  }

  private registerDefaultCommandProviders(): void {
    this.registerCommandProvider(() => {
      const modules = navigationRegistry.getAllRegisteredModules();
      return modules.map((m) => ({
        id: `cmd-nav-${m.id}`,
        type: "navigation",
        title: `Go to ${m.label}`,
        subtitle: `Domain: ${m.domain.toUpperCase()} • Route: ${m.route}`,
        category: "Navigation",
        icon: m.icon,
        action: () => {
          this.setActiveDomain(m.domain);
          this.setActiveTab(m.workspace);
          overlayService.closeOverlay();
        },
        keywords: [m.label, m.domain, m.module, "navigate", "open"],
      }));
    });
  }

  public getState(): WorkspaceShellState {
    return { ...this.state };
  }

  public setActiveDomain(domain: string): void {
    this.state.activeDomain = domain;
    this.notify();
    workspaceEventBus.publish("WorkspaceActivated", { domain });
  }

  public setActiveTab(tabId: string): void {
    this.state.activeTab = tabId;
    this.notify();
    workspaceEventBus.publish("WorkspaceActivated", { tabId });
  }

  public toggleSidebar(open?: boolean): void {
    this.state.isSidebarOpen = open !== undefined ? open : !this.state.isSidebarOpen;
    this.notify();
  }

  public toggleRailMode(rail?: boolean): void {
    this.state.isRailMode = rail !== undefined ? rail : !this.state.isRailMode;
    this.notify();
  }

  public setOverlay(overlay: OverlayType): void {
    overlayService.openOverlay(overlay);
  }

  public setTheme(theme: SEEFTheme): void {
    themeManager.applyThemeTokens(theme);
    this.state.theme = theme;
    this.notify();
  }

  public registerCommandProvider(provider: () => CommandPaletteProviderItem[]): void {
    this.commandProviders.add(provider);
  }

  public getCommandItems(): CommandPaletteProviderItem[] {
    const items: CommandPaletteProviderItem[] = [];
    this.commandProviders.forEach((provider) => {
      try {
        items.push(...provider());
      } catch (err) {
        console.error("Error fetching command items from provider:", err);
      }
    });
    return items;
  }

  public subscribe(listener: (state: WorkspaceShellState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.getState()));
  }
}

export const workspaceShellController = new WorkspaceShellControllerImpl();
