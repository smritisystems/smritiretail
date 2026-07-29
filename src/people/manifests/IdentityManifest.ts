/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUPOE IdentityManifest (Versioned Identity Manifest Schema v2.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.0.0
 */

export interface IdentityManifestV2 {
  version: "2.0";
  person: {
    roles: string[];
    positions: string[];
    permissions: string[];
    capabilities: {
      login: boolean;
      fieldSales: boolean;
      commissionWallet: boolean;
      territoryManagement: boolean;
    };
  };
}
