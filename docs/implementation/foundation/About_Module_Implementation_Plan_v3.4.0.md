<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.4.0
  Created      : 2026-07-11
  Modified     : 2026-07-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Complete "About SMRITI Retail OS" Module — v3.4.0

This document defines the plan to implement the comprehensive **About SMRITI Retail OS** module.

---

## 1. Objective
Design and implement an enterprise-grade **About SMRITI Retail OS** module containing 20 sub-navigation items, internal search, responsive layout, print-friendly views, backend metadata integration, and unit tests.

---

## 2. Business Motivation
Provide users, operators, and auditors with a single, clear source of truth regarding product editions, versions, licenses, governance, founding team members, technological architecture, and system diagnostics.

---

## 3. Scope

### In Scope
- **Backend API:** Implement `/api/changelog` in `server.ts` to return the `CHANGELOG.md` file dynamically.
- **Frontend UI Component:** Completely redesign `src/components/AboutSmritiTab.tsx` with a responsive split-pane layout containing 20 menu items, search filtering, and print styles.
- **Diagnostics Dashboard:** Read live browser navigator parameters and database connection health to display dynamic environment variables.
- **Unit Testing:** Implement a regression test script `src/tests/about.test.ts` to validate endpoints and schema data.
- **Footer/Navigation Links:** Unify sidebar and taskbar reference links to open the About module.

### Out of Scope
- Modifications to core Express session routing outside the About module API.

---

## 4. Current State
- `AboutSmritiTab.tsx` exists as a stub with only 4 sidebar sections (About, Author, Modules, System).
- Lacks biographies for Chairperson Pushpa Devi Jawahar Mallah or CEO Jawahar Ramkripal Mallah.
- No internal search within the About tab.
- No live connection log, changelog integration, privacy policy, or terms panels.

---

## 5. Gap Analysis
- **Navigation Gap:** The current sidebar has 4 sections instead of the requested 20 items.
- **Changelog Gap:** No automated integration displaying the active `CHANGELOG.md` inside the UI.
- **System Information Gap:** Missing active plugins, storage counters, and live database pool diagnostic details.

---

## 6. Architecture Impact
- **Endpoint Additions:** Adds a non-blocking Express GET router (`/api/changelog`).
- **Layout Compliance:** Follows the SMRITI Platform Abstraction Layer (PAL) coding constitution with no direct platform-specific dependencies in UI layers.

---

## 7. Proposed Design

### Sidebar Categories & Navigation Structure
The left sidebar inside `AboutSmritiTab.tsx` will be organized into four thematic groups containing the 20 required submenus:

```
├── 📊 OPERATIONAL OVERVIEW
│   ├── Dashboard (Summary of version, environment, quick navigation cards)
│   └── About SMRITI Retail OS (Product identity, logo, websites)
├── 👥 LEADERSHIP & CULTURE
│   ├── Founders (Chairperson Pushpa Devi Jawahar Mallah & CEO Jawahar Ramkripal Mallah profiles)
│   ├── Our Story (Corporate evolution narrative and visual timeline)
│   ├── Vision & Mission (Strategic directions)
│   └── Core Values (Innovation, simplicity, trust, transparency, safety)
├── 🏗️ TECHNOLOGY & PLATFORM
│   ├── Product Journey (Idea ➔ Design ➔ Testing ➔ Release workflow)
│   ├── Milestones (Chronological milestone tags from v1.0.0 to v3.3.0)
│   ├── Technology (Frontend, backend, database stacks)
│   ├── Architecture (PAL layer dependencies visual layout block diagram)
│   └── AI Innovation (KPI analytics, debounced forecasts, formula explainers)
├── ⚖️ GOVERNANCE & LEGAL
│   ├── Licenses & Legal (Copyrights, trademarks, proprietary license terms)
│   ├── Privacy Policy (Data protection commitments)
│   ├── Terms of Use (Commercial seat policies)
│   └── Third-Party Licenses (Licenses of upstream dependencies)
└── 📞 CHANNELS & CREDITS
    ├── Contact (Email links, sites, support channels)
    ├── Credits (Contributors, AITDL network acknowledgments)
    ├── Version Information (Commit hashes, host OS, database engines)
    ├── Release Notes (Render of CHANGELOG.md via backend feed)
    └── System Information (Diagnostics, active plugins, storage, memory)
```

### Search Engine
An interactive text filter on the sidebar that queries the titles and contents of all 20 sections, highlighting matches and filtering the sidebar navigation links instantly.

### Print Layouts
Tailored CSS print media queries (`@media print`) will hide sidebars and render the active document block full-width in high-contrast monochrome with clean page breaks.

---

## 8. Files Created
- `src/tests/about.test.ts` [NEW] — Automated unit tests for metadata, config, and changelog APIs.

---

## 9. Files Modified
- [MODIFY] [AboutSmritiTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/AboutSmritiTab.tsx) — Replace pane with 20 sections, search bar, contact form, visual timelines, and diagnostic fields.
- [MODIFY] [server.ts](file:///d:/IMP/GitHub/SMRITRretailNX/server.ts) — Register `/api/changelog` router endpoint.
- [MODIFY] [package.json](file:///d:/IMP/GitHub/SMRITRretailNX/package.json) — Add test execution command.

---

## 10. Dependencies
- Standard `lucide-react` icons.

---

## 11. Risks
- **Changelog Read Performance:** Reading a large markdown text file on each API request.
  - *Mitigation:* Cache the parsed file in-memory in `server.ts` upon initial startup.

---

## 12. Rollback Strategy
`git checkout -- src/components/AboutSmritiTab.tsx server.ts package.json` and deletion of the test script file.

---

## 13. Verification Plan

### Automated Verification
- Run linter: `npm run lint`.
- Run unit tests: `npm run test` to verify API outputs and metadata integrity.

### Manual Verification
- Launch application dev environment and navigate to the About page.
- Test responsive resizing in Chrome DevTools to verify sidebar collapse and fluid layout.
- Test print view to assert page formatting.

---

## 14. Test Plan
- Assert GET `/api/metadata` schema structure.
- Assert GET `/api/changelog` returns text containing `# SMRITI Retail OS — Changelog`.

---

## 15. Documentation Impact
- Update Walkthrough.
- Append Consolidated Walkthroughs and Consolidated Plans.

---

## 16. Deployment Plan
Commit and push from development.

---

## 17. Status
Draft.

---

## 18. Related ADRs
- None.

---

## 19. Related Walkthroughs
- None.
