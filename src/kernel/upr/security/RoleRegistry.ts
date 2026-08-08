/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Role Registry (USR-002)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & USR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { PermissionRegistry } from "./PermissionRegistry.js";

export interface RoleDefinition {
  id: string;                 // Role identifier (e.g. "sysadmin", "store_manager", "cashier", "inventory_clerk")
  name: string;               // Display title
  description?: string;
  parentRoleId?: string;      // Role hierarchy inheritance
  permissionIds: string[];    // Granted permission keys
  isSystemRole?: boolean;
}

export class RoleRegistryService {
  private roles: Map<string, Readonly<RoleDefinition>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultRoles();
  }

  private seedDefaultRoles() {
    const defaults: RoleDefinition[] = [
      {
        id: "sysadmin",
        name: "System Administrator",
        description: "Unrestricted enterprise platform superuser",
        permissionIds: ["system.admin"],
        isSystemRole: true
      },
      {
        id: "store_manager",
        name: "Store Manager",
        description: "Manages store POS, sales, inventory, and reports",
        permissionIds: [
          "sales.pos.billing",
          "sales.pos.discount",
          "inventory.item.read",
          "inventory.item.create",
          "inventory.item.edit",
          "purchase.order.create",
          "accounting.ledger.view"
        ]
      },
      {
        id: "cashier",
        name: "POS Billing Cashier",
        description: "Executes billing transactions at retail POS checkout",
        permissionIds: ["sales.pos.billing", "inventory.item.read"]
      },
      {
        id: "inventory_clerk",
        name: "Inventory & Stock Clerk",
        description: "Manages item master, stock movement, and warehouse GRNs",
        parentRoleId: "cashier",
        permissionIds: ["inventory.item.read", "inventory.item.create", "inventory.item.edit"]
      }
    ];

    defaults.forEach((r) => this.registerRole(r));
  }

  public registerRole(role: RoleDefinition): void {
    const payload = Object.freeze({ ...role, id: role.id.toLowerCase() });
    this.roles.set(payload.id, payload);
    this.emitChange();
  }

  public getRole(id: string): Readonly<RoleDefinition> | undefined {
    if (!id) return undefined;
    return this.roles.get(id.toLowerCase());
  }

  public getRoles(): ReadonlyArray<Readonly<RoleDefinition>> {
    return Array.from(this.roles.values());
  }

  public getEffectivePermissions(roleId: string): string[] {
    const role = this.getRole(roleId);
    if (!role) return [];

    const perms = new Set<string>(role.permissionIds);

    // Parent role permission inheritance resolution
    if (role.parentRoleId) {
      const parentPerms = this.getEffectivePermissions(role.parentRoleId);
      parentPerms.forEach((p) => perms.add(p));
    }

    return Array.from(perms);
  }

  public hasPermission(roleId: string, permissionId: string): boolean {
    const normalizedRole = (roleId || "").toLowerCase();
    if (
      normalizedRole === "super" ||
      normalizedRole === "sysadmin" ||
      normalizedRole === "sys_admin" ||
      normalizedRole === "platform_admin" ||
      normalizedRole === "admin"
    ) {
      return true;
    }
    const effective = this.getEffectivePermissions(roleId);
    if (effective.includes("system.admin") || effective.includes("*")) return true;
    return effective.includes(permissionId.toLowerCase());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.roles.clear();
    this.seedDefaultRoles();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const RoleRegistry = new RoleRegistryService();
