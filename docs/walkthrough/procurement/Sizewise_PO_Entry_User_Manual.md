# User Manual: Size-wise Purchase Order Entry

**Version:** 1.0  
**Updated:** 2026-11-27  
**For:** Buyers, purchase managers, and receiving teams  
**Workspace:** Purchase Studio

This manual explains how to create a size-wise purchase order without a supplier-provided barcode, review and print the PO, and assign either a supplier barcode or an internally generated Code 128 after confirmation.

> **Key rule:** A barcode is not required to enter or save the PO. Internal barcode assignment is available only after the PO is confirmed and before receiving starts.

## 1. Before you start

- Confirm that the correct supplier, branch, warehouse, currency, and commercial terms are available.
- The style/article and its size variants must exist in the item catalogue. For barcode assignment, each PO item must be linked to an active canonical item variant.
- Agree the quantities, unit rates, tax, delivery date, and size scale with the appropriate approver.
- A buyer can save a draft. Confirmation and barcode assignment require an authorized Manager or Sysadmin account.
- Do not use the example quantities in the screenshots as a real purchase instruction.

## 2. Create the size-wise PO

1. Open **Purchase Studio**.
2. Select **Generate PO**, then select **Sizewise**.
3. Enter or select the supplier and review the PO header, order date, required delivery date, and price list.
4. In **1. Items**, select the correct **Size Scale**. Choose the scale that matches the catalogue variants (for example, apparel sizes or footwear EU sizes). If changing a populated scale, review the scale-change confirmation and check the remapped quantities before continuing.
5. Find the style or SKU using **Item Finder** or the item search field. You do not need to scan a barcode to find an item. Select the correct article/style and color.
6. Enter the planned quantity in each size column. Leave sizes with no order quantity at zero or blank. Review the per-size totals, line total, tax, and overall PO value.
7. Review the remaining tabs:
   - **2. Images & Articles:** confirm the selected item and article details.
   - **3. Delivery & Tax:** verify the destination warehouse, delivery date, tax, freight, and shipping terms.
   - **4. Other Details:** enter supplier-facing remarks or instructions as appropriate. Keep internal-only notes in the internal notes field.
8. Recheck the supplier, size scale, quantities, rates, tax, delivery destination, and total before saving.

The matrix groups the display by article and color; barcode assignment is made against the underlying PO item/variant line. Check that each size quantity is associated with the intended catalogue variant.

![Live size-wise entry matrix with sample quantities; the example is unsaved.](../../../exports/customer-presentations/live-step-sizewise-entry-redacted.png)

![Commercial and payment terms in the live entry screen.](../../../exports/customer-presentations/live-step-commercial-terms-redacted.png)

![Delivery and warehouse terms in the live entry screen.](../../../exports/customer-presentations/live-step-delivery-terms-redacted.png)

## 3. Save as a draft or confirm

- Select **Save Draft** when the order still needs review or approval. A draft is not a confirmed order.
- Select **Save & Confirm** only when the order is approved and ready to be issued. This action saves the order and runs the submit/confirm workflow. Use an authorized Manager or Sysadmin account.
- If confirmation reports an error, open **Purchase Studio > Workspace** and check the PO status before retrying. The PO may have been saved even if the later confirmation step did not complete.
- Do not confirm a demonstration or sample PO.

![Live draft footer showing Save Draft and Save & Confirm; the example was not confirmed.](../../../exports/customer-presentations/live-step-approval-detail-redacted.png)

## 4. Preview and print the PO

1. Select **Print** from the size-wise entry screen. To print a saved order, select **Open**, retrieve the PO, then select **Print**.
2. In **Purchase Order Print Preview**, keep **SMRITI Purchase Order - Sizewise (Approved A4)** selected unless your organization requires another approved format.
3. Verify the supplier, PO number and status, size columns, quantities, rates, tax, totals, delivery details, and terms.
4. Select **Print** and use the browser print dialog to print or save as PDF. Check that the paper size is A4 and that the preview contains the complete order before issuing it.

The PO printout communicates the order and size quantities. It is not a barcode label; use the approved label-printing workflow if physical item labels are needed.

![Redacted size-wise PO print preview with sample data; not an approved order.](../../../exports/customer-presentations/live-po-sizewise-print-summary-redacted.png)

## 5. Assign a barcode after confirmation

Do this before creating or posting any goods receipt for the PO.

1. Open **Purchase Studio > Workspace** and locate the confirmed PO.
2. Select **Attach barcode**. This action appears for an authorized Manager or Sysadmin when the PO is confirmed and has barcode-pending item lines.
3. In **Assign item barcodes**, select a barcode source:

   **Generate an internal code**
   - Select **Generate internal code**.
   - Select **Generate** on the unbarcoded item/variant line.
   - The system creates a unique internal Code 128 and links it to that item variant. No supplier code or manual code entry is required.

   **Use a supplier barcode**
   - Select **Supplier barcode**.
   - Select the correct barcode type, then scan or enter the supplier's barcode on the matching item/variant line.
   - Select **Assign** and verify the success message.

4. Confirm each completed line shows its barcode as assigned, then select **Done**.
5. If labels are needed, print them through the organization's barcode-label process and scan-check that each label resolves to the intended size variant.

### Barcode assignment rules

- The PO must be **CONFIRMED**.
- No receipt may have started against the PO. Once receiving starts, barcode changes through this PO workflow are blocked.
- Assignment is for the linked item/variant line; a barcode must identify the correct size variant.
- An existing primary barcode cannot be replaced from the PO screen. Use the governed Item Master process for an authorized correction.
- If the item is not linked to an active canonical variant, stop and have the Item Master record corrected before assigning a barcode.

## 6. Troubleshooting

| What you see | What to check |
|---|---|
| **Attach barcode** is not shown | Confirm you have a Manager or Sysadmin role, the PO status is **CONFIRMED**, and at least one item is barcode-pending. |
| Internal code generation fails | Check that the PO item is linked to an active item variant and that receiving has not started. |
| Supplier barcode is rejected | Check the selected barcode type, remove accidental spaces, and verify that the code is not already assigned to another item. |
| A variant already has a primary barcode | Do not overwrite it through the PO. Ask an authorized user to review the Item Master record. |
| The PO print preview does not match the entry | Do not issue the printout. Reopen the PO, verify the saved status and line details, then preview again. |
| Save & Confirm reports an error | Check the PO in **Workspace** before retrying to avoid duplicate submission or confirmation. |

## 7. Quick release checklist

- [ ] Correct supplier, branch, warehouse, size scale, and delivery date
- [ ] Correct article, color, and quantity for every size
- [ ] Rates, tax, commercial terms, and totals reviewed
- [ ] PO saved as a draft or confirmed only with the appropriate approval
- [ ] Required barcode assigned to each eligible item/variant before receiving
- [ ] Printed PO checked; barcode labels printed and scan-tested separately if required

## 8. Screenshots and companion presentation

The screenshots are redacted captures of the live entry and print screens. Their sample quantities were not saved or confirmed. No eligible real barcode-pending PO was available when this manual was prepared, so it does not include a screenshot of a completed barcode assignment. Follow the workflow above on a real approved PO; do not create a demo PO to reproduce the screenshots.

[Open the companion customer presentation](../../../exports/customer-presentations/sizewise-po-entry-without-barcode.html).
