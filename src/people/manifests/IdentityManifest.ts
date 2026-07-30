/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUPOE IdentityManifest (Versioned Identity Manifest Schema v2.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.0.0
 */

export type IdentityLifecycleState =
  | "Draft"
  | "PendingApproval"
  | "Active"
  | "Transferred"
  | "Suspended"
  | "Archived";

export type ProvisioningPolicy =
  | "FastTrack"
  | "Enterprise"
  | "HRManaged"
  | "APIProvisioned"
  | "BulkImport";

export type WorkLocationType =
  | "Branch"
  | "Warehouse"
  | "Office"
  | "DistributionCentre"
  | "Remote";

export type IngestionSource =
  | "Manual"
  | "CSV_Excel"
  | "REST_API"
  | "HRMS_Sync"
  | "ActiveDirectory"
  | "EntraID"
  | "GoogleWorkspace";

export interface WorkLocationAssignment {
  id: string;
  companyId: string;
  locationId: string;
  locationType: WorkLocationType;
  locationName: string;
  departmentId?: string;
  positionId?: string;
  isPrimary: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface IdentityManifestV2 {
  version: "2.0";
  identity: {
    id: string;
    code: string;
    fullName: string;
    email?: string;
    mobile?: string;
    roles: string[];
    lifecycleState: IdentityLifecycleState;
    provisioningPolicy: ProvisioningPolicy;
    ingestionSource: IngestionSource;
    workAssignments: WorkLocationAssignment[];
    authentication: {
      hasLogin: boolean;
      userAccountId?: string;
      authProvider?: string;
    };
    capabilities: {
      login: boolean;
      fieldSales: boolean;
      commissionWallet: boolean;
      territoryManagement: boolean;
    };
  };
}
