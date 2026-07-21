<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 28.0.0
  Created      : 2026-07-22
  Modified     : 2026-07-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Implementation Plan Standard (IPGP)
-->

# Phase 34: Official Product Website & Public Marketing Portal (v28.0.0) — Implementation Plan

## 1. Objective
Establish the **SMRITI Official Product Website & Public Marketing Portal (`v28.0.0`)** as the primary front door for the SMRITI Digital Platform Ecosystem (`DPF-001`). This phase delivers a modern, high-conversion, responsive public web presence linking to all ecosystem portals (Documentation, Customer Workspace, Marketplace, Developer Portal, Partner Hub, SMRITI Academy, and Community).

## 2. Business Motivation
SMRITI Retail OS has matured into an enterprise-grade platform. The Official Product Website showcases SMRITI's core value proposition, industry-specific retail engines (Pharma, Apparel, FMCG, Supermarkets), multi-tier pricing, live interactive screenshots, and demo booking capabilities, positioning SMRITI alongside global retail platforms.

## 3. Scope
- **Public Hero & Feature Showcase:** Modern glassmorphism hero banner, key statistics, dynamic feature grid, and live screenshot carousel.
- **Industry Solution Pages:** Dedicated showcase for Pharma & Healthcare (`v24.0.0`), Apparel & Fashion 3D Matrix (`v25.0.0`), NIC GST Gateway (`v26.0.0`), and Multi-Store Franchise (`v21.0.0`).
- **Interactive Pricing Calculator & Editions Matrix:** Community (Free), Professional, and Enterprise edition comparisons.
- **Interactive Demo Booking & Lead Generation Engine:** REST API for capturing demo requests and trial signups.
- **Ecosystem Navigation Hub:** Header/footer navigation connecting all 8 registered portals per `DPF-001` and `PortalRegistry`.

## 4. Current State
- `v27.0.0` provides the backend Ecosystem Hub, `portal_registry.py`, `digital_platform_manifest.py`, `SIP-001` identity standard, and `DPF-001` framework.
- Missing a dedicated, rich public web brochure and interactive marketing portal.

## 5. Gap Analysis
- Need public web components for Hero, Features, Industry Solutions, Pricing Matrix, Demo Booking Modal, and Customer Testimonials.
- Need backend marketing REST API router `backend/app/api/v1/website/marketing.py` for lead capture and dynamic solution catalog data.

## 6. Architecture Impact
- Reuses `PortalRegistry` metadata for dynamic navigation.
- Extends FastAPI backend under `backend/app/api/v1/website/` and `backend/app/core/website/`.
- Frontend built using React + Tailwind CSS + Lucide icons in `src/components/website/`.
- Zero changes to platform foundation layers (Layers 1-7 remain 100% untouched).

## 7. Proposed Design
```text
                         Official Product Website (v28.0.0)
                                        │
    ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
    ▼                   ▼                               ▼                   ▼
Hero Showcase    Industry Solutions              Pricing Calculator      Demo Request Engine
(Glassmorphism)  (Pharma, Apparel, GST, WMS)     (Free, Pro, Enterprise) (REST API Capture)
```

## 8. Files Created
- `backend/app/core/website/lead_capture.py`
- `backend/app/core/website/solutions_catalog.py`
- `backend/app/schemas/website.py`
- `backend/app/api/v1/website/marketing.py`
- `src/components/website/SmritiOfficialWebsite.tsx`
- `src/components/website/HeroSection.tsx`
- `src/components/website/IndustrySolutionsGrid.tsx`
- `src/components/website/PricingEditionsMatrix.tsx`
- `src/components/website/DemoBookingModal.tsx`
- `backend/app/tests/test_website_marketing.py`
- `docs/implementation/website/Official_Product_Website_Plan_v28.0.0.md`
- `docs/walkthrough/website/Official_Product_Website_v28.0.0.md`

## 9. Files Modified
- `backend/app/api/v1/__init__.py`
- `backend/app/main.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- `DPF-001 Digital Platform Framework`
- `PortalRegistry` (`v27.0.0`)
- `FastAPI + Pydantic`
- `React + Lucide Icons`

## 11. Risks
- *Risk:* Layout degradation on small mobile screens.
- *Mitigation:* Responsive flex/grid design with mobile breakpoint testing.

## 12. Rollback Strategy
If issues arise, revert the `git` commit for Phase 34 without impacting core Retail OS transactional endpoints.

## 13. Verification Plan
- Backend Pytest execution for marketing lead capture & solution catalog APIs.
- Frontend `npx tsc --noEmit` check.
- Mobile and desktop browser layout verification.

## 14. Test Plan
- `test_lead_capture_registration()`: Validates demo request submission.
- `test_solutions_catalog_retrieval()`: Validates industry solutions dataset.

## 15. Documentation Impact
- Create Walkthrough document `docs/walkthrough/website/Official_Product_Website_v28.0.0.md`.
- Update `docs/implementation/README.md` and `docs/walkthrough/README.md`.

## 16. Deployment Plan
Deploy REST endpoints under `/api/v1/website` and mount `SmritiOfficialWebsite.tsx` as default public route `/`.

## 17. Status
Approved — In Progress

## 18. Related ADRs
- `ADR-001 Architecture Principles`
- `DPF-001 Digital Platform Framework`

## 19. Related Walkthroughs
- `Smriti_Ecosystem_Platform_v27.0.0.md`
