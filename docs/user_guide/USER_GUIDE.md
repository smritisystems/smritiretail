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

  * Author     : Jawahar Ramkripal Mallah
  * Designation: Chief Systems Architect & Creator
  * Email      : support@smritibooks.com
  * Version    : 6.99.1
  * Created    : 2026-07-11
  * Modified   : 2026-10-24
  * Copyright  : © SMRITIBooks.com. All Rights Reserved. (also © AITDL.com)
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS — User Guide & Help Manual

Welcome to the SMRITI Retail OS user and operation manual. This document guides store operators, managers, and cashiers on standard workflow practices.

## Customer Master child accounts ? updated 2026-10-24

1. Open and save the existing Parent Account.
2. Select **Add Child Customer** from that parent?s **Parent ? Child** section.
3. Confirm the dialog names the parent account, complete the child details, and save.
4. The child appears in the parent?s Child Customers list. Open the child to see its parent account banner.

## Shell controls — updated 2026-10-24

1. Use the company and branch control in the top bar to review or change the active workspace. It is available in both Regular and Classic styles. The company and branch names appear only when the current session provides them.
2. Select **Workspace style** to preview Regular and Classic layouts. The current module stays open while the layout changes. Use **Escape** to close the chooser, or use **Tab** and **Shift+Tab** to move through its controls.
3. On a narrow screen, select the search icon to open global search. In Classic style, items that do not fit appear under **More**.
4. In the left navigation, the active module is highlighted. When the rail is compact, point to an icon to see its label or use the control's accessible name with a screen reader.

### Common question: What does the connection label confirm?

**APP CONNECTED** means an authenticated request to the application succeeded. **APP UNAVAILABLE** means that request failed or the browser is offline; it does not identify which service caused the failure. Activity counts in the header are for this session and are not a persisted notification inbox.



<!-- USER GUIDE INDEX START -->
## Related User Guide Documents

This section is auto-generated from `docs/user_guide/*.md`. Run this script after adding or removing files.

- [End-User Training — Authors & Product Metadata](docs/user_guide/ENDUSER_TRAINING__3.md)
- [End-User Training — Company & Demo Details](docs/user_guide/ENDUSER_TRAINING.md)
- [End-User Training — Sales Studio](docs/user_guide/ENDUSER_TRAINING_2.md)
- [Sales, Quotation and Order Help](docs/user_guide/SALES_ORDER_QUOTATION_HELP.md)
- [User Training Blueprint — 7-Day Business Transaction Lifecycle](docs/user_guide/USER_TRAINING.md)

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

---

## Modern Trade Sales Channel & Store Location Billing

### 1. Operational Sales Channel Selection
When drafting a sales invoice in the Billing Terminal, select the operative **Sales Channel** from the top header:
- **Modern Trade (MT)**: For large format retail chains (e.g. Reliance Retail, Trent, Shoppers Stop, DMart).
- **General Trade (GT)**: For standard retail/distributor stores.
- **B2B Wholesale**: For bulk merchant billing.
- **POS Retail**: For standard store-counter retail billing.
- **E-Commerce**: For online orders.

When selecting a customer classified as Modern Trade, the system automatically defaults the sales channel to `Modern Trade`.

### 2. Conditional Store Code & Delivery Location Requirement
- **Mandatory Store Selection**: When `Modern Trade` is selected, the **Delivery Location** and **Store Code** fields appear dynamically in the corporate billing bar with red mandatory indicators (`*`).
- **Billing Guard**: Settlement is blocked with an alert if Modern Trade is active but no Delivery Location is selected.
- **Non-Modern Trade Channels**: When non-Modern Trade channels are active (e.g. General Trade), the store location fields are hidden to simplify counter billing. Previously chosen locations are safely preserved in the background and will restore if Modern Trade is re-selected.
- **Automatic Account Mapping**: Selecting a store location automatically links or creates the corresponding Party Stock Visibility (PSV) tracking account in the background without requiring manual data entry.

