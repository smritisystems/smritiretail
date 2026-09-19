<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-11
  Status       : Approved
  Owner        : Enterprise Architecture
  Reviewers    : Product, Architecture, Engineering
  Related Docs : docs/implementation/purchase/Vendor_360_Universal_Party_Canonical_Architecture_v1.0.0.md
-->

# ADR-VEND-01: Vendor 360 Workspace & Universal Party Master Canonical Architecture

## Status
Approved

## Context
Prior to this architecture decision, SMRITI Retail OS maintained two separate, non-reconciled data models for suppliers and vendors:
1. Legacy transactional table `suppliers` (`backend/app/models/purchase.py`), which anchored legacy purchase orders, receipts, and payments.
2. Universal Party subsystem `parties` (`backend/app/models/party.py`), containing polymorphic `Party`, `PartyRole(SUPPLIER)`, and `SupplierProfile`.

This split led to master data divergence, missing statutory compliance data (PAN for TDS under Section 194Q/206AB, MSME Udyam registration for Section 43B(h) compliance, bank coordinates for disbursement), and fragmented UI screens across 5 standalone modals.

Immediate deprecation and dropping of `suppliers` was precluded due to foreign key references from active transactional tables (`purchase_orders.supplier_id`, `purchase_receipts.supplier_id`, `supplier_payments.supplier_id`).

## Decision
1. **Universal Party as Sole System of Record:**
   - Establish `Party` + `PartyRole(SUPPLIER)` + `SupplierProfile` as the canonical master for all vendor master records.
   - Extend `SupplierProfile` with MSME categorization, commercial classification, TDS section/rate, and verification flags.
   - Establish `party_bank_accounts` (`SupplierBankAccount`) and `vendor_identity_migrations` (`VendorIdentityMigration`) as first-class domain entities.
   - Categorize `party_contacts` (`PartyContact`) with `contact_category` (`SALES`, `ACCOUNTS`, `LOGISTICS`, `MANAGEMENT`, `OTHER`).

2. **Non-Destructive Dual-Write Legacy Projection:**
   - In Sprints 1–8, `VendorService` projects all created or updated vendor records into the legacy `suppliers` table with canonical primary key `sup-<code.lower()>`.
   - Existing transactional foreign keys continue to resolve without downtime or schema breakage.

3. **Vendor 360 Workspace (`VendorMasterWs.tsx`):**
   - Consolidate supplier management into a unified 9-tab enterprise workspace covering Overview, Identity & Statutory, Addresses, Contacts, Commercial Terms, Banking, Procurement, Payables Aging, and Performance Scorecard.
   - Provide a formal Vendor Merge utility (`VendorMergeModal.tsx`) backed by `VendorService.merge_vendors` with an auditable migration ledger.

4. **Canonical Return to Vendor (RTV) Domain Engine:**
   - Standardize on a 6-stage procurement return lifecycle (`CanonicalRTVDomainEngine`) and convert legacy return modals into backward-compatible adapters.

## Consequences
- **Positive:** Unifies vendor master data under Universal Party; enforces Indian statutory compliance (PAN, GSTIN, MSME, TDS); eliminates UI fragmentation; preserves transactional stability via dual-write projection.
- **Transitional:** Dual-write overhead during Sprints 1–8 until foreign keys are migrated to `parties.id` in Sprint 9 and legacy `suppliers` is decommissioned in Sprint 10.
