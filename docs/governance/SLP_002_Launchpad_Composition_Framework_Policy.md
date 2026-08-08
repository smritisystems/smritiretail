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

# SLP-002: Launchpad Composition Framework Policy

**Policy ID:** SLP-002 / AOP-008  
**Status:** FROZEN — LEVEL 1 SMRITI ARCHITECTURE CONSTITUTION  
**Author:** Jawahar Ramkripal Mallah  
**Designation:** Chief Systems Architect & Creator  
**Copyright:** © SMRITIBooks.com. All Rights Reserved.  
**Effective:** 2026-07-28  

---

## 1. Policy Statement
> **The Launchpad shall not contain business logic. It shall compose its interface exclusively from registered modules, widgets, services, and metadata.**

Application modules (Sales, Purchase, Inventory, CRM, Accounting, Reports) register their manifests, tiles, quick actions, widgets, search providers, and status indicators into central composition registries (`ModuleRegistry`, `WidgetRegistry`, `QuickActionRegistry`, `SearchProviderRegistry`) via the Launchpad SDK (`SLPSDK`).

---

## 2. Platform Core vs. Business Module Separation
- **Platform Core Services**: Authentication, License Engine, Theme Engine, Launchpad Composition Shell, Notification Engine, Search Engine, Capability Registry.
- **Business Modules**: Point of Sale (POS), Sales Invoicing, Procurement & Purchase Orders, Inventory & Product Master, Customer CRM, Double-Entry Accounting, Reports Engine.

The Launchpad composes capabilities contributed by Business Modules without depending on their internal implementation details.
