/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Permission Registry (USR-001)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & USR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export type PermissionScope =
  | "system"
  | "domain"
  | "module"
  | "workspace"
  | "action"
  | "field";

export interface PermissionDefinition {
  id: string;                 // Permission key (e.g. "sales.pos.billing", "inventory.item.create")
  name: string;               // Display title
  description?: string;
  scope: PermissionScope;
  domainId: string;           // Associated domain (e.g. "sales", "inventory")
  moduleId?: string;          // Associated module ID
  action?: string;            // Action name (e.g. "create", "read", "update", "delete", "export", "approve")
  isSystemAdminOnly?: boolean;
}

export class PermissionRegistryService {
  private permissions: Map<string, Readonly<PermissionDefinition>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultPermissions();
  }

  private seedDefaultPermissions() {
    const defaults: PermissionDefinition[] = [
      { id: "system.admin", name: "Full System Administration", scope: "system", domainId: "all", isSystemAdminOnly: true },
      { id: "sales.pos.billing", name: "POS Terminal Billing", scope: "workspace", domainId: "sales", moduleId: "pos", action: "billing" },
      { id: "sales.pos.discount", name: "POS Line Item Discounting", scope: "action", domainId: "sales", moduleId: "pos", action: "discount" },
      { id: "inventory.item.read", name: "View Item Master", scope: "workspace", domainId: "inventory", moduleId: "item-master", action: "read" },
      { id: "inventory.item.create", name: "Create Item Master SKU", scope: "action", domainId: "inventory", moduleId: "item-master", action: "create" },
      { id: "inventory.item.edit", name: "Edit Item Master SKU", scope: "action", domainId: "inventory", moduleId: "item-master", action: "update" },
      { id: "purchase.order.create", name: "Create Purchase Order", scope: "action", domainId: "purchase", moduleId: "purchase", action: "create" },
      { id: "accounting.ledger.view", name: "View General Ledger", scope: "workspace", domainId: "accounting", moduleId: "business-ledger", action: "read" }
    ];

    defaults.forEach((p) => this.registerPermission(p));
  }

  public registerPermission(permission: PermissionDefinition): void {
    const payload = Object.freeze({ ...permission, id: permission.id.toLowerCase() });
    this.permissions.set(payload.id, payload);
    this.emitChange();
  }

  public getPermission(id: string): Readonly<PermissionDefinition> | undefined {
    if (!id) return undefined;
    return this.permissions.get(id.toLowerCase());
  }

  public getPermissions(): ReadonlyArray<Readonly<PermissionDefinition>> {
    return Array.from(this.permissions.values());
  }

  public getPermissionsByDomain(domainId: string): ReadonlyArray<Readonly<PermissionDefinition>> {
    return this.getPermissions().filter((p) => p.domainId === "all" || p.domainId === domainId.toLowerCase());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.permissions.clear();
    this.seedDefaultPermissions();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const PermissionRegistry = new PermissionRegistryService();
