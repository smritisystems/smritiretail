<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : SMP-005 v1.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Constitutional Architecture Standard
-->

# SMP-005: Versioning & Compatibility Policy Standard (v1.0)

## 1. Versioning System
- **SMP Specification:** `v1.0` (Architecture Standard).
- **SPK Runtime Kernel:** `v12.1.0` (Kernel Engine).
- **SMRITI Product Release:** `v12.1.0` (Commercial Application).

## 2. Module Compatibility Constraint
Every module manifest (`module.json`) declares `min_platform` and `max_platform`. The manifest loader validates runtime compatibility before loading.
