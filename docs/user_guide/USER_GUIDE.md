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

  * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 2.1.2
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS — User Guide & Help Manual

Welcome to the SMRITI Retail OS user and operation manual. This document guides store operators, managers, and cashiers on standard workflow practices.



<!-- USER GUIDE INDEX START -->
## Related User Guide Documents

This section is auto-generated from `docs/user_guide/*.md`. Run this script after adding or removing files.

- [End-User Training — Authors & Product Metadata](docs/user_guide/ENDUSER_TRAINING_AUTHORS.md)
- [End-User Training — Company & Demo Details](docs/user_guide/ENDUSER_TRAINING_COMPANY_DETAILS.md)
- [End-User Training — Sales Studio](docs/user_guide/ENDUSER_TRAINING_SALES_STUDIO.md)
- [Customer Group & Pricing Group Manual — v3.26.0](docs/user_guide/CUSTOMER_AND_PRICING_GROUP_MANUAL_v3.26.0.md)

<!-- USER GUIDE INDEX END -->

---

## POS Cashier Desk Operations

### 1. Register Status & Drawer Shifts
- Open Drawer Register: When starting a shift, open the POS tab and input the starting drawer cash balance (default ₹5,000). Click **Open Shift**.
- Close Drawer Register: Click **Close Shift** to enter the closing balance and archive active shift transactions.

### 2. POS Terminal Keyboard Shortcuts
Cashiers can run desk operations using keyboard shortcuts without touch or mouse interactions:
- `Escape`: Clear/void the active shopping basket immediately.
- `F2`: Place the active bill on temporary hold (parks up to 5 bills simultaneously).
- `F3`: Launch the **Advanced GST Invoicing** wizard.
- `F12`: Trigger the **Quick Pay / Standard Checkout** standard drawer collection.

### 3. Hold & Recall Parking Slots
- If a customer needs to fetch more items, press `F2` to hold the basket.
- Held baskets display under **Temporary Hold Slots**. Click **Recall [Slot ID]** or select the recalled slot to restore it to the cashier terminal.

### 4. Split-Payment Processing
- Standard checkout allows paying the full balance via the primary payment mode.
- Advanced GST Invoicing supports **Split Payment** mode, enabling cashiers to allocate the bill across multiple tender types (Cash, Card, UPI, Credit) simultaneously.

---

## CRM & Customer Outstanding Ledger
- Active Customer outstanding balances are dynamically updated upon sales checkouts.
- Outstanding credit limits and terms are configured at the Customer Group level (e.g. Retail, Wholesale, Franchises).
