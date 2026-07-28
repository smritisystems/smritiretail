# ADR-001: Product Vision & Four-Tier Product Architecture

**Status:** APPROVED — v1.0 (2026-07-28)  
**Deciders:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Technical Story:** Platform Capability & Ecosystem Product Vision

---

## Context
SMRITI Retail OS is an enterprise-grade digital business platform designed to serve retail operations across single stores, multi-branch chains, and cloud enterprise environments. To prevent monolithic entanglement, the ecosystem must be structured into independent product tiers.

---

## Decision
We adopt the **Four-Tier Enterprise Product Architecture**:

1. **SMRITI Website (Marketing)**: Public website (`www.smritisys.com`), Pricing, Features, Documentation. Independent marketing product.
2. **SMRITI Portal (Customer Self-Service)**: Account portal (`portal.smritisys.com`), Licenses, Subscriptions, Device Activation.
3. **SMRITI Workspace (Retail Operations App)**: Retail app (`workspace.smritisys.com` / `localhost:3000`), POS, Inventory, Purchase, Sales, Accounting.
4. **SMRITI Platform API (Core Engine)**: Headless backend system-of-record (`api.smritisys.com`), PostgreSQL Database.

---

## Consequences
- **Positive**: Every tier evolves, deploys, and scales independently without cross-contaminating databases or user experience layers.
- **Negative**: Requires strict SDK contracts (`SMRITI SDK`) to manage cross-tier API communication.
