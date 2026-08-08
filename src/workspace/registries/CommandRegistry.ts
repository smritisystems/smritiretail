/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : Command Registry Authority (SCA-001 & SCA-003 Compliant)
 * Standard     : ADR-UX-004 Command System Architecture
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 5.3.0
 */

import { CommandPaletteProviderItem } from "../types/workspace.types";

export type CommandProviderFn = () => CommandPaletteProviderItem[];

export interface ICommandRegistry {
  registerProvider(id: string, provider: CommandProviderFn): void;
  unregisterProvider(id: string): void;
  getAllItems(): CommandPaletteProviderItem[];
  search(query: string): CommandPaletteProviderItem[];
  getProviderCount(): number;
}

class CommandRegistryImplementation implements ICommandRegistry {
  private providers: Map<string, CommandProviderFn> = new Map();

  constructor() {
    this.initDefaultProviders();
  }

  private initDefaultProviders(): void {
    // 1. Module Navigation Provider
    this.registerProvider("modules", () => [
      { id: "nav-home", type: "navigation", title: "SMRITI Launchpad", category: "Modules", icon: "Grid", action: () => {} },
      { id: "nav-pos", type: "navigation", title: "Point of Sale (POS)", category: "Modules", icon: "ShoppingCart", action: () => {} },
      { id: "nav-sales", type: "navigation", title: "Sales Studio", category: "Modules", icon: "Receipt", action: () => {} },
      { id: "nav-purchase", type: "navigation", title: "Purchase Studio", category: "Modules", icon: "Package", action: () => {} },
      { id: "nav-crm", type: "navigation", title: "CRM Studio", category: "Modules", icon: "Users", action: () => {} },
      { id: "nav-inventory", type: "navigation", title: "Item Master & Inventory", category: "Modules", icon: "Layers", action: () => {} },
      { id: "nav-reports", type: "navigation", title: "BI Reporting Studio", category: "Modules", icon: "TrendingUp", action: () => {} },
      { id: "nav-admin", type: "navigation", title: "System Compliance & Settings", category: "Modules", icon: "Settings", action: () => {} },
    ]);

    // 2. Recent Actions Provider
    this.registerProvider("recent", () => [
      { id: "rec-1", type: "recent", title: "Executive Hub", category: "Recent", icon: "Grid", action: () => {} },
      { id: "rec-2", type: "recent", title: "Billing Desk", category: "Recent", icon: "Receipt", action: () => {} },
    ]);

    // 3. Quick Actions Provider
    this.registerProvider("actions", () => [
      { id: "act-new-invoice", type: "action", title: "Create New Sales Invoice", category: "Actions", icon: "Receipt", shortcut: "Ctrl+N", action: () => {} },
      { id: "act-new-customer", type: "action", title: "Register New Customer", category: "Actions", icon: "Users", shortcut: "Alt+C", action: () => {} },
      { id: "act-new-item", type: "action", title: "Add New Product / SKU", category: "Actions", icon: "Package", shortcut: "Alt+I", action: () => {} },
      { id: "act-lock-session", type: "action", title: "Lock Workspace Session", category: "Actions", icon: "ShieldCheck", shortcut: "Ctrl+L", action: () => {} },
    ]);

    // 4. Reports Provider
    this.registerProvider("reports", () => [
      { id: "rpt-daily-sales", type: "report", title: "Daily Sales Summary Report", category: "Reports", icon: "TrendingUp", action: () => {} },
      { id: "rpt-stock-val", type: "report", title: "Stock Valuation Ledger", category: "Reports", icon: "Layers", action: () => {} },
      { id: "rpt-gst-return", type: "report", title: "GSTR-3B Tax Summary", category: "Reports", icon: "FileText", action: () => {} },
    ]);
  }

  public registerProvider(id: string, provider: CommandProviderFn): void {
    this.providers.set(id, provider);
  }

  public unregisterProvider(id: string): void {
    this.providers.delete(id);
  }

  public getProviderCount(): number {
    return this.providers.size;
  }

  public getAllItems(): CommandPaletteProviderItem[] {
    const allItems: CommandPaletteProviderItem[] = [];
    for (const providerFn of this.providers.values()) {
      try {
        allItems.push(...providerFn());
      } catch (err) {
        console.error("[CommandRegistry] Provider error:", err);
      }
    }
    return allItems;
  }

  public search(query: string): CommandPaletteProviderItem[] {
    const trimmed = query.trim().toLowerCase();
    const items = this.getAllItems();
    if (!trimmed) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(trimmed) ||
        (item.category && item.category.toLowerCase().includes(trimmed)) ||
        (item.keywords && item.keywords.some((k) => k.toLowerCase().includes(trimmed)))
    );
  }
}

export const CommandRegistry = new CommandRegistryImplementation();
