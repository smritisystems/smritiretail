<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.33.0
  Created      : 2026-08-26
  Modified     : 2026-08-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Shoper9 Legacy Template Blueprints

This directory contains the normalized, verified, and audited blueprints derived from legacy **Shoper9 Template files** (`D:\Shoper9\Templates`).

> [!IMPORTANT]
> These artifacts are business and architectural blueprints for SMRITI Retail OS. No legacy SQL is executed directly against production databases (`smritisys`, `smriti001`, `smriti002`).

---

## 1. Directory Structure

- [`template_manifest.json`](./template_manifest.json): Full manifest of all source template files with SHA256 hashes and quarantine status.
- [`retail_blueprint.json`](./retail_blueprint.json): Retail profile configuration and module boundaries.
- [`distributor_blueprint.json`](./distributor_blueprint.json): Distributor profile configuration, Delivery Challans, Transport Receipts, and PO Consolidation.
- [`menus.json`](./menus.json): Normalized menu definitions with direct SMRITI Launchpad tile and workspace mappings.
- [`parameters.json`](./parameters.json): Consolidated system parameters catalog, category hierarchies, and Retail vs Distributor variances.
- [`general_lookups.json`](./general_lookups.json): Master lookups, search filters, and formula definitions.
- [`display_layouts.json`](./display_layouts.json): Billing/Grid display column formatting rules (`ACCEPTDISPLAYDTLS`).
- [`review_report.md`](./review_report.md): Formal audit report of quarantined temporary files, empty files, duplicate statements, and legacy path anomalies.

---

## 2. File Classifications

| Legacy Extension | Description | SMRITI Canonical Concept |
|---|---|---|
| `*.Sy` | System Parameters CSV | `smritisys.system_parameters` |
| `*.Gl` | General Lookups CSV | Master Data, Filters & Categories |
| `*.Lu` | Lookup Value Choices CSV | Parameter Option Enumerations |
| `*.Dbs` | Display Grid SQL | Screen Layouts & Table Formats |
| `*.Mns` | Menu Registry SQL | Fiori Launchpad Tiles & ACAS Permissions |
| `*.TW` | Binary Template Wrapper | Quarantined / Reference Only |
| `*_tmp.txt` | Temporary Backup Files | Quarantined / Non-Importable |
| `*.Ads`, `*.Ams`, `*.Sdbs` | 0-byte Stub Files | Verified Empty Stubs |

---

## 3. Profile Architecture

### Retail Profile (`Retail.Sy`, `Retail.Gl`, `Retail.Lu`)
- **Core Focus**: Fast POS cash/card/UPI billing, barcode lookup, store-level inventory, customer pricing, and retail reporting.
- **Parameters Count**: 828

### Distributor Profile (`Distributor.Sy`, `Distributor.Gl`, `Distributor.Lu`, `Distributor.Dbs`, `Distributor.Mns`)
- **Core Focus**: B2B Wholesale operations, Delivery Challans (Sales DC, Approval Issue DC), Transport LR Entry, DC Type Reclassification, Purchase Order Consolidation, and custom grid layouts.
- **Parameters Count**: 828
- **Display Column Formats**: 140 columns
- **Workflow Mappings**: 5 core distributor workflows mapped to SMRITI Distributor Invoicing and Logistics modules.
