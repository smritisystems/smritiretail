# SMRITI Retail OS - Sales, Quotation and Order Help

**Audience:** Store operators, sales staff, managers, cashiers, and report users
**Purpose:** Explain what each sales document means, when to use it, and how to read the screens and reports.

---

## 1. The Simple Business Flow

```text
Quotation (optional offer)
        |
        v
Sales Order (confirmed customer requirement)
        |
        v
Sales Invoice (tax bill and payment document)
        |
        v
Payment / collection
```

A quotation is optional. A customer order can be entered directly as a Sales Order when there is no quotation.

### What each document means

| Document | Meaning | Creates a tax bill? |
| --- | --- | --- |
| Quotation | Price and item offer sent to a customer | No |
| Sales Order | Customer requirement accepted for processing | No |
| Sales Invoice | Final bill for supply, tax, and payment | Yes |

Do not treat a quotation or Sales Order as a payment receipt. Payment is recorded against the invoice or payment workflow.

---

## 2. Quotation

Use a quotation when the customer needs an offer before confirming the purchase.

A quotation normally contains:

- Customer name
- Products and quantities
- Selling price
- GST or tax rate
- Tax amount
- Grand total
- Quotation status

### Quotation statuses

- **Draft:** Still being prepared; not sent or confirmed.
- **Submitted:** Sent for review or customer confirmation.
- **Approved:** Accepted under the business approval process.
- **Converted:** Used to create a Sales Order.
- **Rejected / Cancelled:** No longer available for conversion.

When a quotation is converted, the Sales Order keeps a reference to the source quotation. This allows users to trace the order back to the original offer.

---

## 3. Sales Order

Use a Sales Order after the customer has confirmed what they want. It records the operational commitment to supply the goods.

The Sales Order list shows the most useful business information first:

- **Order No:** Unique order reference.
- **PO Number:** Customer purchase order reference, when supplied.
- **Customer:** Buyer or organization name.
- **Order Date:** Date the order was recorded.
- **Items / Quantity:** Number of lines and total units.
- **Order Value:** Tax-inclusive value of the order.
- **Billed Value:** Amount already included in invoices.
- **Pending Value:** Amount not yet billed.
- **Status:** Current order stage.
- **Order Source:** Quotation reference or Direct Order.

### Sales Order statuses

- **Draft:** Being prepared.
- **Submitted:** Sent for approval or processing.
- **Approved:** Approved for fulfilment.
- **Confirmed:** Customer order accepted.
- **Shipped:** Goods dispatched.
- **Cancelled:** Order cancelled and no longer active.
- **Rejected:** Approval was not granted.

### Direct Order versus quotation order

The **Order Source** field explains how the order entered the system:

- **Quotation: QT-xxxxx:** Created from a quotation.
- **Direct Order:** Entered without a quotation.

Direct Order is valid. It does not indicate an error.

---

## 4. Sales Order Detail

Select an order to inspect its detail view.

### Header information

Check the customer, Order No, PO Number, order date, delivery date, site, and fulfilment status.

### Item table

Each item row explains:

- Product code and name
- Quantity and unit of measure
- Unit price
- GST rate and tax
- Line total

### Summary values

- **Basic Total:** Value before tax.
- **Tax Total:** Total GST calculated for the order.
- **Grand Total / Order Value:** Basic Total plus tax.
- **Billed Quantity / Value:** Portion already invoiced.
- **Pending Quantity / Value:** Portion still awaiting invoicing.

The figures should be read together. A confirmed order can have a pending value until invoicing is complete.

### Related invoices and allocations

An allocation links an order quantity or value to an invoice. It helps answer:

- Which invoice billed this order?
- How much quantity has been billed?
- How much quantity remains pending?
- Is the order fully billed or only partially billed?

---

## 5. Reports

Open **Sales Analytics** or **Report Designer Studio** for reports. Select the correct date range before interpreting totals.

### Sales reports

- **Daily Sales Summary:** Completed invoice sales for the selected date range.
- **Sales Returns & Credit Notes:** Returned goods and credit-note activity.
- **Top Selling Products:** Products ranked by quantity or sales value.
- **Salesperson Performance:** Sales activity and salesperson measures.

### Order-focused reports

When available, use these views for order operations:

- Sales Order Summary
- Pending Orders
- Billed versus Pending Orders
- Customer-wise Orders
- Product-wise Ordered Quantity
- Order Fulfilment Status
- Invoice Allocation Report

### Important report rule

Sales Order reports and Sales Invoice reports are different:

- A Sales Order report can show confirmed commitments even when no invoice exists.
- A Sales Invoice report shows completed billing activity.
- A report set to **Today** can correctly show zero if there were no invoices today, even when older Sales Orders exist.

Always check the report title, date range, branch, and document type before concluding that data is missing.

---

## 6. Reading the Summary Cards

Use these plain meanings:

| Screen label | Meaning |
| --- | --- |
| Total Sales Order Value | Sum of active Sales Order grand totals |
| Confirmed Orders | Orders currently accepted for processing |
| Converted Orders | Sales Orders created from quotations |
| Conversion Efficiency | Converted quotations divided by eligible quotations |
| Billed Value | Order value already represented by invoices |
| Pending Value | Order value still awaiting billing |

A value of zero is not automatically a problem. It may mean that the selected date, status, branch, or document type has no matching records.

---

## 7. Common Problems and Safe Checks

### The screen shows zero orders

1. Confirm the active company and branch at the top of the screen.
2. Clear status, customer, and date filters.
3. Open the **Sales Orders** tab and refresh.
4. Confirm that the screen says **Sales Orders**, not Quotations or Sales Invoices.
5. Ask an administrator to verify that the user is authorized for the correct branch.

### The report shows zero receipts

This usually means the report date range has no invoices. Change the date range to the order or invoice date being investigated. Do not delete or recreate records just because a current-day report is empty.

### The screen shows `INR NaN` or `NaN`

This is a display or response-format problem, not a valid business value. Record the screen name, order number, date, and active branch, then report it to support. Never correct it by changing database totals manually.

### The order says Direct Order

This is expected when the order was entered without a quotation. It does not mean the order is incomplete.

### The customer or branch looks wrong

Stop before creating or editing a document. Switch to the correct company and branch, then reload the workspace. Multi-company data must remain separated.

---

## 8. Recommended User Workflow

### Sales staff

1. Search for the customer.
2. Create a quotation when the customer needs an offer.
3. Submit or approve the quotation as required.
4. Convert the accepted quotation to a Sales Order, or create a Direct Order.
5. Confirm products, quantity, tax, delivery details, and total.
6. Follow pending value until the order is invoiced.

### Billing staff

1. Open the confirmed Sales Order.
2. Check billed and pending quantities.
3. Create the Sales Invoice for the supplied quantity.
4. Verify tax and grand total.
5. Confirm the invoice and payment workflow.

### Managers and report users

1. Select the correct company and branch.
2. Choose the report matching the business question.
3. Set the date range and filters.
4. Compare order value, billed value, and pending value.
5. Export or print only after checking the report title and date range.

---

## 9. Technical Terms for Support Only

These fields help support staff trace data but are not normally needed by users:

- `company_id` and `branch_id`: Tenant routing identifiers.
- `source_quotation_id`: Link from a Sales Order to its quotation.
- `order_id` and `invoice_id`: Internal document links.
- `allocation_metadata`: Additional reconciliation information.
- `version`, `created_at`, and `modified_at`: Audit and concurrency fields.

The API may use names such as `grand_total` while the screen uses **Order Value**. This is an internal data-format difference; users should rely on the business label shown on screen.

---

## 10. Quick Reference

```text
Need to make an offer?       Create a Quotation.
Customer confirmed an order? Create a Sales Order.
Need a tax bill?             Create a Sales Invoice.
Need to see commitments?     Open Sales Order reports.
Need to see billing?         Open Sales Invoice reports.
Seeing zero?                 Check date, filters, branch, and document type.
Seeing NaN?                  Report the display issue; do not edit totals.
```
