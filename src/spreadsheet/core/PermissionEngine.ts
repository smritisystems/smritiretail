/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Spreadsheet Platform (SSP)
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.3.0
 * Created      : 2026-07-27
 * Copyright    : © SmritiSys. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export interface ColumnPermission {
  colKey: string;
  readRoles: string[];
  editRoles: string[];
}

/**
 * Enterprise Permission Engine for column and cell-level RBAC security.
 */
export class PermissionEngine {
  private columnPermissions: Map<string, ColumnPermission> = new Map();

  constructor(initialPermissions: ColumnPermission[] = []) {
    initialPermissions.forEach((p) => this.columnPermissions.set(p.colKey, p));
  }

  public isColumnReadable(colKey: string, userRole: string): boolean {
    const perm = this.columnPermissions.get(colKey);
    if (!perm || perm.readRoles.includes("*")) return true;
    return perm.readRoles.includes(userRole);
  }

  public isColumnEditable(colKey: string, userRole: string): boolean {
    const perm = this.columnPermissions.get(colKey);
    if (!perm || perm.editRoles.includes("*")) return true;
    return perm.editRoles.includes(userRole);
  }

  public setColumnPermission(perm: ColumnPermission): void {
    this.columnPermissions.set(perm.colKey, perm);
  }
}
