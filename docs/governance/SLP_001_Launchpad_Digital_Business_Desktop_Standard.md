# SLP-001: SMRITI Launchpad Digital Business Desktop Standard

**Standard ID:** SLP-001  
**Version:** v1.0  
**Category:** Workspace Framework  
**Tier:** Platform Core (Mandatory)  
**Author:** Jawahar Ramkripal Mallah  
**Designation:** Chief Systems Architect & Creator  
**Copyright:** © SMRITIBooks.com. All Rights Reserved.  
**Effective:** 2026-07-28  

---

## 1. Vision & Mandate
> **One Workspace. Every Business. Every Role.**

The Launchpad is the Digital Business Desktop for SMRITI Retail OS—the primary screen every authenticated user sees upon login. It contains **no business-domain logic**. Its purpose is to orient the user, surface role-aware business health indicators, surface pending work items, provide instant access to high-frequency operational actions, and route to authorized business modules in 2–3 clicks.

---

## 2. Deterministic Workspace Zones
The Launchpad layout is strictly organized into 8 deterministic zones:

```text
Zone A: Shell Header (Branding, Universal Search Ctrl+K, Notifications, User Profile, Live Clock)
Zone B: Business Snapshot (Role-Aware KPI Widgets: Owner, Cashier, Warehouse, Accountant)
Zone C: Favorites Bar (User-Pinned Shortcuts & Links)
Zone D: Quick Actions Bar (Module-Contributed Operational Actions)
Zone E: Application Launcher Grid (WNG-002 Max 12 Active Tiles, AI-001 Gated)
Zone F: Extension Plugin Widgets (Custom & Industry Pack KPI Widgets)
Zone G: Activity & Pending Work Panel (My Work & Recent Items with "Continue Working" links)
Zone H: System Status Bar (Version, FY, DB Connection, Printer Readiness, Sync, License)
```

---

## 3. Operational Guarantees
1. **Zero-Learning Navigation**: All applications accessible within 2–3 clicks.
2. **Offline-First & Fast Load**: Boots in `< 2 seconds` using cached metrics from `LaunchpadCacheService`.
3. **Role-Based Dynamic Generation**: Tiles rendered dynamically from backend RBAC scope matching.
4. **WNG-002 Compliant**: Hard 12-tile active cap per role. Zero disabled or greyed-out tiles rendered.
5. **Rule AI-001 Compliant**: AI feature tiles omitted when AI is disabled by System Administrator.
