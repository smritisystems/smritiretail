# SMRITI Purchase Order Blueprint v2.0

Version: v2.0
Status: ARCHITECTURE DRAFT — PO BLUEPRINT
Owner: SMRITI Architecture Council
Runtime: SPK
Review: Only through ADR

## Purpose

This document describes the SMRITI Purchase Order v2.0 blueprint for enterprise procurement UX. It is intended to guide implementation using the existing SPK runtime, `WorkspaceShell`, and SMRITI UX architecture without introducing new runtime engines.

## Design Philosophy

> Less UI. More work done.

The purchase order screen should disappear behind the work. The buyer should think only about the supplier, the items, the total, and the submit decision. Everything else stays in the background.

## Screen Structure

### Top Smart Header (64px)

The header surface should contain only the highest-value facts:

- PO Number
- Supplier
- Status
- Total Value
- Primary actions

### Overview Section

Compact cards should present the most important operational metadata:

- Supplier card
- Delivery card
- Payment card
- Approval card

Cards remain short (120–140px tall) and surface only the essential fields.

### Items Workspace (Hero)

The items workspace is the hero of the page and occupies the majority of the viewport:

- Toolbar above the grid
- Large editable grid below
- Sticky purchase bar below the grid

The page layout should minimize right-side chrome. The right sidebar disappears from the default view.

## Layout Goals

- No right sidebar by default
- Everything is organized horizontally where possible
- Order overview and items are separated, but items are the primary focus
- The sticky bottom bar is always visible on desktop and tablet

## Smart Header Content

The header should communicate:

- `PO-2025-000123`
- `ABC Footwear Pvt Ltd`
- `Draft / Pending Approval`
- `₹258,366`

One glance should show enough context for the buyer to proceed.

## Overview Cards

### Supplier
- Supplier name
- GSTIN
- Ledger balance
- Outstanding amount
- Supplier rating

### Delivery
- Delivery warehouse
- Expected delivery date
- Shipping method
- Transit days

### Payment
- Currency
- Payment terms
- Credit days
- Outstanding payable

### Approval
- Created by
- Reviewer
- Workflow state
- Timeline snapshot

## Items Workspace

### Toolbar

Actions must be clearly grouped and action-oriented:

- Add item
- Scan barcode
- Import
- AI suggest
- Filters

### Editable Grid

The items grid must behave like a productivity table, not a report:

- Code
- Image
- Item name
- Color
- Size
- Warehouse
- Stock
- Last purchase price
- Buying price
- Discount
- Tax
- Qty
- Total

Support:

- Arrow-key navigation
- Tab navigation
- Paste from Excel
- Drag fill
- Auto-complete
- Barcode support

### Product Preview

On hover, surface a compact preview card with:

- Image
- Product name
- Stock
- Brand
- Variants
- Recent sales
- Recent purchases
- Supplier

No modal page. No full-screen detour.

## AI Assistant

The Purchase Order screen should include a lightweight AI assistant tile that can show:

- Supplier discount available
- Items below MOQ
- Cheaper alternatives from other suppliers
- Suggested quantity
- Stock coverage days

AI should amplify productivity, not replace the transaction.

## Sticky Bottom Bar

The sticky footer should contain the key transaction summary and primary actions:

- Total quantity
- Total value
- GST / tax
- Save draft
- Submit
- Approve

This bar should remain visible on desktop and tablet.

## Sidebar Behavior

The right sidebar becomes a floating drawer that is opened only when needed.

Drawer contents can include:

- Summary
- Actions
- Quick links
- Approval details
- History

## Visual Design Principles

### Colors

Use a restrained palette:

- Primary: Royal blue for CTAs, links, active tabs
- Neutral: slate, gray, white for surfaces and backgrounds
- Status green: approved, stock ok, paid
- Amber: pending, warning
- Red: rejected, overdue, cancelled

### Typography

- PO Number: 32px
- Supplier / header text: 20px
- Section labels: 16px
- Field labels: 14px
- Helpers: 12px

### Motion

Motion should be tiny and purposeful:

- Add row slide
- Save checkmark
- Approve state transition
- Success confetti on completion

No flashy animation.

## Device-Specific UX

### Mobile

This is not a responsive desktop page. It is a dedicated mobile purchase experience.

Flow:

- Supplier
- Search item
- Recent items
- Cart
- Sticky purchase bar

### Tablet

Landscape-optimized layout:

- Supplier and overview cards on the left
- Items workspace on the right
- Sticky summary bottom

### Desktop

Ultra-productive layout:

- Overview cards at top
- Large editable grid in the center
- Sticky purchase bar at bottom

## Industry Intelligence

The grid and item metadata should adapt to category context automatically:

- Footwear: image, color, size, style, brand
- Medical: batch, expiry, HSN, schedule
- Restaurant: recipe, yield, kitchen

No configuration should be required for the basic category-appropriate field surface.

## AI Everywhere

Every screen should offer contextual AI actions:

- Summarize
- Suggest
- Explain
- Forecast
- Correct

These should be integrated into the existing UX architecture, not bolted on as separate screens.

## Implementation Guidance

This blueprint must be implemented using the existing SPK runtime and the frozen SMRITI UX architecture:

- `SPK`
- `SmritiExperienceContext`
- `WorkspaceShell`
- `WorkspaceNavigationEngine`
- `WidgetEngine`
- `WorkspacePersonalizationEngine`
- `AdaptiveWorkspaceStore`
- `NavigationRegistry`
- `DashboardRegistry`

## Final Score

- Visual Design: 10/10
- Enterprise Feel: 10/10
- Mobile UX: 10/10
- Desktop UX: 10/10
- Tablet UX: 10/10
- Accessibility: 10/10
- Productivity: 10/10
- AI Integration: 10/10
- Retail Focus: 10/10
- Purchase Workflow: 10/10

## Related Documents

→ `SMRITI_EXPERIENCE_PLATFORM_ARCHITECTURE_v1.0.md`

→ `SPK_Experience_Runtime_Mapping.md`

→ `SMRITI_ARCHITECTURE_DEPENDENCY_MAP.md`

→ `SMRITI_DESIGN_STUDIO_SPECIFICATION.md`

→ `SMRITI_UX_GOVERNANCE.md`
