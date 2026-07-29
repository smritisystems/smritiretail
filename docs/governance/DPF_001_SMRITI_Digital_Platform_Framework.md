<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
  Version      : 1.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard (DPF-001)
-->

# DPF-001 — SMRITI Digital Platform Framework

**Status:** MANDATORY — v1.0 (2026-07-21)  
**Applies To:** SMRITI Digital Platform, Ecosystem Portals, Shared Services & Retail OS Core

---

## 1. Executive Overview

**DPF-001** establishes the architectural framework, portal topology, shared services governance, portal lifecycle, and cross-portal user experience principles across the **SMRITI Digital Platform**.

It provides top-level governance sitting above individual portal implementations, defining how public-facing digital channels, authenticated customer portals, and the transactional Retail OS core interact cleanly without tight coupling.

---

## 2. 3-Tier Platform Architecture

```text
                           SMRITI Digital Platform

                    Identity & Portal Gateway (SIP-001)
                                │
      ┌─────────────────────────┼─────────────────────────┐
      │                         │                         │
      ▼                         ▼                         ▼
Tier 1: Public Website   Tier 2: Portal Platform   Tier 3: Retail OS Core
• Product Marketing      • Customer Workspace      • Sales & POS Billing
• Live Documentation     • SMRITI Academy LMS      • WMS & Multi-Bin
• Marketplace Hub        • Developer Portal        • Accounting & Tax
• Community              • Partner Hub             • AI Advisory & UDMS
```

---

## 3. Shared Platform Services Layer

All portals consume standardized Shared Platform Services rather than re-implementing core features:
1. **Portal Registry (`portal_registry.py`):** Dynamic metadata, manifest validation, and feature-flag control.
2. **Identity & SSO Gateway (SIP-001):** OAuth2, Single Sign-On, RBAC, tenant context.
3. **Customer Workspace Engine (`customer_portal.py`):** Licensing, backups, tickets, invoices.
4. **SMRITI Academy LMS (`academy_engine.py`):** Course catalog, learning paths, quizzes, certifications.
5. **Notification Engine (`notification_service.py`):** Email, SMS, WhatsApp, In-App.
6. **Global Unified Search (`global_search_service.py`):** Instant search across docs, courses, marketplace, and APIs.

---

## 4. Formal Portal Lifecycle

Every portal in the SMRITI Digital Platform progresses through five explicit lifecycle states:

```text
[ DRAFT ] ──► [ BETA ] ──► [ GENERAL_AVAILABILITY ] ──► [ DEPRECATED ] ──► [ RETIRED ]
```

1. **DRAFT:** Under active development; inaccessible to end users.
2. **BETA:** Available for preview to opted-in users; feature flag enabled.
3. **GENERAL_AVAILABILITY (GA):** Fully supported, certified, production-ready portal.
4. **DEPRECATED:** Scheduled for retirement; replacement available (minimum 2-release grace period per CMP-001).
5. **RETIRED:** Offline; route disabled in Portal Registry.

---

## 5. Governance Stack Summary

```text
DPF-001 (Digital Platform Framework)
  └── PAR-001 (Platform Architecture Reference)
        └── CMP-001 (Compatibility & Versioning Policy)
              └── SIP-001 (Identity Platform Standard)
                    └── GCR-001 (Golden Code Rules)
                          └── AOP-001 (AI Optionality Principle)
```
