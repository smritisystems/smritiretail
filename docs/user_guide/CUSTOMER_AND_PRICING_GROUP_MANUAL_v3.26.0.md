<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.26.0
  Created      : 2026-07-18
  Modified     : 2026-07-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Customer Group & Pricing Group: User Manual

> **Applies to:** SMRITI Retail OS v3.26.0 and above
> **Audience:** Store Managers, System Administrators, Billing Supervisors

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Customer Group — What It Is & Why It Matters](#2-customer-group)
3. [Pricing Group — What It Is & Why It Matters](#3-pricing-group)
4. [How Customer Group & Pricing Group Work Together](#4-how-they-work-together)
5. [Setting Up Customer Groups](#5-setting-up-customer-groups)
6. [Setting Up Pricing Groups](#6-setting-up-pricing-groups)
7. [Built-In Default Pricing Groups](#7-built-in-default-pricing-groups)
8. [Assigning a Pricing Group to a Customer](#8-assigning-a-pricing-group-to-a-customer)
9. [How the Price Engine Calculates the Effective Price](#9-price-engine)
10. [Rounding Rules Explained](#10-rounding-rules)
11. [Credit Limit Policies via Customer Group](#11-credit-limits)
12. [Common Business Scenarios](#12-common-business-scenarios)
13. [Frequently Asked Questions](#13-frequently-asked-questions)
14. [Glossary](#14-glossary)

---

## 1. Introduction

SMRITI Retail OS uses **two separate master records** to manage how customers are classified and how they are priced:

| Master | Answers the question | Used for |
|--------|---------------------|----------|
| **Customer Group** | *"What type of customer is this?"* | Classification, credit policy, reporting, GST rules |
| **Pricing Group** | *"Which price list applies to this customer?"* | Discount percent, price adjustment, rounding, scheme eligibility |

Keeping them separate gives you maximum flexibility. For example:

- A **Retailer** (Customer Group) can be on either **Retail Price** or **Distributor Price** (Pricing Group) depending on their business relationship with you.
- A **Corporate** customer group may have members on **VIP Price** or **Festival Price** during a campaign period.
- Your **Employee** staff can be in the **Staff** Customer Group while on the **Employee Price** Pricing Group (at cost price, no GST schemes).

---

## 2. Customer Group

### What Is a Customer Group?

A Customer Group is a **business classification label** applied to a customer. It answers one question:

> *"What type of business entity is this customer?"*

Customer Groups are used in:

- **Sales Reports** — Filter and segment revenue by customer type
- **Credit Limit Policies** — Set a maximum outstanding balance before sales are blocked
- **Payment Terms** — Define net-30, net-60, or COD terms per group
- **Loyalty Programs** — Apply loyalty tier rules by group
- **GST / Tax Rules** — Route composite or exempt customers correctly
- **Marketing Campaigns** — Target specific customer segments

### Standard Customer Groups for Indian Retail

| Customer Group | Typical Usage |
|----------------|---------------|
| **Retailer** | Shops buying for resale. Standard credit terms. |
| **Distributor** | Bulk wholesale buyers. Higher credit limits. |
| **Modern Trade** | Supermarkets, chains. Volume-based pricing. |
| **Corporate** | B2B company accounts. Purchase orders and credit invoicing. |
| **Government** | Government bodies. GeM / tender-based procurement. |
| **E-Commerce** | Marketplace fulfilment. Special invoice format. |
| **VIP / Loyalty** | High-value repeat customers. Premium treatment. |
| **Employee** | Internal staff purchases. Cost-price billing. |
| **Walk-in / Retail Cash** | Counter customers without an account. No credit. |

### What Customer Group Does NOT Control

Customer Group does **not** determine:
- The actual selling price
- Which discount percentage applies
- Whether the price should be rounded

That is controlled by the **Pricing Group**.

---

## 3. Pricing Group

### What Is a Pricing Group?

A Pricing Group is a **commercial pricing policy** applied to a customer. It answers one question:

> *"Which price list and discount structure applies when I sell to this customer?"*

Pricing Groups control:

| Field | What It Does |
|-------|--------------|
| **Base Price Field** | Which product price to start from: `price` (MRP/selling), `cost_price`, or `mrp` |
| **Discount %** | Percentage automatically deducted from the base price on every line item |
| **Price Adjustment** | Fixed amount added to or subtracted from the price (for markups or markdowns) |
| **Rounding Rule** | How the final price is rounded: `Nearest1`, `Nearest5`, `Nearest10`, or exact decimal |
| **Max Additional Discount %** | How much extra discount a salesperson can give beyond the automatic group discount |
| **Tax Inclusive** | Whether GST is already embedded in the price or calculated on top |
| **Scheme Eligible** | Whether scheme offers and buy-X-get-Y promotions apply |
| **Quantity Break Eligible** | Whether tiered quantity-break pricing applies |
| **Min Order Value** | Minimum order total for this pricing group to activate |

---

## 4. How They Work Together

```
Customer Record
    ├── customer_group_id  ──▶  Customer Group
    │                           (What type? Credit limit? Payment terms?)
    │
    └── pricing_group_id  ──▶  Pricing Group
                                (Which price? Discount? Rounding?)
                                        │
                                        ▼
                                Price Engine
                                (base price × discount × adjustment → round)
                                        │
                                        ▼
                                Effective Line Price on Invoice
```

**Key rule:** A customer must always have a Customer Group. A Pricing Group is **optional** — if none is assigned, the system uses the product's standard selling price with no discount.

---

## 5. Setting Up Customer Groups

### Via the API (System Administrator)

**Create a Customer Group:**

```http
POST /api/v1/crm/customer-groups
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "cg-distributor",
  "name": "Distributor",
  "description": "Wholesale distributor accounts",
  "credit_limit": 500000.00,
  "unlimited_credit": false,
  "auto_block_sales": true,
  "payment_terms_days": 30
}
```

**List All Customer Groups:**

```http
GET /api/v1/crm/customer-groups
```

**Get a Specific Customer Group:**

```http
GET /api/v1/crm/customer-groups/{group_id}
```

### Fields Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (e.g. `cg-retailer`) |
| `name` | string | Yes | Display name |
| `description` | string | No | Internal notes |
| `credit_limit` | decimal | No | Maximum outstanding balance (₹). Default 0. |
| `unlimited_credit` | boolean | No | If `true`, no credit limit check applies |
| `auto_block_sales` | boolean | No | If `true`, sales are blocked when limit is exceeded |
| `payment_terms_days` | integer | No | Net payment days (e.g. 30 for net-30) |

---

## 6. Setting Up Pricing Groups

### Via the API (System Administrator / Manager)

**Create a Pricing Group:**

```http
POST /api/v1/crm/pricing-groups
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "pg-wholesale",
  "name": "Wholesale Price",
  "description": "15% off MRP for wholesale accounts",
  "base_price_field": "price",
  "discount_percent": 15.00,
  "price_adjustment": 0.00,
  "rounding_rule": "Nearest1",
  "max_additional_discount_percent": 5.00,
  "tax_inclusive": true,
  "scheme_eligible": true,
  "quantity_break_eligible": true,
  "min_order_value": 5000.00
}
```

**List All Pricing Groups:**

```http
GET /api/v1/crm/pricing-groups
```

**Update a Pricing Group:**

```http
PUT /api/v1/crm/pricing-groups/{group_id}
Content-Type: application/json

{
  "discount_percent": 18.00
}
```

**Delete (Soft-Delete) a Pricing Group:**

```http
DELETE /api/v1/crm/pricing-groups/{group_id}
```

> **Note:** Deleting a Pricing Group does not delete any customers. Their `pricing_group_id` is set to `NULL` automatically. They will then fall back to standard (no-discount) pricing until a new group is assigned.

### Pricing Group Fields Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Display name (must be unique per branch) |
| `base_price_field` | string | No | `price` | Start price: `price`, `mrp`, or `cost_price` |
| `discount_percent` | decimal | No | `0.00` | Auto-deducted discount on every line item (%) |
| `price_adjustment` | decimal | No | `0.00` | Fixed ₹ markup (+) or markdown (−) per unit |
| `rounding_rule` | string | No | `Nearest1` | `Nearest1`, `Nearest5`, `Nearest10`, or `Exact` |
| `max_additional_discount_percent` | decimal | No | `0.00` | Max manual discount salesperson can apply |
| `tax_inclusive` | boolean | No | `true` | Whether GST is already in the price |
| `scheme_eligible` | boolean | No | `true` | Whether promo schemes apply |
| `quantity_break_eligible` | boolean | No | `false` | Whether quantity-break tiered pricing applies |
| `min_order_value` | decimal | No | `0.00` | Minimum cart value required (₹) |

---

## 7. Built-In Default Pricing Groups

SMRITI Retail OS ships with five ready-to-use Pricing Groups for the default company/branch. These cover the most common Indian retail pricing strategies:

| ID | Name | Base Price | Discount | Rounding | Schemes | Qty Break | Min Order |
|----|------|-----------|----------|----------|---------|-----------|-----------|
| `pg-retail` | **Retail Price** | Selling Price | 0% | Nearest ₹1 | Yes | No | None |
| `pg-distributor` | **Distributor Price** | Selling Price | 15% | Nearest ₹1 | Yes | Yes | ₹5,000 |
| `pg-vip` | **VIP Price** | Selling Price | 10% | Nearest ₹1 | Yes | No | None |
| `pg-employee` | **Employee Price** | **Cost Price** | 0% | Nearest ₹1 | No | No | None |
| `pg-festival` | **Festival Price** | Selling Price | 20% | Nearest ₹5 | Yes | Yes | None |

### When to Use Each

**Retail Price (`pg-retail`)**
Standard counter billing at MRP / selling price. No automatic discount. Salesperson can apply up to 5% additional discount if needed. Use for walk-in customers, retail shop counter, and standard B2C sales.

**Distributor Price (`pg-distributor`)**
15% off selling price for wholesale/distribution accounts. Quantity-break pricing applies (e.g. buy 100 units, get an additional tier discount). Minimum order ₹5,000. Use for sub-distributors and stockists.

**VIP Price (`pg-vip`)**
10% off selling price for loyalty / high-value repeat customers. Scheme offers apply. No minimum order. Use for registered loyalty members or key accounts.

**Employee Price (`pg-employee`)**
Based on **cost price** (not selling price). Zero discount on top of cost. No schemes or quantity breaks. Use exclusively for staff purchases — ensures employees pay cost price with no margin.

**Festival Price (`pg-festival`)**
20% off selling price. Rounding to nearest ₹5 (cleaner cashier experience). Quantity breaks apply. Use during festive campaigns (Diwali, Holi, New Year) — activate by assigning customers to this group for the campaign period, then revert afterwards.

---

## 8. Assigning a Pricing Group to a Customer

### When Creating a New Customer

```http
POST /api/v1/crm/customers
Content-Type: application/json

{
  "id": "cust-0001",
  "name": "Amit Electronics",
  "mobile": "9876543210",
  "email": "amit@electronics.com",
  "customer_group_id": "cg-retailer",
  "pricing_group_id": "pg-distributor"
}
```

### Updating an Existing Customer's Pricing Group

```http
PUT /api/v1/crm/customers/{customer_id}
Content-Type: application/json

{
  "pricing_group_id": "pg-vip"
}
```

### Removing a Pricing Group (Revert to Standard Pricing)

```http
PUT /api/v1/crm/customers/{customer_id}
Content-Type: application/json

{
  "pricing_group_id": null
}
```

---

## 9. How the Price Engine Calculates the Effective Price

When a sales invoice or POS sale is created, SMRITI automatically resolves the customer's pricing parameters **before** any line item price is calculated. The sequence is:

### Step 1 — Resolve Pricing Parameters

```
GET /api/v1/crm/customers/{customer_id}/resolve-pricing
```

The engine walks this chain:

```
Customer
  └── Has pricing_group_id?
        ├── YES → Load PricingGroup → return its fields
        └── NO  → Return system defaults (0% discount, Nearest1, price field)
```

### Step 2 — Apply to Each Line Item

For each product line in the invoice:

```
Base Price  =  product.{base_price_field}           e.g. product.price = ₹100
After Disc  =  Base Price × (1 − discount% / 100)  100 × (1 − 10/100) = ₹90
Adjusted    =  After Disc + price_adjustment        90 + 0 = ₹90
Rounded     =  apply rounding_rule                  Nearest1 → ₹90
GST         =  Rounded × (gst_rate / 100)           90 × 18% = ₹16.20
Line Total  =  Rounded + GST                        90 + 16.20 = ₹106.20
```

### Real Example — VIP Customer buying 2 units of ₹100 product at 18% GST

| Step | Calculation | Result |
|------|-------------|--------|
| Base Price (Selling) | Product selling price | ₹100.00 |
| VIP discount (10%) | 100 × 0.90 | ₹90.00 |
| Price Adjustment | 0 | ₹90.00 |
| Rounding (Nearest1) | Already whole number | **₹90** |
| Tax (18% GST × 2 units) | 2 × 90 × 0.18 | ₹32.40 |
| Line Total (2 units) | 2 × 90 + 32.40 | **₹212.40** |

---

## 10. Rounding Rules Explained

| Rule | Behaviour | Example |
|------|-----------|---------|
| `Nearest1` | Round to nearest whole rupee | ₹89.60 → **₹90** |
| `Nearest5` | Round to nearest ₹5 | ₹87.00 → **₹85**, ₹88.00 → **₹90** |
| `Nearest10` | Round to nearest ₹10 | ₹84.00 → **₹80**, ₹86.00 → **₹90** |
| `Exact` | No rounding (2 decimal places) | ₹89.67 → **₹89.67** |

**When to use each:**
- **Nearest1** — Default for most retail scenarios. Clean prices, simple billing.
- **Nearest5** — Festival / promotional sales. Avoids awkward pricing like ₹83 or ₹87.
- **Nearest10** — Wholesale / high-value items. Simpler invoicing.
- **Exact** — Technical / engineering goods, pharmacy, or when government audits require exact computation.

---

## 11. Credit Limits via Customer Group

Credit limit enforcement is configured at the **Customer Group** level, not the Pricing Group level.

### How It Works

When a sales invoice is submitted:

1. SMRITI looks up the customer's `customer_group_id`.
2. Checks the customer's current `outstanding` balance.
3. Adds the new invoice's grand total to the outstanding balance.
4. Compares against the group's `credit_limit`.

| Outcome | What Happens |
|---------|-------------|
| Within limit | Invoice is created normally |
| Exceeds limit, `auto_block_sales = false` | Invoice created with a **credit warning** |
| Exceeds limit, `auto_block_sales = true` | Invoice is **blocked** with an error message |
| Group has `unlimited_credit = true` | No check is performed — invoice always proceeds |

### Recommended Credit Limit Settings

| Customer Group | Suggested Setting |
|---------------|------------------|
| Walk-in / Retail Cash | `unlimited_credit = true` (no account credit) |
| Retailer | `credit_limit = 50000`, `auto_block_sales = false` |
| Distributor | `credit_limit = 500000`, `auto_block_sales = true` |
| Corporate | `credit_limit = 1000000`, `auto_block_sales = false` |
| Employee | `unlimited_credit = true` (deducted from salary) |

---

## 12. Common Business Scenarios

### Scenario A — New Distributor Onboarding

> Amit Distributors is a new wholesale buyer. You want to give them 15% off and allow large credit orders.

1. Ensure the **Distributor** Customer Group exists with `credit_limit = 500000`, `unlimited_credit = false`.
2. Assign the customer `customer_group_id = cg-distributor`.
3. Assign `pricing_group_id = pg-distributor` (15% auto-discount, ₹5,000 min order, quantity-break eligible).

Result: Every sales invoice raised for Amit Distributors will automatically price at 15% below selling price, rounded to the nearest ₹1.

---

### Scenario B — Festive Campaign (Diwali Sale)

> For one month, all retail counter customers get 20% off, rounded to the nearest ₹5.

1. Use the built-in **Festival Price** (`pg-festival`) Pricing Group.
2. Update your regular walk-in customers' `pricing_group_id` to `pg-festival` for the campaign period.
3. At the end of the campaign, update them back to `pg-retail` or `null`.

> **Tip:** You can use the bulk update API or filter by Customer Group to update all walk-in customers at once.

---

### Scenario C — Employee Purchase

> A staff member buys goods from the store at cost price.

1. Ensure the customer record has `customer_group_id = cg-employee` (with `unlimited_credit = true`).
2. Set `pricing_group_id = pg-employee`.
3. The price engine will use `cost_price` as the base price, apply 0% discount, and bill at cost.

---

### Scenario D — Revoking a Special Price (Customer Left VIP Program)

> A customer's VIP membership has expired. Revert them to standard retail pricing.

```http
PUT /api/v1/crm/customers/{customer_id}
Content-Type: application/json

{ "pricing_group_id": null }
```

The customer reverts to standard selling price immediately on the next invoice.

---

### Scenario E — Retired Pricing Group (Discontinuing a Price List)

> You are discontinuing the "Festival Price" group after the campaign.

```http
DELETE /api/v1/crm/pricing-groups/pg-festival
```

All customers previously assigned to `pg-festival` will have `pricing_group_id` set to `NULL` automatically (ON DELETE SET NULL). They will bill at standard price until you reassign a group.

---

## 13. Frequently Asked Questions

**Q: Can a customer belong to more than one Pricing Group at the same time?**
A: No. Each customer has exactly one active Pricing Group (or none). If you need complex multi-tier pricing, create a new Pricing Group that combines the rules.

**Q: Does the Pricing Group discount stack with additional discounts given at the POS?**
A: Controlled by `max_additional_discount_percent`. The salesperson can give up to that additional percent on top of the group discount. The combined effective price is shown at the billing terminal.

**Q: Can I change a Pricing Group's discount percent mid-month?**
A: Yes. Changes take effect **immediately** on the next invoice. Past invoices are unaffected — they retain the price calculated at the time of billing.

**Q: What happens to existing invoices if I delete a Pricing Group?**
A: Existing invoices are never changed. They are historical records. Only new invoices going forward use the updated pricing.

**Q: Can a Pricing Group be used without a Customer Group?**
A: No. Every customer must have a Customer Group. The Pricing Group is optional.

**Q: My distributor is exempt from GST. Where do I configure that?**
A: GST exemption is configured at the Customer level (`gst_category = Exempt`) or at the Product level (`gst_rate = 0`). The Pricing Group handles pricing only, not tax configuration.

**Q: How do I know which Pricing Group parameters will apply to a customer before I create an invoice?**
A: Use the resolve-pricing endpoint:
```http
GET /api/v1/crm/customers/{customer_id}/resolve-pricing
```
This returns the full set of pricing parameters that will be applied on the next invoice.

---

## 14. Glossary

| Term | Definition |
|------|-----------|
| **Customer Group** | A business classification label on a customer. Controls credit limits, payment terms, and reporting segments. |
| **Pricing Group** | A commercial pricing policy applied to a customer. Controls which price field, discount percent, adjustments, and rounding apply. |
| **Base Price Field** | The product field used as the starting price: `price` (selling price), `mrp` (maximum retail price), or `cost_price` (purchase cost). |
| **Discount Percent** | Automatic percentage deducted from the base price on every line item of an invoice. |
| **Price Adjustment** | A fixed rupee amount added to (+) or deducted from (-) the unit price after the percentage discount. |
| **Rounding Rule** | The method used to round the final effective price to a whole number or nearest multiple. |
| **Scheme Eligible** | Whether promotional buy-X-get-Y or seasonal scheme offers can be applied on top of the Pricing Group discount. |
| **Quantity Break Eligible** | Whether tiered volume pricing (e.g. buy 50 units = extra 5% off) applies to this customer. |
| **ON DELETE SET NULL** | Database behaviour: when a Pricing Group is deleted, all linked customers' pricing_group_id is automatically set to NULL (no pricing group), preventing broken references. |
| **Price Engine** | The SMRITI internal calculation sequence that resolves base price to discount to adjustment to rounding to GST to line total at the time an invoice is created. |
| **resolve-pricing endpoint** | GET /api/v1/crm/customers/{id}/resolve-pricing — returns the complete set of effective pricing parameters for a customer without creating an invoice. |

---

*This document is generated from SMRITI Retail OS v3.26.0 source code and verified against the live test suite.*
*Last updated: 2026-07-18*
