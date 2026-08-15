<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.0
  Created      : 2026-08-15
  Modified     : 2026-08-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Architecture Decision — 2026-08-15

## v3.25.0 Authoritative Baseline

`56b5fb46b477aa81166680f60ad7030fe1493e5e` is the authoritative
SMRITI Retail OS v3.25.0 User Training baseline.

The current main/smritiNX lineage is intentional and is NOT treated
as a rollback or corrupted merge.

Inventory Kernel, SPK/SWSDK and SXP remain preserved on:
`origin/feat/physically-isolated-company-dbs`

They are experimental/next-generation architecture candidates and
must not be merged into v3.25.0 unless explicitly approved for v3.26.0+.

## Frozen v3.25.0 Rule

DO NOT modify main for experimental architecture recovery.

Any future Inventory Kernel / SWSDK / SXP integration must occur on
a dedicated feature branch with full regression, build, security,
database and architecture validation before merge.
