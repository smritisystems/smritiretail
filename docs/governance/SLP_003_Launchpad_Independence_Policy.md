<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# SLP-003: Launchpad Independence Policy

**Policy ID:** SLP-003  
**Status:** FROZEN — LEVEL 1 SMRITI ARCHITECTURE CONSTITUTION  
**Author:** Jawahar Ramkripal Mallah  
**Designation:** Chief Systems Architect & Creator  
**Copyright:** © SMRITIBooks.com. All Rights Reserved.  
**Effective:** 2026-07-28  

---

## 1. Policy Statement (MANDATORY)
> **The Launchpad shall never directly import or invoke business-domain logic. All interactions with business modules must occur through published manifests, registries, providers, or capability interfaces.**

---

## 2. Enforcement Rules
1. **Zero Direct Imports**: Source files in `src/launchpad/` must never import specific domain tab components (e.g. `SalesStudioTab.tsx`, `PurchaseStudioTab.tsx`, `ItemMasterTab.tsx`).
2. **Interface Abstraction**: Navigation to business tabs occurs purely via abstract `onSelectTab(tabId: string)` contracts and registered route targets.
3. **Decoupled Extensions**: Third-party extensions and optional capabilities (`AI`, `Barcode`, `WhatsApp`, `Tally`) integrate strictly by registering providers into `CapabilityRegistry` or `WidgetRegistry`.
