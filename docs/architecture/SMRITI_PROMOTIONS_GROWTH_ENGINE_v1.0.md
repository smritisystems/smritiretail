<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-15
  Modified     : 2026-08-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Commercial Growth Engine - Promotions & Campaigns Specification v1.0

**Status: PROMOTIONS_GROWTH_ENGINE_VERIFIED**  
**Audit Timestamp:** 2026-08-15 07:23:47 UTC  
**Official Control Plane DB:** `smritisys`  
**Reference Company DB:** `smriti001`  

---

## 1. Executive Summary & Growth Ecosystem Co-Location

```text
                    smritisys
                 CONTROL PLANE
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Promotion     Loyalty      Commission
        Policies     Policies       Rules
          │            │            │
          └────────────┼────────────┘
                       ▼
                  smriti001
             BUSINESS SYSTEM OF RECORD
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    Promotion       Loyalty        Incentives
    Campaigns       Members        Commissions
```

- **Single Business DB Principle**: Promotions, CRM, Loyalty & SICE Commissions co-located inside `smriti001`. **Zero extra databases created**.
- **Immutable Invoice Snapshot**: Invoice retains an immutable snapshot (`rule_snapshot`) of applied promotion & coupon at transaction time.

---

## 2. Final Classification

```text
FINAL STATUS: PROMOTIONS_GROWTH_ENGINE_VERIFIED
```
