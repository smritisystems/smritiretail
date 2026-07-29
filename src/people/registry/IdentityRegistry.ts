/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUPOE IdentityRegistry (Universal Identity & Person Master v2.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.0.0
 */

export interface IdentityRecord {
  id: string;
  personCode: string;
  fullName: string;
  mobile: string;
  email: string;
  roles: string[];
  positions: string[];
  department: string;
  userId?: string; // Optional authentication linkage
  branchId?: string;
  territoryId?: string;
  status: "Active" | "Inactive" | "Blocked";
}

export const INITIAL_IDENTITIES: IdentityRecord[] = [
  {
    id: "PER-1001",
    personCode: "EMP-001",
    fullName: "Shahid Patel",
    mobile: "+91 98200 12345",
    email: "shahid.patel@smritisys.com",
    roles: ["SalesExecutive", "ReferralPartner", "Customer", "Cashier"],
    positions: ["Area Sales Manager"],
    department: "Field Sales",
    userId: "USR-1001",
    branchId: "BR-DELHI-01",
    territoryId: "TERR-DELHI-NORTH",
    status: "Active"
  },
  {
    id: "PER-1002",
    personCode: "EMP-002",
    fullName: "Ananya Sharma",
    mobile: "+91 98200 67890",
    email: "ananya.sharma@smritisys.com",
    roles: ["StoreManager", "Cashier"],
    positions: ["Senior Store Manager"],
    department: "Retail Store Ops",
    userId: "USR-1002",
    branchId: "BR-DELHI-01",
    territoryId: "TERR-DELHI-CENTRAL",
    status: "Active"
  }
];
