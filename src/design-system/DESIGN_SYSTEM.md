<!--
  Project      : SMRITI Business OS
  Product      : SMRITI Enterprise Design System (SEDS)
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Classification: Internal Platform Standard
-->

# SMRITI Enterprise Design System (SEDS) Governance & Architecture

**Status:** FROZEN — v1.0 (2026-07-26)

## 1. Core Design Principles
1. **Role-Based Workspaces:** Every user screen is tailored to their specific RBAC scope via a central SEDS Launchpad (Max 12 domain tiles).
2. **Whitespace & Clarity:** High whitespace, minimal decorative clutter, consistent typography hierarchy, and zero gradient overload.
3. **Vendor-Neutral SMRITI Identity:** Independent enterprise UX design system inspired by leading ERP systems while maintaining a distinct, recognizable identity.
4. **Accessibility (WCAG AA):** Visible focus indicators, keyboard navigation (`Tab`, `F2`, `Esc`, `Enter`), minimum 44px touch target sizing, and high contrast ratios.

---

## 2. Component Lifecycle Status Matrix

| Status | Definition | Production Approval |
| :--- | :--- | :--- |
| **`Stable`** | Fully tested, verified, and backward-compatible | ✅ Approved for all modules |
| **`Beta`** | Available for evaluation; minor API adjustments possible | ⚠️ Restricted to non-critical views |
| **`Deprecated`** | Marked for removal in next major release | ❌ New usage prohibited; migration required |
| **`Internal`** | Low-level design system primitive | 🔒 Framework use only |

---

## 3. Non-Negotiable Enterprise UX Rules
- **Rule 1: Action Limit** — Maximum 7 primary actions per toolbar/header.
- **Rule 2: Visual Hierarchy** — Maximum 3 visual hierarchy levels per workspace page.
- **Rule 3: Icon Library** — Use `lucide-react` exclusively. No secondary icon packs.
- **Rule 4: Spacing Scale** — All padding, margins, and gaps must strictly use SEDS 4px grid tokens (`space-1` to `space-12`).
- **Rule 5: Typography Scale** — Inter / Outfit / System font stack. Hardcoded pixel font sizes are prohibited.
- **Rule 6: Navigation Standard** — Header (48px) + Contextual Sidebar (240px/64px) + Launchpad -> List Report -> Object Page.
- **Rule 7: Dialog & Modal Standard** — Single SEDS modal behavior with overlay backdrop and action footer.
- **Rule 8: Toast & Alert Standard** — SEDS Non-blocking toast queue.

---

## 4. Appearance Modes & Branding Boundaries
- **Supported Modes:** `Light`, `Dark`, `System`
- **Permitted Brand Customizations:**
  - Company Logo URL
  - Primary Brand Accent Color
  - Secondary Brand Color
  - Optional Background Canvas Image
- **Prohibited Customizations:** Branding cannot alter spacing, font scales, layouts, navigation patterns, or component behavior.
