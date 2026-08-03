/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Workspace Navigation Engine (WNE)
 * Standard     : SXP Constitution v1.0 / WNG-004 / WNG-005
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * DESIGN: Extends layout_store.tsx (favorites, recents, addToRecentlyUsed).
 *         Extends NavigationRegistry (getSidebar, domain switching).
 *         Does NOT replace navigation_renderer.tsx — WNE is the coordinator API,
 *         the renderer remains the UPR-driven display component.
 *
 * NAVIGATION PHILOSOPHY (FROZEN SWEF v1.0):
 *   Level 1: Domain    (Inventory / Sales / Purchase / CRM / Finance)
 *   Level 2: Workspace (Dashboard / Products / Operations / Planning)
 *   Level 3: Object    (Product Detail / Order Detail / Customer Detail)
 *   Level 4: Action    (Receive / Transfer / Approve / Print)
 *   No workspace may invent a fifth level or skip a level.
 */

import { NavigationRegistry } from "../kernel/upr/navigation/NavigationRegistry.js";
import { WorkspaceRegistry, WorkspaceMetadata } from "./WorkspaceRegistry.js";
import { WorkspaceEventBus } from "./WorkspaceEventBus.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Crumb {
  label: string;
  workspaceId?: string;
  /** True for the current (last) crumb — not clickable */
  isCurrent: boolean;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  workspaceId: string;
}

export interface WorkspaceRoute {
  workspaceId: string;
  params?: Record<string, string>;
  title?: string;
}

// ── Engine ────────────────────────────────────────────────────────────────────

class WorkspaceNavigationEngineService {
  private currentRoute: WorkspaceRoute | null = null;
  private historyStack: WorkspaceRoute[] = [];
  private historyIndex: number = -1;
  private bookmarks: Map<string, string> = new Map(); // workspaceId → label
  private readonly listeners: Set<() => void> = new Set();

  /** Navigate to a workspace. Adds to history stack. */
  public navigate(workspaceId: string, params?: Record<string, string>): void {
    const metadata = WorkspaceRegistry.get(workspaceId);
    const route: WorkspaceRoute = {
      workspaceId: workspaceId.toLowerCase(),
      params,
      title: metadata?.title,
    };

    // Truncate forward history on new navigation
    this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
    this.historyStack.push(route);
    this.historyIndex = this.historyStack.length - 1;
    this.currentRoute = route;

    WorkspaceEventBus.publish("WorkspaceOpened", { workspaceId, params }, workspaceId);
    this.emit();
  }

  public back(): void {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.currentRoute = this.historyStack[this.historyIndex];
      WorkspaceEventBus.publish(
        "WorkspaceOpened",
        { workspaceId: this.currentRoute.workspaceId },
        this.currentRoute.workspaceId
      );
      this.emit();
    }
  }

  public forward(): void {
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyIndex++;
      this.currentRoute = this.historyStack[this.historyIndex];
      WorkspaceEventBus.publish(
        "WorkspaceOpened",
        { workspaceId: this.currentRoute.workspaceId },
        this.currentRoute.workspaceId
      );
      this.emit();
    }
  }

  public getCurrentRoute(): WorkspaceRoute | null {
    return this.currentRoute;
  }

  /**
   * Build breadcrumbs for the current route.
   * Level 1 = Domain > Level 2 = Workspace > Level 3 = Object (from params)
   */
  public getBreadcrumbs(): Crumb[] {
    const crumbs: Crumb[] = [{ label: "Home", workspaceId: "launchpad", isCurrent: false }];
    if (!this.currentRoute) return crumbs;

    const meta = WorkspaceRegistry.get(this.currentRoute.workspaceId);
    if (meta) {
      const domain = NavigationRegistry.getDomain(meta.domainId);
      if (domain) {
        crumbs.push({ label: domain.label, workspaceId: meta.domainId, isCurrent: false });
      }
      crumbs.push({ label: meta.title, workspaceId: meta.id, isCurrent: true });
    }

    // Level 3: object from params (e.g. { productName: 'Nike Air Max' })
    if (this.currentRoute.params?.objectTitle) {
      const last = crumbs[crumbs.length - 1];
      last.isCurrent = false;
      crumbs.push({ label: this.currentRoute.params.objectTitle, isCurrent: true });
    }

    return crumbs;
  }

  /** Switch active business domain — updates sidebar via NavigationRegistry */
  public switchDomain(domainId: string): void {
    const sidebar = NavigationRegistry.getSidebar(domainId);
    const defaultWorkspaceId = sidebar.domain?.defaultWorkspaceId;
    if (defaultWorkspaceId) {
      this.navigate(defaultWorkspaceId);
    }
  }

  public pin(workspaceId: string): void {
    this.bookmark(workspaceId, WorkspaceRegistry.get(workspaceId)?.title ?? workspaceId);
  }

  public bookmark(workspaceId: string, label: string): void {
    this.bookmarks.set(workspaceId.toLowerCase(), label);
    this.emit();
  }

  public getBookmarks(): Array<{ workspaceId: string; label: string }> {
    return Array.from(this.bookmarks.entries()).map(([workspaceId, label]) => ({
      workspaceId,
      label,
    }));
  }

  public getRecents(n: number = 10): WorkspaceMetadata[] {
    return this.historyStack
      .slice()
      .reverse()
      .slice(0, n)
      .map((r) => WorkspaceRegistry.get(r.workspaceId))
      .filter((m): m is WorkspaceMetadata => m !== undefined);
  }

  /**
   * Resolve a deep link URL to a WorkspaceRoute.
   * Format: smriti://workspace/{workspaceId}?key=value
   */
  public resolveDeepLink(url: string): WorkspaceRoute | null {
    try {
      const parsed = new URL(url.replace("smriti://", "https://smriti.internal/"));
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "workspace" && parts[1]) {
        const params: Record<string, string> = {};
        parsed.searchParams.forEach((v, k) => { params[k] = v; });
        return { workspaceId: parts[1], params };
      }
    } catch {
      // ignore malformed URLs
    }
    return null;
  }

  /**
   * Bottom nav items for the phone breakpoint — mode-filtered.
   * Returns max 5 items from the current domain's workspaces.
   */
  public getBottomNavItems(): NavItem[] {
    const domainId = this.currentRoute
      ? WorkspaceRegistry.get(this.currentRoute.workspaceId)?.domainId
      : undefined;

    const workspaces = domainId
      ? WorkspaceRegistry.getByDomain(domainId)
      : WorkspaceRegistry.getAll();

    return workspaces.slice(0, 5).map((w) => ({
      id: w.id,
      label: w.title,
      icon: w.icon,
      workspaceId: w.id,
    }));
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export const WorkspaceNavigationEngine = new WorkspaceNavigationEngineService();
