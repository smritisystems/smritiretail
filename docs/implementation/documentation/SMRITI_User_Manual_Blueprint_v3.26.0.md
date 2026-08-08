<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | aitdl.com
  Version      : 3.26.0
  Created      : 2026-08-05
  Modified     : 2026-08-05
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Documentation Blueprint
  Notes        : Blueprint is written by a domain expert with 20+ years of retail systems experience.
-->

# SMRITI Retail OS — User Manual Blueprint (v3.26.0)

## 1. Purpose

This blueprint defines the structure, authoring approach, and delivery plan for the SMRITI Retail OS User Manual. It is the first step before writing the actual manual content, ensuring the guide is aligned with enterprise retail workflows, operator needs, and long-term product strategy.

## 2. Author & Editorial Authority

- **Author:** Jawahar Ramkripal Mallah
- **Experience:** 20+ years in retail systems design, ERP implementation, and user guidance frameworks
- **Role:** Chief Systems Architect & Creator

> The author is the primary authority on SMRITI Retail OS product behavior, business workflows, and documentation quality expectations.

## 3. Objectives

1. Establish a modular user manual architecture that supports growing retail domain coverage.
2. Define a product-centric writing style focused on clarity, operational accuracy, and real-world store workflows.
3. Create a reusable content framework for future manuals, training guides, and knowledge base articles.
4. Ensure the manual can be delivered as both Markdown source and HTML output.

## 4. Scope

- **Primary Scope:** SMRITI Retail OS core user manual content for the Item Master module, with references to related workflows such as pricing, inventory, purchase, and sales.
- **Expanded Scope:** Modular documentation design for future modules including POS, Purchase Order, Inventory, Sales Studio, CRM, and Reporting.
- **Exclusions:** Detailed technical developer guides, API manuals, and infrastructure deployment instructions.

## 5. Blueprint Strategy

### 5.1 Content Modules

The manual will be split into the following high-level modules:

- Introduction and product overview
- System navigation and login
- Item Master workflows
- Product catalog creation and variant management
- Pricing and tax configuration
- Barcode and label management
- Inventory controls and stock settings
- Editing, maintenance, and bulk operations
- Troubleshooting and FAQs
- Glossary and definitions

### 5.2 Writing Principles

- Use simple, action-oriented language.
- Favor procedural steps with clear results.
- Include real retail examples where possible.
- Maintain consistency in terminology, especially for SKU, MRP, price group, and customer group.
- Keep the manual future-friendly by using a modular layout and reusable sections.

### 5.3 Output Formats

- Primary authoring format: Markdown (`docs/user_guide/*.md`)
- Presentation format: HTML (`toot/*.html`)
- Future-ready formats: PDF export from HTML or static site generation

## 6. Structure & Deliverables

### 6.1 Deliverable 1 — Blueprint Document

- `docs/implementation/documentation/SMRITI_User_Manual_Blueprint_v3.26.0.md`
- Contains author authority, scope, objectives, structure, and content plan.

### 6.2 Deliverable 2 — Modular Markdown Manual

- `docs/user_guide/ITEM_MASTER_MANUAL_v3.26.0.md`
- Additional module manuals can be added as separate Markdown files.

### 6.3 Deliverable 3 — Rendered HTML Manual

- `toot/ITEM_MASTER_MANUAL_v3.26.0.html`
- Generated from Markdown for fast review and demo usage.

## 7. Recommended Process

1. Finalize the blueprint with stakeholder approval.
2. Author the Item Master manual in Markdown.
3. Render the manual to HTML using the existing `scripts/render_user_manuals.mjs` tool.
4. Review the content with product SMEs and retail operations experts.
5. Publish the manual and record the version metadata.

## 8. Future Scope & Evolution

- Add new module manuals as individual Markdown files in `docs/user_guide/`.
- Introduce a documentation index generator for `USER_GUIDE.md` if not already in place.
- Evolve the asset to a searchable documentation portal when the product scales.
- Maintain author credibility by preserving expert review notes and change history.

## 9. Validation Criteria

- Manual follows the approved structure and writing principles.
- Content is accurate for current SMRITI workflows and item master behavior.
- Output HTML is readable, navigable, and visually consistent.
- Author review is documented in revision notes.

## 10. Approval

- **Approved by:** Jawahar Ramkripal Mallah
- **Date:** 2026-08-05
- **Status:** Blueprint completed and ready for manual authoring
