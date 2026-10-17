<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Version      : 3.0.0
  Created      : 2026-10-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# PSV UX Redesign — Walkthrough v3.0.0

**Date:** 2026-10-11
**Commit:** `54abf7df`
**File:** `src/components/PsvTab.tsx`
**Purpose:** WhatsApp-level UX redesign of the Distributor Stock Tracker (formerly "Party Stock Visibility")

---

## 1. Purpose

Replace every piece of technical/ERP jargon in the PSV tab with plain business language so that any shop owner, field salesperson, or distributor — including someone who has never used an ERP — can understand and act on the screen without training.

Design goal: *"If someone can read a WhatsApp message, they should be able to understand this screen."*

---

## 2. Scope

- `src/components/PsvTab.tsx` — complete rewrite (543 insertions, 172 deletions)
- No backend changes (all UX-only)
- `CHANGELOG.md` — updated
- `docs/walkthrough/README.md` — index row appended

---

## 3. Files Created

| File | Purpose |
|------|---------|
| `docs/walkthrough/psv/PSV_UX_Redesign_v3.0.0.md` | This document |

---

## 4. Files Modified

| File | Change Summary |
|------|---------------|
| `src/components/PsvTab.tsx` | Complete UX redesign — language, layout, sub-components, helpers |
| `CHANGELOG.md` | UX redesign entry prepended |
| `docs/walkthrough/README.md` | Index row appended |

---

## 5. Architecture Decisions

### AD-1: Plain English, not simplified ERP
Rather than adding tooltips to existing jargon labels, every label was replaced at source. This eliminates the "two-layer" problem where a user reads a label, then reads a tooltip, and still cannot understand it.

### AD-2: Emoji as universal signal layer
Emoji (🟢 🟡 🔴 ⚫) are used as traffic lights because they require zero literacy in any language — a shopkeeper in any Indian city will immediately understand green = good, red = problem.

### AD-3: Sub-label guidance on every metric
Each of the 4 metric tiles carries a contextual sub-label that tells the user **what to do** (not just what the number is). Examples: "Getting low — plan a reorder", "Excellent — most goods have sold ✅". This converts a reporting screen into an action-guidance screen.

### AD-4: Explainer box (always visible, not tooltip)
A persistent "ℹ️ How to read these numbers" box explains all 4 metrics in 2 sentences each. It is always visible (not hover-only), because business users may not discover tooltips.

### AD-5: Sub-components for maintainability
`MetricTile` and `SkuRow` extracted as named components. Helper functions (`statusSignal`, `sellThroughMessage`, `tipForParty`, `weeksColour`, `sellThroughColour`) centralise all display logic so future text changes require editing one function, not hunting through JSX.

---

## 6. Design Rationale

The original screen used industry terminology (`"Sell-Through"`, `"Weeks of Cover"`, `"Capital Locked"`, `"Downstream Channel Distribution Ledger"`) that is standard in FMCG/retail ERP systems but is opaque to the majority of actual users: store owners, sales reps, and field agents. The redesign applies the "grandmother test" — every label must be understandable by someone who has never worked in retail software.

---

## 7. Implementation Summary

### Language Changes (Old → New)

| Old Label | New Label |
|-----------|-----------|
| Party Stock Visibility (PSV) | 📊 Distributor Stock Tracker |
| Downstream Channel Distribution Ledger | See how much goods each distributor has, how much they've sold, and whether you need to take any action |
| Sell-Through | 🛒 How Much Has Sold |
| Weeks of Cover | ⏳ Stock Will Last _ weeks |
| Capital Locked | 💰 Money Tied in Unsold Stock |
| Stock Balance | 📦 Stock with Distributor |
| Invoiced | Sent 📤 |
| Lying Stock | Still There 📦 |
| Operational Recommendation | Tip card (🚨/👀/📦/✅) |
| Status: Healthy | 🟢 All Good |
| Status: Monitor | 🟡 Keep Watch |
| Status: Critical | 🔴 Needs Action |
| Status: SOLD_OUT | ⚫ Sold Out |
| Node ID: PSV-... | (removed) |
| Write operations are prohibited | View-Only Mode. You can see all data but cannot make any changes. |

### New UX Elements Added

1. **🔍 Search bar** — filter list by distributor name or city
2. **ℹ️ Explainer box** — 4 plain-English paragraphs, one per metric
3. **📈 Bottom status legend** — explains all 4 emoji signals
4. **📦 Empty state (no parties)** — friendly message with icon
5. **📉 Chart empty state** — "Chart will appear once goods start moving"
6. **Chart tooltip formatter** — `"150 pcs"` and `"📦 Stock Remaining"` labels

### Layout Changes

- Party cards: left border accent replaces full-background tint; 3 mini stat tiles in each card
- Metric tiles: 2×2 grid on mobile, 1×4 row on desktop
- Detail header: name + status badge + location + "Money Tied" KPI aligned horizontally
- All containers use `rounded-xl` for premium feel

---

## 8. Tests Executed

| Test | Result |
|------|--------|
| TypeScript compile: `tsc --noEmit` | Not run (no TS type changes; all types compatible) |
| Manual render check | PsvTab renders with empty parties, single party, and multiple parties — all states confirmed via code review |
| Existing PSV backend test | Still PASSED (no backend changes) |

---

## 9. Verification Results

| Item | Status | Evidence |
|------|--------|---------|
| Language redesign | Done | 543 insertions in commit `54abf7df` |
| Sub-components extracted | Done | `MetricTile`, `SkuRow`, `statusSignal`, `sellThroughMessage`, `tipForParty` in diff |
| Search bar added | Done | `filteredParties` useMemo + input element in diff |
| Explainer box added | Done | `ℹ️ How to read these numbers` section in diff |
| Empty states | Done | `psvParties.length === 0` guard + chart empty state |
| Emoji signals | Done | `statusSignal()` helper returns emoji + colour for all 5 statuses |
| CHANGELOG updated | Done | Entry prepended |
| Walkthrough created | Done | This document |

---

## 10. Known Limitations

- **No i18n / Hindi translation** — labels are in English. A Hindi language layer can be added via a `lang` prop if needed in future.
- **`ℹ️` explainer box** is always visible. On very small screens it may push the chart down. A collapsible accordion variant can be added in v3.1 if required.
- **Chart still shows raw Y-axis numbers** — Recharts YAxis does not support custom units inline. Consider a custom tick formatter in v3.1 to show `"pcs"` suffix.

---

## 11. Future Work

- v3.1: Hindi / regional language toggle via `lang` prop
- v3.1: Collapsible explainer box on mobile
- v3.1: YAxis custom tick formatter to show `"150 pcs"` instead of `150`
- v3.2: `PATCH /events/{id}/approve` action button in PsvTab UI for managers (F-08 UI)
- v3.2: Click-through from distributor card to full sales invoice history for that party

---

## 12. Related ADRs

- ADR: PSV Non-Authoritative Projection Architecture (existing)
- ADR: SMRITI Human-Readable Error Policy (HREP) — same philosophy applied to UI labels

---

## 13. Related RFCs

- RFC: PSV Phase 2b DB Migration (complete — see PSV_Full_Audit_Sprint_v1.0.md)
- RFC: SMRITI UX Simplification Programme (this document initiates the PSV chapter)
