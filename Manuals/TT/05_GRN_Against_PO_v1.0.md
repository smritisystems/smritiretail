# 5. GRN Against a Purchase Order

## Goal

Record what physically arrived, compare it with the PO, record damaged goods, and post the accepted receipt to stock.

## Steps

```mermaid
flowchart LR
  P[Open Goods Receipt GRN Terminal] --> V[Select the PO vendor]
  V --> O[Select the open PO]
  O --> R[Enter received and damaged quantities]
  R --> C[Check commercials]
  C --> F[Balance freight and other costs]
  F --> Q[Review GRN]
  Q --> G[Confirm Post GRN]
  G --> L[Print slip and check reports]
```

1. Open **Goods Receipt (GRN) Terminal** from the Launchpad. This screen is for `MANAGER` and `SYSADMIN` users.
2. In **Supplier / Vendor**, select the same vendor used on the PO.
3. In **PO Source**, select the correct open PO. The PO's lines should load. Check the PO number and item list before receiving.
4. Enter the actual **Received Qty** for each line. Count the goods; do not copy the ordered quantity without checking the delivery.
5. Enter **Damaged Qty** when some of the received goods are damaged. Accepted quantity is received quantity minus damaged quantity.
6. Compare the goods with the supplier invoice or delivery challan. Record shortages or excesses according to your company procedure and tell the trainer about any difference.
7. Check the **Commercials** step and enter invoice/commercial details as requested.
8. In **Costs & Freight**, review freight and other landed costs. If using manual allocation, make sure the displayed allocation is balanced before continuing.
9. Open **Review & Post**. Check vendor, PO, warehouse, item, received quantity, damaged quantity, accepted quantity, and total cost.
10. Click **Post GRN** only after the trainer approves the practice receipt. Review the final confirmation and confirm posting.
11. Read the success message and record the GRN number. Use the GRN print/slip action if required.
12. Check the item stock or procurement report to confirm the receipt is recorded.

## The Five GRN Steps

```text
1. PO & Details -> 2. Receive & Verify -> 3. Commercials
              -> 4. Costs & Freight -> 5. Review & Post
```

## Important

- If no open PO appears, check the selected vendor and PO status. Do not choose another vendor's order.
- Do not enter negative quantities. Damaged quantity must not be greater than received quantity.
- Do not post until the warehouse is selected and any manual cost allocation is balanced.
- Posting changes inventory. Practise only in the training company or when the trainer directs you.

## Practice Task

Use the assigned PO. Receive the quantity the trainer gives you, record any practice damage, review the accepted quantity, and stop at the final confirmation until asked to post.