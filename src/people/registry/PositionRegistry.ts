/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUPOE PositionRegistry (Position & Job Title Registry v2.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.0.0
 */

export interface PositionDefinition {
  id: string;
  title: string;
  department: string;
  reportingPositionId?: string;
  level: number;
}

export const POSITION_REGISTRY: Record<string, PositionDefinition> = {
  CEO: { id: "CEO", title: "Chief Executive Officer", department: "Executive", level: 1 },
  RegionalManager: { id: "RegionalManager", title: "Regional Manager", department: "Sales Operations", reportingPositionId: "CEO", level: 2 },
  AreaManager: { id: "AreaManager", title: "Area Sales Manager", department: "Field Sales", reportingPositionId: "RegionalManager", level: 3 },
  StoreManager: { id: "StoreManager", title: "Senior Store Manager", department: "Store Operations", reportingPositionId: "AreaManager", level: 4 },
  SalesExecutive: { id: "SalesExecutive", title: "Field Sales Executive", department: "Field Sales", reportingPositionId: "AreaManager", level: 5 },
  Cashier: { id: "Cashier", title: "POS Cashier", department: "Store Operations", reportingPositionId: "StoreManager", level: 5 }
};
