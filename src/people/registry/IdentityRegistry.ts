/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUPOE IdentityRegistry (Universal Identity & Person Master v2.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.0.0
 */

import {
  IdentityLifecycleState,
  IngestionSource,
  ProvisioningPolicy,
  WorkLocationAssignment
} from "../manifests/IdentityManifest";

export interface IdentityRecord {
  id: string;
  identityCode: string;
  fullName: string;
  mobile: string;
  email: string;
  roles: string[];
  positions: string[];
  department: string;
  userId?: string; // Optional authentication linkage
  lifecycleState: IdentityLifecycleState;
  provisioningPolicy: ProvisioningPolicy;
  ingestionSource: IngestionSource;
  workAssignments: WorkLocationAssignment[];
  territoryId?: string;
}

export const INITIAL_IDENTITIES: IdentityRecord[] = [
  {
    id: "ID-1001",
    identityCode: "EMP-001",
    fullName: "Shahid Patel",
    mobile: "+91 98200 12345",
    email: "shahid.patel@smritisys.com",
    roles: ["SalesExecutive", "ReferralPartner", "Customer", "Cashier"],
    positions: ["Area Sales Manager"],
    department: "Field Sales",
    userId: "usr-super",
    lifecycleState: "Active",
    provisioningPolicy: "FastTrack",
    ingestionSource: "Manual",
    workAssignments: [
      {
        id: "WA-1001",
        companyId: "comp-default",
        locationId: "br-default",
        locationType: "Branch",
        locationName: "Main Store Branch",
        departmentId: "DEPT-SALES",
        positionId: "POS-ASM",
        isPrimary: true,
        effectiveFrom: "2026-01-01"
      }
    ],
    territoryId: "TERR-DELHI-NORTH"
  },
  {
    id: "ID-1002",
    identityCode: "EMP-002",
    fullName: "Ananya Sharma",
    mobile: "+91 98200 67890",
    email: "ananya.sharma@smritisys.com",
    roles: ["StoreManager", "Cashier"],
    positions: ["Senior Store Manager"],
    department: "Retail Store Ops",
    userId: "usr-manager",
    lifecycleState: "Active",
    provisioningPolicy: "Enterprise",
    ingestionSource: "HRMS_Sync",
    workAssignments: [
      {
        id: "WA-1002",
        companyId: "comp-default",
        locationId: "br-default",
        locationType: "Branch",
        locationName: "Main Store Branch",
        departmentId: "DEPT-RETAIL",
        positionId: "POS-SSM",
        isPrimary: true,
        effectiveFrom: "2026-01-01"
      }
    ],
    territoryId: "TERR-DELHI-CENTRAL"
  },
  {
    id: "ID-1003",
    identityCode: "SUP-001",
    fullName: "Rajesh Hardware Supplier Contact",
    mobile: "+91 98111 22334",
    email: "contact@rajeshhardware.com",
    roles: ["SupplierContact"],
    positions: ["Account Representative"],
    department: "External Vendor",
    userId: undefined, // Optional Authentication: No login account required!
    lifecycleState: "Active",
    provisioningPolicy: "APIProvisioned",
    ingestionSource: "REST_API",
    workAssignments: [
      {
        id: "WA-1003",
        companyId: "comp-default",
        locationId: "WH-CENTRAL",
        locationType: "Warehouse",
        locationName: "Central Distribution Warehouse",
        isPrimary: true,
        effectiveFrom: "2026-01-01"
      }
    ]
  }
];
