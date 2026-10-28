# SMRITI Retail OS Training Manuals

**Training date:** Thursday, 29 October 2026  
**Audience:** Staff practising vendor, article, item, purchase, receipt, and report tasks  
**Language:** Simple English

## Before Training

- Use the training company or another approved practice environment. Do not practise by creating test records in a live business company.
- Sign in with an account that can open the screens you need. Vendor 360, Purchase Studio, Goods Receipt (GRN), and Procurement Visual Reports require the `MANAGER` or `SYSADMIN` role in the launchpad.
- Ask the trainer for a practice vendor, article, warehouse, and PO. The GRN exercise needs an open PO with quantity still to receive.
- Use real approved vendor and item information only. Do not invent a GSTIN, barcode, vendor code, or price.
- Do not click **Submit PO** or **Post GRN** until the trainer has checked the entries.

## Manuals

1. [Vendor Registration](01_Vendor_Registration_v1.0.md)
2. [Article Registration](02_Article_Registration_v1.0.md)
3. [Item Master Registration](03_Item_Master_Registration_v1.0.md)
4. [Purchase Order Creation](04_Purchase_Order_Creation_v1.0.md)
5. [GRN Against a PO](05_GRN_Against_PO_v1.0.md)
6. [Reports and Printouts](06_Reports_and_Printouts_v1.0.md)

## Training Method

For every manual: the trainer explains once, demonstrates once, then each learner practises one or two times. Stop before final submission or posting until the trainer confirms the practice environment and entries are correct.

## Full Workflow

```mermaid
flowchart LR
  V[Register vendor] --> A[Register article]
  A --> I[Create item and variants]
  I --> P[Create and submit PO]
  P --> G[Receive and post GRN]
  G --> R[Check reports and printouts]
```