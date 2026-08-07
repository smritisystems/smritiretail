/**
 * Project      : SMRITI Retail OS
 * Module       : Navigation Registry Authority (NRA-001 / ADR-UX-002 Compliant)
 * Standard     : ADR-UX-002 — Enterprise Navigation Framework
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { NavigationMetadataEntry } from "../types/workspace.types";
import { INavigationRegistry } from "../interfaces/ISWSContracts";

class NavigationRegistryImpl implements INavigationRegistry {
  private registry: Map<string, NavigationMetadataEntry> = new Map();

  constructor() {
    this.seedDefaultNavigation();
  }

  private seedDefaultNavigation(): void {
    const defaults: NavigationMetadataEntry[] = [
      // Sales & POS Domain
      { id: "launchpad", domain: "sales", module: "home", label: "SMRITI Launchpad", icon: "grid_view", route: "/", permission: "read:launchpad", priority: 1, workspace: "launchpad" },
      { id: "billing", domain: "sales", module: "billing", label: "Billing ⭐", icon: "credit_card", route: "/sales/billing", permission: "read:billing", priority: 2, workspace: "billing" },
      { id: "sales-invoices", domain: "sales", module: "sales-invoices", label: "Invoices", icon: "receipt_long", route: "/sales/invoices", permission: "read:sales", priority: 3, workspace: "sales-invoices" },
      { id: "sales-returns", domain: "sales", module: "sales-returns", label: "Returns", icon: "settings_backup_restore", route: "/sales/returns", permission: "read:sales-returns", priority: 4, workspace: "sales-returns" },
      { id: "sales-orders", domain: "sales", module: "sales-orders", label: "Orders", icon: "clipboard_list", route: "/sales/orders", permission: "read:sales-orders", priority: 5, workspace: "sales-orders" },
      { id: "sales-quotations", domain: "sales", module: "sales-quotations", label: "Quotations", icon: "description", route: "/sales/quotations", permission: "read:sales-quotations", priority: 6, workspace: "sales-quotations" },
      { id: "sales-reports", domain: "sales", module: "sales-reports", label: "Reports", icon: "bar_chart", route: "/sales/reports", permission: "read:reports", priority: 7, workspace: "sales-reports" },
      
      // Inventory Domain
      { id: "item-master", domain: "inventory", module: "item-master", label: "Item Master Registry", icon: "inventory_2", route: "/item-master", permission: "read:item-master", priority: 1, workspace: "item-master" },
      { id: "scdm", domain: "inventory", module: "scdm", label: "Supply Chain & Distribution", icon: "local_shipping", route: "/scdm", permission: "read:scdm", priority: 2, workspace: "scdm" },
      { id: "print-studio", domain: "inventory", module: "print-studio", label: "Print Labels Studio", icon: "print", route: "/print-studio", permission: "read:print-studio", priority: 3, workspace: "print-studio" },
      
      // Purchase Domain
      { id: "purchase", domain: "purchase", module: "purchase-studio", label: "Purchase Studio", icon: "shopping_cart", route: "/purchase", permission: "read:purchase", priority: 1, workspace: "purchase" },
      { id: "supplier-master", domain: "purchase", module: "supplier-master", label: "Supplier Dashboard", icon: "store", route: "/supplier-master", permission: "read:suppliers", priority: 2, workspace: "supplier-master" },
      
      // Analytics & Reports Domain
      { id: "dashboard", domain: "analytics", module: "executive-hub", label: "Executive Dashboard", icon: "dashboard", route: "/dashboard", permission: "read:dashboard", priority: 1, workspace: "dashboard" },
      { id: "bi-reports", domain: "analytics", module: "bi-reports", label: "BI Reporting & Print Agent", icon: "analytics", route: "/bi-reports", permission: "read:reports", priority: 2, workspace: "bi-reports" },
      { id: "report-designer", domain: "analytics", module: "report-designer", label: "Report & Schema Designer", icon: "design_services", route: "/report-designer", permission: "read:report-designer", priority: 3, workspace: "report-designer" }
    ];

    defaults.forEach(item => this.registry.set(item.id, item));
  }

  public register(entry: NavigationMetadataEntry): void {
    this.registry.set(entry.id, entry);
  }

  public unregister(id: string): void {
    this.registry.delete(id);
  }

  public getSidebarModules(activeDomain: string, userPermissions?: string[]): NavigationMetadataEntry[] {
    const all = Array.from(this.registry.values());
    const filteredByDomain = all.filter(item => item.domain.toLowerCase() === activeDomain.toLowerCase() || activeDomain === "all" || item.id === "launchpad");
    
    if (!userPermissions || userPermissions.includes("*") || userPermissions.includes("admin")) {
      return filteredByDomain.sort((a, b) => a.priority - b.priority);
    }

    return filteredByDomain
      .filter(item => !item.permission || userPermissions.includes(item.permission))
      .sort((a, b) => a.priority - b.priority);
  }

  public getAllRegisteredModules(): NavigationMetadataEntry[] {
    return Array.from(this.registry.values()).sort((a, b) => a.priority - b.priority);
  }
}

export const navigationRegistry = new NavigationRegistryImpl();
