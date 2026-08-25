<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.63.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Shoper 9 System Parameters & Configuration Catalog

- **Total System Parameters (`SysParam`):** 78
- **Total Categories:** 13
- **Total Lookup Groups (`GenLookUp`):** 6
- **Total Legacy DDL Tables Discovered:** 320

## 1. Parameters by Functional Category

| Category Name | Parameter Count |
|---|---|
| **General System Parameters** | `24` |
| **24. Packing** | `10` |
| **17. House Keeping** | `9` |
| **11. Billing** | `9` |
| **25. Credit Management** | `7` |
| **09. Inwards** | `5` |
| **14. Bill - Printing** | `3` |
| **10. Outwards** | `3` |
| **22. Till Management** | `2` |
| **12. Slips** | `2` |
| **03. Item Classification** | `2` |
| **23. Excise** | `1` |
| **02. Franchisee** | `1` |

## 2. Parameter Master Excerpt (Sample)

| Parameter Code | Description | Data Type | Default Value | Category |
|---|---|---|---|---|
| `paymentHOprefill` | Prefill Balance in Payments to HO | `I` | `0` | 02. Franchisee |
| `SR9-0920-4000001` | Retail and Dealer Price Setting in Multipe Prices | `T` | `0` | 03. Item Classification |
| `SR9-0920-4000002` | CurrenCost and Last Purchase Price Setting in Multipe Prices | `T` | `0` | 03. Item Classification |
| `AllowEditDocActQtyinPTFileLoading` | Allow editing Documented Qty and Actual Qty in PT file loading | `T` | `N#N` | 09. Inwards |
| `AutoCalculatePurchaseTaxonPredefinedRates` | Auto calculate purchase tax based on predefined rates | `T` | `NNNN` | 09. Inwards |
| `CaptionForInwardDetailSectionFields` | Specify Caption for Detail Section Fields for Inward Audit Trial | `V` | `0` | 09. Inwards |
| `CaptureTransporterDtls` | Capture transporter details | `T` | `N#N` | 09. Inwards |
| `GIRTransporterDetailsPrinting` | Transporter Details to be printed in Inward | `T` | `1111111111111#0000000000000#0000000000000` | 09. Inwards |
| `AllowIndStockItemGORRecalledPackingSlip` | Allow individual stock items in GOR along with recalled packing/pallet slip | `B` | `0` | 10. Outwards |
| `DispPurchDocSelectingStockNo` | Display the list of Purchase Documents on selecting stock number | `T` | `Y` | 10. Outwards |
| `PrintDocPrefixNoInOutwardItemDtls` | Print Reference Doc Prefix and Doc No in Outward Item details | `B` | `0` | 10. Outwards |
| `AllowItemScanningWithRecalling` | Allow item Scanning Along With Recalling Expected Transaction | `B` | `1` | 11. Billing |
| `AllowRateAlterationinSalesReturnWOR` | Allow Rate alteration in Sales Return without Reference | `B` | `1` | 11. Billing |
| `AllowRtnWORinWR` | Allow Return without ref. in Return with ref. Transactions | `B` | `1` | 11. Billing |
| `ApplyCurbalqty` | Apply Current balance Quanity instead of LSQ | `B` | `0` | 11. Billing |
| `ApplyLsqForReturnWOR` | Apply LSQ for Sales Return without Ref | `B` | `0` | 11. Billing |
| `DefaultExptTranInBilling` | Default Expected Transaction type in Billing | `I` | `0` | 11. Billing |
| `DisableLoadItemOptioninsalesreturnWR` | Disable Loading of Items from Bill in Sales Return with Reference | `I` | `0` | 11. Billing |
| `EnableQtyEditing` | Enable Only Quantity Editing Option in Billing | `B` | `0` | 11. Billing |
| `Finchkstck` | Finchkstck | `I` | `0` | 11. Billing |
| `PrintSlipsRcptAndAdvRcptInSamePg` | Print Slips Receipt & Advance Receipt in same page | `B` | `0` | 12. Slips |
| `SlipFormat` | Slip Format to be used | `I` | `1` | 12. Slips |
| `DCPrintingInGraphicPrinter` | DC Printing in Graphic Printer | `B` | `0` | 14. Bill - Printing |
| `PrintInclExclVatSummarySeparately` | Print inclusive and exclusive vat summary breakup separately | `B` | `0` | 14. Bill - Printing |
| `PrintTaxBreakupWithTaxCompDtls` | Print tax breakup with tax component captions | `B` | `0` | 14. Bill - Printing |
| `AllowOpenDatetoDesiredDate` | Allow Open Date To Enter The Desired Date | `I` | `0` | 17. House Keeping |
| `BarcodeFilePath` | Barcode File Path | `T` | `C:\Shoper9\Barcode\Poshak.txt` | 17. House Keeping |
| `BarcodePrintingType` | Barcode Printing Type | `I` | `1` | 17. House Keeping |
| `CostPriceEncoding` | Encoded Cost Price For Labels | `T` | `0,A#1,B#2,C#3,D#4,E#5,F#6,G#7,H#8,I#9,J` | 17. House Keeping |
| `GeneratePrintingLogForPrintEngine` | Generate printing log for Print Engine | `B` | `0` | 17. House Keeping |

## 3. Discovered Legacy Tables for Migration Pipeline

`AcceptDisplayDtls`, `AccountSummary`, `AccountsMaster`, `ActualScheduleTask`, `AgencyCatDtl`, `AgencyCatHdr`, `AgentActivity`, `AlertDefinition`, `AlertEventDefinition`, `AlertHistory`, `AuthorisedPOSPatches`, `BAKAcceptDisplayDtls`, `BAKClass12LocWise`, `BAKExpectedTrnHdr`, `BAKInPackSlipHdr`, `BAKInPackSlipTrn`, `BAKIncShrmPeriodDtls`, `BAKIncentiveGrpItemDtls`, `BAKLogTilldtls`, `BAKMultiplePrices`, `BAKONACCcrdtntLinktbldtls`, `BAKONACCcrdtntLinktblhdr`, `BAKPhyStockTakingItemBkUp`, `BAKPriceRevision`, `BAKPriceRevisionHistory`, `BAKPurchOrdDtl`, `BAKPurchOrdHdr`, `BAKStkTrnAddlHdr`, `BAKTillAcceptDisplaydtls`, `BAKTillOperationJournalDtls`, `BAKTillOperationJournalHdr`, `BAKTillShiftdtls`, `BAKTillTrnswiseDenomination`, `BAKcrdtinvrcvdtls`, `BAKcrdtinvrcvhdr`, `BAKcrdtsalecustopbal`, `BakCurrencyDenomination`, `BakExciseDutyComponents`, `BakExciseDutyDtls`, `BakExportGenLookUp`, `BakExportSysparam`, `BakFactorHeader`, `BakGS1Dtls`, `BakIncDefTable`, `BakItemReClassConfig`, `BakItemReClassDtls`, `BakItemReClassHeader`, `BakPrefixConfig`, `BakPrefixMaster`, `BakPrefixTerminalGroups` ... and 270 more.
