<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.35.0
  Created      : 2026-09-24
  Modified     : 2026-09-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Inward Goods Receipt Note (GRN): Damage Quantity Treatment & Indian Landed Cost Architecture

## Executive Summary

In Indian retail, distribution, and manufacturing enterprises, the **Goods Receipt Note (GRN)** is the foundational commercial, statutory, and inventory document. It serves as the physical proof of receipt where physical verification reconciles vendor delivery against contractual Purchase Orders and supplier Tax Invoices.

This architecture specification provides a comprehensive, deep-dive examination of two critical operational and statutory pillars in Indian GRN workflows:
1. **Damage Quantity (`Damage QTY`) Handling**: Physical segregation, inventory valuation impacts (Normal vs. Abnormal Loss under Ind AS 2 / AS 2), statutory GST compliance under **Section 17(5)(h) of the CGST Act 2017** (blocked Input Tax Credit), and operational debit note generation.
2. **Components of Landed Cost in India**: The 6 core cost components (Product Cost FOB/EXW, Freight/Shipping, Labor/Handling, Marine/Transit Insurance, Customs Duties BCD/SWS, and CHA Clearance Fees), their statutory tax treatment (ITC vs. Non-Creditable Capitalization), the distinction between **Addon Before Tax** and **Addon After Tax**, and mathematical apportionment algorithms ensuring zero-cent rounding variance.

---

## Part I: Damage Quantity in GRN (Deep Research & Architecture)

### 1. The Physical Inward Reality
When a consignment arrives at the retail store or central warehouse dock, the receiving supervisor inspects cartons and packaging. Units physically received fall into four discrete operational categories:
$$\text{Document Qty (Doc Qty)} = \text{Contractual Invoiced Quantity billed by Vendor}$$
$$\text{Actual Received Qty (Act Qty)} = \text{Total units physically unloaded at dock}$$
$$\text{Damage Qty} = \text{Units physically present but broken, soiled, expired, or unsellable}$$
$$\text{Accepted Sound Qty} = \text{Act Qty} - \text{Damage Qty}$$
$$\text{Shortage Qty} = \max(0, \text{Doc Qty} - \text{Act Qty})$$

```
+-----------------------------------------------------------------------------------+
|                           VENDOR DISPATCH (Doc Qty)                              |
+-----------------------------------------------------------------------------------+
                                       |
                   [Inward Receiving & Physical Inspection Dock]
                                       |
        +------------------------------+------------------------------+
        |                                                             |
   [Physically Received (Act Qty)]                             [Transit Shortage]
        |                                                             |
   +----+-------------------------+                             (Doc Qty - Act Qty)
   |                              |                                   |
[Sound Sellable Stock]     [Damage QTY]                        • Billed but missing
(Act Qty - Damage Qty)     • Broken / Leaking / Soiled         • Shortage Debit Note
   |                       • Expired / Broken Seals                   |
   v                              |                                   v
Available in WMS/POS              v                             Claim against Vendor
for Billing               [Damaged Staging / RMA]                 or Transporter
                                  |
            +---------------------+---------------------+
            |                                           |
    [Vendor Debit Note]                         [Transit Insurance]
    (Vendor bears loss)                         (Carrier bears loss)
```

---

### 2. Statutory GST Mandate: Section 17(5)(h) of the CGST Act, 2017
Under Indian Goods and Services Tax law, Input Tax Credit (ITC) eligibility is governed by Section 16 (eligibility and conditions) and Section 17 (apportionment of credit and blocked credits).

**Section 17(5)(h) of the CGST Act, 2017 explicitly states:**
> *"Notwithstanding anything contained in sub-section (1) of section 16 and subsection (1) of section 18, input tax credit shall not be available in respect of goods lost, stolen, destroyed, written off or disposed of by way of gift or free samples."*

#### Critical Statutory Implications for Retailers:
1. **No ITC on Damaged / Destroyed Units**: If a retailer claims ITC on the full invoice quantity (including damaged goods) and subsequently writes off the damaged goods, the ITC on those damaged units **must be reversed** in GSTR-3B under Table 4(B)(2) (Other Reversals) with applicable interest under Section 50.
2. **Mitigation via Commercial Debit Note**: If the damaged goods are identified at the GRN gate before invoice booking, the buyer raises a **Debit Note** against the vendor for:
   $$\text{Debit Note Value} = (\text{Damage Qty} \times \text{Invoice Rate}) + \text{Applicable GST}$$
   The vendor then issues a corresponding **GST Credit Note** under Section 34 of the CGST Act. The vendor reduces their output tax liability in GSTR-1, and the buyer only avails ITC on the **Accepted Sound Quantity**. This completely avoids Section 17(5)(h) reversal complications!

---

### 3. The 3 Operational Models for Damage QTY at Inward

#### Model A: Net Inward Acceptance with Immediate Vendor Debit Note (Standard Industry Practice)
* **Used by**: Modern organized retail (Reliance Retail, Trent/Westside, DMart, Shoppers Stop).
* **Mechanism**: 
  - GRN records `Doc Qty`, `Act Qty`, and `Damage QTY`.
  - Sellable inventory ledger is incremented **only by Sound Qty** (`Act Qty - Damage QTY`).
  - System automatically creates an unposted **Vendor Debit Note** for `Damage QTY * Invoice Rate + GST`.
  - Vendor is informed via automated RMA dispatch or destruction certificate.
  - Accounts Payable liability is booked net of Debit Note.
* **Accounting Entries**:
  ```text
  1. At GRN Posting:
     Inventory Asset A/c               Dr.   (Sound Qty * Unit Landed Cost)
     GRN Clearing / Suspense A/c       Cr.   (Sound Qty * Invoice Rate)
     Landed Cost Clearing A/c          Cr.   (Allocated Freight & Addons)

  2. At Purchase Bill Booking:
     GRN Clearing / Suspense A/c       Dr.   (Sound Qty * Invoice Rate)
     Input CGST / SGST / IGST A/c      Dr.   (Tax on Sound Qty ONLY)
     Vendor A/c                        Cr.   (Net Payable for Sound Qty)
  ```

#### Model B: Gross Inward with Quarantine Staging (Return to Vendor / Scrap)
* **Used by**: High-value electronics, pharmaceuticals, bonded warehouses.
* **Mechanism**:
  - Full `Act Qty` is received into the ERP.
  - Sound Qty goes to `BIN-SOUND-01` (Sellable).
  - Damage Qty is routed to `BIN-QUARANTINE-DAMAGED` (Non-sellable / Blocked from POS billing).
  - If vendor agrees to replace: Goods Return Memo (RTV) is dispatched.
  - If goods are scrapped locally: Write-off voucher is executed, and ITC on damaged units is reversed under Section 17(5)(h).

#### Model C: Transit Damage under FOB/CIF Carrier Insurance
* **Used by**: Inter-state road transport, ocean imports.
* **Mechanism**:
  - Consignment is received with an open delivery or damaged condition endorsement on the Lorry Receipt (LR) / Transporter Delivery Challan.
  - Joint survey is conducted by surveyor appointed by the Marine / Transit Insurance company.
  - Claim is lodged against the insurance underwriter; damaged goods are salvaged or surrendered to insurers.

---

### 4. Inventory Valuation: Normal Loss vs. Abnormal Loss (Ind AS 2 / AS 2)

Under **Indian Accounting Standard (Ind AS) 2 - Valuation of Inventories** (and AS 2):
* **Paragraph 10**: Cost of purchase includes purchase price, import duties, other non-recoverable taxes, and transport, handling and other costs directly attributable to the acquisition.
* **Paragraph 16(a)**: *"Abnormal amounts of wasted materials, labour or other production costs"* are **excluded** from the cost of inventories and recognized as an expense in the period in which they are incurred.

| Loss Category | Operational Example | Accounting Treatment under Ind AS 2 | Effect on Unit Landed Cost |
| :--- | :--- | :--- | :--- |
| **Normal Loss** | Inherent transit evaporation, moisture loss in bulk grains/chemicals, standard cutting shrinkage (0.5%–1%). | Cost of lost units is **absorbed** by the remaining sound units. Total consignment cost is divided by sound quantity. | $\text{Unit Cost} = \frac{\text{Total Cost}}{\text{Sound Qty}}$ (Cost per unit increases) |
| **Abnormal Loss** | Road accident, water ingress, cartons crushed by forklift, gross handling damage. | **Prohibited from being capitalized into inventory**. Must be segregated and expensed to Profit & Loss (or debited to Vendor / Insurer). | Unit landed cost of sound units remains unaffected. |

---

## Part II: Components of Landed Cost in India (The 6 Pillars)

In India, procuring inventory entails multiple direct ancillary costs before the goods reach the warehouse in saleable condition. Capitalizing these costs into inventory is mandated by Ind AS 2 and Tax Audit requirements under Section 145A of the Income Tax Act, 1961.

```
+---------------------------------------------------------------------------------------------+
|                          COMPONENTS OF LANDED COST IN INDIA                                 |
+---------------------------------------------------------------------------------------------+
| 1. Product Cost (FOB / EXW)       : Baseline supplier invoice price                         |
| 2. Freight & Shipping Charges     : Ocean, air, domestic GTA transport                     |
| 3. Labor & Handling Charges       : CFS handling, port dock labor, loading/unloading/Hamali |
| 4. Marine / Transit Insurance     : Transit insurance premium during transit                |
| 5. Customs Duties & Taxes         : BCD (Basic Customs Duty) + SWS (Social Welfare 10%)     |
| 6. Clearance & Brokerage Fees     : Custom House Agent (CHA) charges & custodian fees       |
+---------------------------------------------------------------------------------------------+
```

---

### Component 1: Product Cost (FOB / EXW)
* **Definition**: Baseline price invoiced by the manufacturer or primary supplier.
  - **EXW (Ex-Works)**: Buyer bears all logistics costs from the seller's factory gate.
  - **FOB (Free On Board)**: Seller delivers goods onto the vessel/carrier at the port of origin; buyer bears international freight and inward logistics.
  - **FOR Destination (Free On Road)**: Seller delivers directly to buyer's door (freight already embedded in product cost).
* **Tax Treatment**: Standard GST (5%, 12%, 18%, 28%) is levied on the tax invoice. GST is claimed as Input Tax Credit (ITC) and is **not capitalized** into landed cost, provided the buyer is a regular GST registered taxpayer.

---

### Component 2: Freight and Shipping Charges
* **Definition**: Transport fees incurred to move goods from seller to destination warehouse (ocean freight, air cargo, or domestic road transport).
* **Statutory GST Complexity in India (GTA Rules)**:
  - **Goods Transport Agency (GTA) Services**:
    * **Reverse Charge Mechanism (RCM)**: If GTA does not pay GST under forward charge, the recipient company pays **5% GST under RCM** (2.5% CGST + 2.5% SGST or 5% IGST). The recipient company takes 100% ITC of this RCM tax! The **net base freight** is capitalized into inventory.
    * **Forward Charge Mechanism (FCM)**: GTA invoices 12% GST (with full ITC to GTA) or 5% without ITC. Buyer avails ITC on the GST portion; net freight is capitalized.
  - **Composite Supply (Section 8 CGST Act)**: When the goods supplier arranges delivery and includes freight as an inward line on the primary goods invoice, it constitutes a **composite supply** where supply of goods is the principal supply. Freight is taxed at the **same GST rate as the goods** (e.g., 18% if goods are 18%).

---

### Component 3: Labor and Handling Charges
* **Definition**: Terminal handling charges (THC), container freight station (CFS) stuffing/destuffing labor, port craneage, forklift handling, and domestic warehouse unloading labor (**Hamali / Mathadi labor** in states like Maharashtra/Gujarat).
* **Statutory Treatment**:
  - Organized logistics/CFS invoices include 18% GST (SAC 9967). Buyer avails ITC on GST; net handling charge is capitalized into inventory.
  - Cash Hamali / unorganized labor receipts (without GST) are capitalized into landed cost if backed by internal payment vouchers (Section 40A(3) Income Tax cash limits apply).

---

### Component 4: Marine or Transit Insurance
* **Definition**: Insurance cover protecting cargo against physical loss or damage from fire, collision, overturn, theft, or pilferage during transit. Typically calculated as 0.05% to 0.50% of the CIF / invoice value.
* **Statutory Treatment**:
  - Insurance premium attracts **18% GST** (SAC 9971).
  - GST paid on transit insurance for business inventory is **fully eligible for ITC** under Section 16(1) of the CGST Act (not blocked under Section 17(5)).
  - The **net premium (excluding GST)** is capitalized into inventory landed cost.

---

### Component 5: Customs Duties and Taxes (Imported Goods)
When goods are imported into India, Customs Duties are assessed on the **Assessable Value (CIF value converted to INR at CBIC exchange rates)** under Section 14 of the Customs Act, 1962:

$$\text{Assessable Value (AV)} = \text{FOB Value} + \text{Actual Ocean/Air Freight} + \text{Actual Insurance}$$

The duty calculation sequence in India is strictly sequential:
1. **Basic Customs Duty (BCD)**: Specific or ad-valorem tariff rate (e.g. 7.5%, 10%, 20%):
   $$\text{BCD} = \text{AV} \times \text{BCD Rate}$$
   * **Accounting Treatment**: Non-creditable tax! **MUST be capitalized into Inventory Landed Cost**.
2. **Social Welfare Surcharge (SWS)**: 10% levied on BCD under the Finance Act:
   $$\text{SWS} = \text{BCD} \times 10\%$$
   * **Accounting Treatment**: Non-creditable levy! **MUST be capitalized into Inventory Landed Cost**.
3. **Integrated GST (IGST)**: Calculated on total landed value under Section 3(7) of the Customs Tariff Act:
   $$\text{IGST Assessable Base} = \text{AV} + \text{BCD} + \text{SWS}$$
   $$\text{IGST} = \text{IGST Assessable Base} \times \text{IGST Rate (e.g. 18\%)}$$
   * **Accounting Treatment**: **Eligible for 100% Input Tax Credit (ITC)** under Section 16 CGST Act! It is credited to Electronic Credit Ledger via GSTR-2B (ICEGATE sync) and is **PROHIBITED from being capitalized** into inventory landed cost!

```text
[Customs Duty Capitalization Summary]:
• Product Cost (CIF)   -> Capitalized into Inventory
• Basic Customs Duty   -> Capitalized into Inventory (Non-creditable)
• SWS Surcharge (10%)  -> Capitalized into Inventory (Non-creditable)
• IGST                 -> Taken as ITC (NOT capitalized)
```

---

### Component 6: Clearance Fees (CHA Charges & Port Demurrage)
* **Definition**: Fees paid to the licensed **Custom House Agent (CHA)** for filing the Bill of Entry (BOE), EDI document processing, port clearance coordination, port custodian charges (CONCOR, Port Trust), and stamp duties.
* **Statutory Treatment**:
  - CHA professional agency fee attracts 18% GST (eligible for ITC).
  - Port custodian charges, terminal handling, and warehouse storage prior to customs out-of-charge are **capitalizable** into inventory cost.
  - *Note on Demurrage/Detention*: Excessive demurrage penalties resulting from importer delay/negligence are classified as **abnormal storage costs** under Ind AS 2 Paragraph 16(b) and must be expensed to P&L, not capitalized into inventory.

---

## Part III: Addon Before Tax vs. Addon After Tax Architecture

A persistent point of confusion in Indian retail software is the difference between **Addon Before Tax** and **Addon After Tax** columns on the GRN grid.

```
+---------------------------------------------------------------------------------------------------+
|               INWARD ADDON COMPARISON: BEFORE TAX vs. AFTER TAX                                   |
+-----------------------------------+---------------------------------------------------------------+
| ATTRIBUTE                         | ADDON BEFORE TAX               | ADDON AFTER TAX              |
+-----------------------------------+---------------------------------------------------------------+
| Invoiced By                       | Primary Goods Vendor           | Third Parties (Transporter,  |
|                                   | (on the same Tax Invoice)      | CHA, Insurer) or Customs     |
| Statutory Classification          | Composite Supply (Section 8)   | Separate Service Invoices /  |
|                                   | Principal Supply Rate Applies  | Statutory Customs Surcharges |
| Affects Vendor Invoice Total      | YES (Increases payable to      | NO (Vendor is paid only for  |
|                                   | supplier)                      | goods; 3rd party is paid)    |
| Tax Calculation Order             | Tax is calculated on           | Added directly to inventory  |
|                                   | (Item Cost + Addon Before Tax) | cost AFTER tax evaluation    |
| Typical Examples                  | • Supplier delivery/freight    | • GTA Transport Bill         |
|                                   | • Special export packaging     | • Marine Insurance Premium   |
|                                   | • Pre-shipment inspection fee  | • Basic Customs Duty (BCD)   |
|                                   | billed on vendor invoice       | • SWS Surcharge (10%)        |
|                                   |                                | • CHA Agency Bill            |
+-----------------------------------+---------------------------------------------------------------+
```

### Mathematical Formulation of Line Landed Cost:
For each line item $i$:
$$\text{Taxable Base}_i = (\text{Quantity}_i \times \text{Invoice Rate}_i) - \text{Discount}_i + \text{Addon Before Tax}_i - \text{Deduction Before Tax}_i$$
$$\text{Line GST Amount}_i = \frac{\text{Taxable Base}_i \times \text{GST Rate}_i}{100}$$
$$\text{Vendor Invoice Payable}_i = \text{Taxable Base}_i + \text{Line GST Amount}_i$$
$$\text{Total Capitalized Inward Cost}_i = \text{Taxable Base}_i + \text{Addon After Tax}_i - \text{Deduction After Tax}_i$$
$$\text{True Unit Landed Cost}_i = \frac{\text{Total Capitalized Inward Cost}_i}{\text{Accepted Sound Quantity}_i}$$

---

## Part IV: Mathematical Apportionment Algorithms

When an enterprise incurs a consolidated bulk addon (e.g. ₹15,000 container freight or ₹8,500 CHA clearance), it must be mathematically distributed across diverse SKUs in the consignment.

### 1. Apportionment Bases
1. **Value-Weighted (Gross Value Pro-Rata)** — *Default under Ind AS 2*:
   $$\text{Share}_i = \frac{\text{Value}_i}{\sum_{k=1}^N \text{Value}_k}, \quad \text{Allocated}_i = \text{Total Addon} \times \text{Share}_i$$
   *Recommended for*: Ad-valorem customs duties (BCD/SWS), transit insurance, high-value assortment items.
2. **Quantity-Weighted (Unit Count Pro-Rata)**:
   $$\text{Share}_i = \frac{\text{Quantity}_i}{\sum_{k=1}^N \text{Quantity}_k}, \quad \text{Allocated}_i = \text{Total Addon} \times \text{Share}_i$$
   *Recommended for*: Per-piece unloading charges, standard carton handling.
3. **Weight / Volumetric (CBM) Weighted**:
   $$\text{Share}_i = \frac{\text{Gross Weight}_i}{\sum_{k=1}^N \text{Gross Weight}_k}$$
   *Recommended for*: Ocean container freight, air freight (chargeable weight).

### 2. Hamilton-Hare Largest Remainder Cent-Balancing Algorithm
A major flaw in naive decimal rounding (`Math.round(val * 100) / 100`) is that the sum of line allocations often drifts by $\pm ₹0.01$ to $₹0.05$ from the actual expense voucher, causing ledger reconciliation failures.

SMRITI Retail OS solves this using the **Hamilton-Hare Largest Remainder Method**:
1. Compute raw floating-point allocation for each line: $A_i = \text{Total Addon} \times \text{Share}_i$.
2. Take integer paise floor: $I_i = \lfloor A_i \times 100 \rfloor$.
3. Compute fractional remainder for each line: $R_i = (A_i \times 100) - I_i$.
4. Determine remaining undistributed paise: $D = (\text{Total Addon} \times 100) - \sum I_i$.
5. Sort lines by largest fractional remainder $R_i$ descending, and distribute $+1$ paise to the top $D$ lines.
6. **Result**: $\sum \text{Line Addons} \equiv \text{Consolidated Addon}$ with **0.0000 paise variance**!

---

## Part V: SMRITI Retail OS Implementation & UI Parity

### Desktop Terminal UI Controls (`GrnDesktopTerminal.tsx`)
1. **Damage QTY Column**:
   - Pinned between `Selling Price` and `Purchase Price` in Table Header and Data Rows.
   - Values $> 0.00$ are highlighted with `bg-rose-100 text-rose-700 font-bold`.
   - Direct Entry Strip includes an active `entryDamageQty` input allowing rapid barcode + damage entry without mouse interaction.
2. **Summary KPI Strip**:
   - `Doc Qty`: Invoiced document quantity.
   - `Act Qty`: Total physically unloaded quantity.
   - `Damage Qty`: Highlighted badge displaying damaged units.
   - `Sound Qty`: Net accepted stock updating PostgreSQL warehouse inventory balances.
3. **Landed Cost Breakdown Modal**:
   - Dedicated interactive dialogue surfacing the 6 statutory Indian Landed Cost Components.
   - Real-time categorization into `BEFORE_TAX` (Composite supply on vendor invoice) vs. `AFTER_TAX` (Third party / BCD / SWS / CHA).
   - Zero-variance Hamilton-Hare distribution engine pushing computed addons directly into `addon_before_tax` and `addon_after_tax` line items.
4. **Backend Database Parity**:
   - PostgreSQL table `purchase_receipt_items` stores `quantity_damaged`, `cost_price`, `landed_cost`, and `freight_allocated`.
   - Automatic integration with `/purchase/debit-notes/` ensures a formal commercial debit note is pre-populated for damaged items.

---

## Conclusion & Governance Alignment
This deep architecture aligns SMRITI Retail OS with:
* **Section 17(5)(h) of the CGST Act 2017** (blocked ITC mitigation).
* **Ind AS 2 / AS 2** (inventories valuation and abnormal loss segregation).
* **Customs Act 1962 & Customs Tariff Act 1975** (BCD/SWS capitalization vs IGST credit).
* **Shoper 9 & Fiori POS Parity** (high-speed keyboard-driven direct entry strip with zero visual clutter).
