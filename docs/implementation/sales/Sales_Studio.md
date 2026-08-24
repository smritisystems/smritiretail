<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 2.1.1
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS — Implementation Plan: Sales Studio Expansion
## Plan Version: v2.1.1 (2026-07-10)

### 1. Objective
Expand and modularize the Sales & Commerce Studio (`SalesStudioTab.tsx`) to match the structural patterns of SMRITI modules like `CrmLoyaltyTab.tsx`. This includes modernizing navigation, integrating smooth route animations, and standardizing scrolling behavior.

### 2. Business Motivation
A consistent design language and standardized container architecture are critical for reducing developer cognitive load and improving user interfaces. Aligning `SalesStudioTab.tsx` with other SMRITI modules ensures consistent aesthetics, reliable layout overflows, and predictable route transition animations.

### 3. Scope
- Move `SalesStudioTab.tsx`'s inner tab-bar selector into a top-level header navigation element matching `CrmLoyaltyTab.tsx`.
- Integrate `motion.div` from `motion/react` to provide micro-animations during subview shifts.
- Wrap all main contents in a dedicated `SmritiScrollArea` to ensure standardized overflow behavior across screen sizes.
- Verify that Quotations, Sales Orders, Sales Invoices, Sales Returns, and Customer views continue to load data correctly.

### 4. Current State
- `SalesStudioTab.tsx` was using an in-body pill-bar selector button row as its primary subview navigation.
- The root component returned a top-level standard `div` without unified header, title/subtitle, or layout integrations.
- Body content had hardcoded or native browser scroll behaviors, which led to visual drift compared to the rest of SMRITI.

### 5. Gap Analysis
- **Navigation Layout Gap**: Standardized modular tabs are styled with bottom-border indicators and high-contrast tab states at the header level. Sales Studio was using localized pill buttons.
- **Scroll Overflows Gap**: Outer page structure didn't utilize `SmritiScrollArea` for consistent custom scrollbars.
- **Micro-Animations Gap**: Layout changes loaded abruptly rather than smoothly transitioning through a subtle vertical-slide fade-in effect.

### 6. Architecture Impact
None. The data-fetching mechanisms, standard event bindings, and contextual menu handlers are fully preserved. Visual presentation layer has been standard-aligned.

### 7. Proposed Design
- Update top-level component structure to return a flex-column layout:
  ```tsx
  <div className="flex flex-col h-full bg-theme-surface-1 text-theme-primary font-sans">
    {/* Header Section */}
    {/* Sub Tabs Section */}
    {/* Scroll Area */}
  </div>
  ```
- Map each of the five subviews (`quotations`, `orders`, `invoices`, `returns`, `customers`) into standard UPPERCASE or Title Case labeled buttons with a `border-b-2` active indicator.

### 8. Files Created
None.

### 9. Files Modified
- `/src/components/SalesStudioTab.tsx`

### 10. Dependencies
- `motion/react` (animations)
- `./SmritiScrollArea.tsx` (scrolling container)

### 11. Risks
- **Visual Overlap**: Incorrect CSS flex properties could cause headers to scroll out of view.
  - *Mitigation*: Used standard `flex-1 overflow-hidden` wrapper style alongside `SmritiScrollArea`.
- **Import Errors**: Incorrect importing of `motion` or `SmritiScrollArea` could break compilation.
  - *Mitigation*: Run `npm run lint` and `npm run build` immediately following changes.

### 12. Rollback Strategy
- Restore `SalesStudioTab.tsx` to its pre-edited state using git checkout or from backups if compile fails.

### 13. Verification Plan
1. Compile the applet using `compile_applet`.
2. Confirm the linter passes using `lint_applet`.
3. Verify that the UI correctly switches tabs on clicking "Quotations", "Sales Orders", etc.

### 14. Test Plan
- **Sub-navigation Click Test**: Verify that clicking tabs updates `subView` state and re-fetches relevant tables without layout blinking.
- **Resize Integrity Test**: Confirm that the flex container scales correctly with viewport resizing.

### 15. Documentation Impact
None.

### 16. Deployment Plan
Integrate the code changes into the standard development and production build pipeline.

### 17. Status
Completed.

### 18. Related ADRs
None.

### 19. Related Walkthroughs
- [Sales Studio Expansion Walkthrough](../../walkthrough/sales/Sales_Studio_Expansion_Walkthrough_v2.1.1.md)
