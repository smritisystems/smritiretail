<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Version      : 6.31.2
  Created      : 2026-09-17
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Walkthrough: Bill Prefix Save-Batch HREP Fix and Theme Bridge (v6.31.2)

## 1. Purpose
Fix two issues discovered during post-deployment validation:
(a) HREP violation in save_bill_prefixes_batch exposing raw DB errors to browser.
(b) Soft-delete restore logic bug creating phantom duplicate DocumentSeries rows.
(c) MD3 CSS token utilities hard-coded to light palette, breaking dark mode.

## 2. Root Causes

### 2a. HREP Violation (numbering service)
save_bill_prefixes_batch caught DB exceptions and re-raised them as
HTTPException with detail=f"Failed to save: {type(e).__name__}: {str(e)}"
This exposed IntegrityError class names and raw Postgres DETAIL strings
to the browser via apiFetchV1's errorJson.detail extraction.

### 2b. Soft-Delete Restore Logic
When item.id was provided but the DocumentSeries row had is_deleted=True,
the guard if existing and not existing.is_deleted skipped the update
path and fell through to CREATE, producing a duplicate row.

### 2c. Dark Mode Theme
MD3 utility classes (bg-surface, text-on-surface, border-outline-variant,
bg-primary, text-primary) were hard-coded to light hex values in :root{}.
They never responded to [data-theme='dark'], making modals render white.

## 3. Files Modified
- backend/app/services/numbering.py: HREP fix + soft-delete restore
- src/index.css: MD3 tokens bridged to Fiori theme CSS variables

## 4. Tests Executed
Command: python3 -m pytest app/tests/test_inventory.py -q --tb=short
Run 1:   4 passed, 17 warnings in 93.47s
Run 2:   4 passed, 17 warnings in 86.16s
Run 3:   4 passed, 17 warnings in 48.81s (post numbering fix, new container)

## 5. Commits
- 3bf7d86e: fix(theme): bridge MD3 surface tokens to Fiori vars for dark mode
- 6b0c0ead: fix(numbering): HREP + soft-delete restore in save_bill_prefixes_batch

## 6. Known Limitations
- save-batch 500 could not be reproduced in isolation; the fix is preventive.
- Pre-existing test collection errors in tests/ directory remain unresolved.
