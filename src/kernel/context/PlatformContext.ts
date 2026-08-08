/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : SMRITI Platform Context (Immutable Request Execution Context)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 & Platform Foundation v1.0 Standard
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface PlatformContext {
  userId: string;
  userName: string;
  userRole: string;
  tenantId: string;
  companyId: string;
  storeId: string;
  warehouseId?: string;
  locale: string;
  timezone: string;
  currency: string;
  edition: string;
  attributes?: Record<string, any>;
}

export function createPlatformContext(overrides: Partial<PlatformContext> = {}): Readonly<PlatformContext> {
  return Object.freeze({
    userId: overrides.userId || "usr-admin",
    userName: overrides.userName || "System Administrator",
    userRole: overrides.userRole || "sysadmin",
    tenantId: overrides.tenantId || "smriti-default",
    companyId: overrides.companyId || "comp-hq",
    storeId: overrides.storeId || "store-01",
    warehouseId: overrides.warehouseId || "wh-main",
    locale: overrides.locale || "en-IN",
    timezone: overrides.timezone || "Asia/Kolkata",
    currency: overrides.currency || "INR",
    edition: overrides.edition || "enterprise",
    attributes: Object.freeze(overrides.attributes || {})
  });
}
