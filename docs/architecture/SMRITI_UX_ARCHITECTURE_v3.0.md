<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritisys.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Specification: SMRITI UX Architecture v3.0 / SDEF v1.0
  Version      : 3.0.0
  Created      : 2026-08-04
  Classification: Internal Product Architecture
-->

# SMRITI UX Architecture v3.0

**Status:** DRAFT PRODUCT ARCHITECTURE — v3.0 (2026-08-04)

## SMRITI Dual Experience Framework (SDEF) v1.0

**Tagline:**

> One Platform. Two Native Experiences. Zero Compromise.

The **SMRITI Dual Experience Framework (SDEF) v1.0** is the formal product architecture for SMRITI UX, defining a dual-path UX strategy where a single shared design system supports two dedicated user experiences:

- **Mobile UX** for on-the-go operations, cashier workflows, and touch-first tasks.
- **Desktop UX** for productivity workflows, keyboard-first workspaces, and enterprise data management.

This architecture mandates:

- 100% shared business logic and services
- 100% shared design system foundation
- Dedicated UX delivery per platform
- Governance and release gates for both UX systems

---

## 1. Architecture Principles

### 1.1 Core Principle

- **Two Dedicated UX. One Shared Design System.**

### 1.2 Product Identity

- **SMRITI Dual Experience Framework (SDEF)** is the product architecture brand.
- Purpose: establish a formal, product-ready UX architecture with separate Mobile and Desktop experiences bound by one shared design system and shared business services.
- Outcome: each screen is implemented in both UX systems with consistent style, optimized interaction, and shared domain logic.

### 1.3 Governance Rules

1. **Never convert Desktop into Mobile.**
2. **Never stretch Mobile into Desktop.**
3. **Business logic is shared.** UX is dedicated.
4. **Every screen exists in both UX systems.**
5. **Design System is the single source of truth.**

---

## 2. Layer 1 — Shared Foundation (100% Common)

This layer is never duplicated.

```
SMRITI Design System

├── Brand Identity
├── Colors
├── Typography
├── Icons
├── Motion
├── Tokens
├── Components
├── Accessibility
├── Design Rules
├── UX Governance
└── Business Services
```

### 2.1 Shared Foundation Scope

- **Brand Identity**: logo, brand palette, voice, visual personality
- **Colors**: shared color palette and semantic color tokens
- **Typography**: textual scale and font rules
- **Icons**: iconography system and interaction glyphs
- **Motion**: animation and transition rules
- **Tokens**: spacing, elevation, border radius, opacity, shadow
- **Components**: shared UI primitives, component contracts, and design system library
- **Accessibility**: shared accessibility standards and testing criteria
- **Design Rules**: layout, spacing, behaviour rules, and interaction patterns
- **UX Governance**: approval gates, certification criteria, and release standards
- **Business Services**: APIs, validation rules, pricing, taxes, inventory, permissions

### 2.2 Shared Components

```
WorkspaceCard
Toolbar
Bottom Sheet
Dialog
Notification
Button
Input
Table
Chart
```

- Style remains identical across Mobile and Desktop.
- Behavior adapts to the UX mode.
- Implementation uses shared contracts and tokens.

---

## 3. Layer 2 — Dedicated UX

### 3.1 Mobile UX

**Purpose:** Fast. Native. One Thumb.

Designed specifically for:

- Cashier
- Salesman
- Store Staff
- Warehouse Staff
- Owner on Mobile

#### 3.1.1 Navigation

- Bottom Navigation
- Bottom Sheet
- Floating Pay Bar
- Swipe Gestures
- No sidebar

#### 3.1.2 POS Workflow

```
Scan

↓

Items

↓

Cart

↓

Pay

↓

Print
```

- Target: maximum 3–5 seconds from scan to print.

#### 3.1.3 Forms

- Never desktop forms.
- Use:

```
Bottom Sheet

↓

Stepper

↓

Quick Selection
```

#### 3.1.4 Tables

- Never traditional desktop tables.
- Use:

```
Cards

↓

List

↓

Timeline
```

#### 3.1.5 Primary Principle

- Everything reachable with one thumb.

---

### 3.2 Desktop UX

**Purpose:** Maximum Productivity.

Designed for:

- Manager
- Accountant
- Purchase
- Inventory
- Admin
- Owner

#### 3.2.1 Navigation

- Sidebar
- Workspace
- Dock Panels
- Command Palette
- Keyboard

#### 3.2.2 Workspace

```
Sidebar

↓

Workspace

↓

Inspector

↓

Properties
```

#### 3.2.3 Tables

- Enterprise Data Grid
- Filters
- Grouping
- Freeze Columns
- Pivot
- Export

#### 3.2.4 Forms

- Property Panels
- Dialogs
- Side Sheets
- Multi-column Layout

#### 3.2.5 Primary Principle

- Everything optimized for keyboard and mouse.

---

## 4. Adaptive Modes

Both UX systems support:

### Simple

```
Search

Items

Pay
```

### Standard

```
Customer

Discount

Payment
```

### Advanced

- Everything.

---

## 5. Industry Packs

Same UX. Different business.

```
Footwear
Medical
Restaurant
Jewellery
Electronics
Wholesale
```

- Only business widgets change.
- Industry packs consume the shared UX and shared business services.

---

## 6. Screen Matrix

| Module | Mobile UX | Desktop UX |
| --- | --- | --- |
| POS | Native Flow | Workspace Flow |
| Purchase | Mobile Form | Enterprise Grid |
| Inventory | Cards | Grid + Panels |
| CRM | Timeline | Workspace |
| Dashboard | Cards | Multi-panel |

---

## 7. Folder Structure

```
src/

├── design-system/
├── mobile/
├── desktop/
├── shared/
├── business/
├── services/
├── modules/
```

- Business logic is never duplicated.
- Only UX is duplicated in dedicated Mobile and Desktop presentation layers.

---

## 8. Design Studio

The Design Studio validates both UX systems.

```
SMRITI Design Studio

↓

Mobile UX

↓

Desktop UX

↓

Compare

↓

Approve

↓

Implement
```

---

## 9. Release Gate

No screen reaches production unless it passes:

### Mobile
- One Thumb
- Touch
- Scan
- Accessibility

### Desktop
- Keyboard
- Productivity
- Workspace
- Accessibility

Both must pass.

---

## 10. Success Metrics

Every UX change must improve one or more of:

- Time to bill
- Click count
- Touch count
- Keyboard efficiency
- User errors
- Training time
- Accessibility score

---

## 11. Product Architecture Outcome

The SMRITI Dual Experience Framework (SDEF) makes SMRITI UX a formal product architecture instead of a design experiment.

It positions the platform to deliver:

- Two first-class UX systems
- One governing design system
- One shared business platform
- Distinct delivery and QA gates for Mobile and Desktop

---

## 12. Naming & Positioning

- **Framework Name:** SMRITI Dual Experience Framework (SDEF)
- **Version:** v1.0
- **Positioning:** One platform, two native experiences, zero compromise.
- **Intent:** Clearly communicate that SMRITI is intentionally building two first-class user experiences with a shared design and business foundation.
