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
  * Created    : 2026-07-18
  * Modified   : 2026-07-18
  * Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# End-User Training — Sales Studio

## Purpose
The Sales Studio is the central commerce workspace for customer quotations, sales orders, GST invoices, sales returns, and customer ledger management. This guide helps sales staff and store managers use the Sales & Commerce Studio efficiently.

## Accessing Sales Studio
- Log in to SMRITI Retail OS using your assigned credentials.
- Open the left navigation menu and select **Sales Studio** or **Sales & Commerce Studio**.
- The module loads five subviews: **Quotations**, **Sales Orders**, **Sales Invoices**, **Sales Returns**, and **Customers**.

## Sales Studio Subviews
1. **Quotations**
   - Create and manage customer quotations.
   - Save draft quotations and submit them for approval or conversion.
   - Converted quotations become sales orders.
2. **Sales Orders**
   - Review confirmed orders that originated from quotations.
   - Track order status and expected revenue.
   - Use this view to verify order details before invoicing.
3. **Sales Invoices**
   - Generate GST commercial invoices for confirmed sales.
   - Print or share invoices once they are registered in the ledger.
   - Approve, cancel, or review invoice workflow actions.
4. **Sales Returns**
   - Record customer returns and credit notes.
   - Select the original invoice and enter return items and reasons.
   - Manage interstate returns with GST-aware settings.
5. **Customers**
   - Add and edit customer profiles.
   - Import customer lists using CSV upload.
   - Search and filter customer records by name, phone, email, group, or tags.

## Common Sales Studio Workflows

### Generate a new quotation
- Navigate to **Quotations**.
- Click **Generate Quotation**.
- Enter the customer or party name.
- Add line items manually or choose product variants.
- Set the draft workflow status and save the quotation.
- Use the quotation list to convert it into a sales order when the customer approves.

### Create a sales invoice
- Switch to **Sales Invoices**.
- Click **Generate Sales Invoice**.
- Select the customer and add invoice items.
- Choose whether the sale is interstate and enter the e-way bill number when required.
- Save the invoice to write it into the sales ledger.

### Record a sales return
- Open **Sales Returns**.
- Click **Record Sales Return**.
- Choose the original invoice and select returned items.
- Enter the return reason and invoice return status.
- Submit the return document into the sales ledger.

### Manage customers and import ledger data
- Use **Customers** to add new customer profiles.
- Click **Add Customer** for individual creation.
- Click **Import Customers (CSV)** when uploading bulk customer lists.
- Follow CSV guidelines: Name, Mobile, Email, GSTIN, PAN, Group, Status, Outstanding.
- The system validates mobile number, email format, group membership, and duplicate records before import.

## Search, filters, and ledger refresh
- Use the filter panel to narrow records by customer, status, and date range.
- The **Refresh Ledger** button reloads the current subview.
- Search input in the Customers tab helps find customers by name, mobile, email, or tags.
- Reset filters and search to return to the full desk view.

## Important Notes for Training
- **Read-only users** may see an active banner and cannot change data. Write actions are disabled for report-only roles.
- **Workflow actions** such as invoice approve or cancel are recorded in the sales workflow engine.
- Always confirm that the correct customer profile is selected before finalizing invoices or returns.
- Use the **Sales Studio** dashboard metrics to monitor active quotations, order conversion efficiency, and total booked revenue.

## Troubleshooting
- If the Sales Studio fails to load, refresh the browser and verify the backend service is running.
- If CSV import shows invalid records, correct missing or malformed mobile, email, or group values.
- If a new quotation or invoice does not appear, click **Refresh Ledger** and confirm the current subview is active.

## Related Training Documents
- `docs/user_guide/ENDUSER_TRAINING_AUTHORS.md`
- `docs/user_guide/ENDUSER_TRAINING_COMPANY_DETAILS.md`
- `docs/user_guide/USER_GUIDE.md`
