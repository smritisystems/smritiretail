/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Security Management Data Types
 */

export type MenuAccessSubjectType = "User" | "Group" | "Node";

export type MenuOperationType = 
  | "NEW" 
  | "VOID" 
  | "RETURN" 
  | "VOID RETURN" 
  | "REPRINT" 
  | "HOLD" 
  | "ADD" 
  | "EDIT" 
  | "DELETE" 
  | "VIEW";

export interface MenuItemPermission {
  menuId: string;
  menuName: string;
  parentId?: string;
  isAccessible: boolean;
  allowedOperations?: Record<string, boolean>; // e.g. { "NEW": true, "VOID": false, "RETURN": true }
  supportedOperations?: MenuOperationType[];
  children?: MenuItemPermission[];
}

export interface SecurityUserEntry {
  id: string;
  name: string;
  groupId: string;
  companyCode: string;
  companyName: string;
  isLocked: boolean;
}

export interface SecurityGroupEntry {
  id: string;
  name: string;
  companyCode: string;
  companyName: string;
}

export interface SecurityNodeEntry {
  id: string;
  name: string;
  ipAddress?: string;
  companyCode: string;
  companyName: string;
}

export interface PasswordSecurityConfig {
  maxPasswordLength: number;
  minPasswordLength: number;
  minUppercase: number;
  minLowercase: number;
  minNumeric: number;
  passwordsToRemember: number;
  passwordResettingDays: number;
  maxInvalidAttempts: number;
}

export interface HousekeepingSecurityConfig {
  daysToRetainActivityLog: number;
  countryCode: string;
  remindPatchUpdationDays: number;
  activateCompanyWiseRestrictions: boolean;
  customReportsInMenuScreen: number;
  customReportsRefreshIntervalSeconds: number;
}

export interface SecurityManagementState {
  passwordConfig: PasswordSecurityConfig;
  housekeepingConfig: HousekeepingSecurityConfig;
  userPermissions: Record<string, MenuItemPermission[]>;
  groupPermissions: Record<string, MenuItemPermission[]>;
  nodePermissions: Record<string, MenuItemPermission[]>;
}
