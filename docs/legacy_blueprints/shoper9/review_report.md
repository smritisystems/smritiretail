<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.33.0
  Created      : 2026-08-26
  Modified     : 2026-08-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Shoper9 Template Blueprint Review & Audit Report

**Audit Date**: 2026-08-26
**Source Path**: `D:\Shoper9\Templates`
**Total Source Files**: 21
**Auditor**: SMRITI Automated Blueprint Engine

---

## 1. Quarantined Temporary Files (2)
The following files were detected as temporary staging or editor dump files (`*_tmp.txt`) and have been quarantined. They are excluded from all generated blueprints:

| Filename | Size (Bytes) | Reason |
|---|---|---|
| `Distributor_tmp.txt` | 177,393 | Temporary backup file (*_tmp.txt) |
| `Retail_tmp.txt` | 176,648 | Temporary backup file (*_tmp.txt) |

---

## 2. Empty Template Files (8)
The following 0-byte files exist in the legacy template directory:

| Filename | Size | Status |
|---|---|---|
| `Distributor.Ads` | 0 bytes | 0-byte empty template file |
| `Distributor.Ams` | 0 bytes | 0-byte empty template file |
| `Distributor.Sdbs` | 0 bytes | 0-byte empty template file |
| `Retail.Ads` | 0 bytes | 0-byte empty template file |
| `Retail.Ams` | 0 bytes | 0-byte empty template file |
| `Retail.Dbs` | 0 bytes | 0-byte empty template file |
| `Retail.Mns` | 0 bytes | 0-byte empty template file |
| `Retail.Sdbs` | 0 bytes | 0-byte empty template file |

---

## 3. Duplicate SQL Statements Detected (1)
The legacy SQL files contain redundant duplicate statements that have been filtered in the generated reviewed copies:

| Source File | Duplicate Statement | Action Taken |
|---|---|---|
| `Distributor.Mns` | `insert into vavertable (ExeSrl,ExeID,ExeSkip,ExeVer,ExeMinor,ExeSubRel) values (...` | Deduplicated in normalized blueprint |

---

## 4. Hardcoded Legacy File Paths (30)
The legacy configuration files contain Windows-specific absolute paths that must be overridden by SMRITI environment variables or tenant storage providers:

| Profile | Parameter Code | Description | Legacy Value |
|---|---|---|---|
| Retail | `ShoperImageFilePath` | Shoper Image File Path | `C:\Shoper72\Images` |
| Retail | `PathBarcodeDesignTemplates` | Loading / Storing Path for Barcode Design Templates | `C:\Shoper72\Barcode` |
| Retail | `BackupPath` | Shoper Temporary Backup Path | `C:\Shop723\Backup` |
| Retail | `POSPrinterDevice` | POS Printer Device Name | `C:\PRN` |
| Retail | `CompXTFileInPath` | Company PT(XT) File In Path | `D:\SHOPER7\COMPXTFL` |
| Retail | `CompPTFileOutPath` | Company PT(XT) File Out Path | `D:\SHOPER7\COMPPTFL` |
| Retail | `WebServerSettings2` | Web Server Settings for Download File | `c:\shoper7\in#c:\shoper7\in` |
| Retail | `ASTExportPath` | AST Export Path | `C:\Shoper72\AstOut` |
| Retail | `PrintingTemplateFolder` | Printing Template Folder | `C:\shoper7\BillTemplates` |
| Retail | `PrintingTemplateDefault` | Default Printing Template File Path | `C:\shoper7\BillTemplates\shoper40col.TPL` |
| Retail | `PrintingTemplateControl` | Default Printing Control File Path | `C:\shoper7\BillTemplates\ShoperControl.IPL` |
| Retail | `PrintingTemplateCondition` | Default Printing Conditional File Path | `C:\shoper7\BillTemplates\ShoperControl.VPL` |
| Retail | `ConfigPathFile` | Location Of The ConfigFile.INI Used In Bill Printing | `C:\Configfile.ini` |
| Retail | `ASTImportPath` | AST Import Path | `C:\Shoper72\AstOut` |
| Retail | `ASTBackUpPath` | AST BackUp Path | `C:\Shoper72\AstOut` |
| Distributor | `POSPrinterDevice` | POS Printer Device Name | `C:\PRN` |
| Distributor | `CompXTFileInPath` | Company PT(XT) File In Path | `D:\SHOPER7\COMPXTFL` |
| Distributor | `CompPTFileOutPath` | Company PT(XT) File Out Path | `D:\SHOPER7\COMPPTFL` |
| Distributor | `WebServerSettings2` | Web Server Settings for Download File | `c:\shoper7\in#c:\shoper7\in` |
| Distributor | `PrintingTemplateFolder` | Printing Template Folder | `C:\shoper7\BillTemplates` |
| Distributor | `PrintingTemplateDefault` | Default Printing Template File Path | `C:\shoper7\BillTemplates\shoper40col.TPL` |
| Distributor | `PrintingTemplateControl` | Default Printing Control File Path | `C:\shoper7\BillTemplates\ShoperControl.IPL` |
| Distributor | `PrintingTemplateCondition` | Default Printing Conditional File Path | `C:\shoper7\BillTemplates\ShoperControl.VPL` |
| Distributor | `ConfigPathFile` | Location Of The ConfigFile.INI Used In Bill Printing | `C:\Configfile.ini` |
| Distributor | `ASTExportPath` | AST Export Path | `C:\Shoper72\AstOut` |
| Distributor | `ASTImportPath` | AST Import Path | `C:\Shoper72\AstOut` |
| Distributor | `ASTBackUpPath` | AST BackUp Path | `C:\Shoper72\AstOut` |
| Distributor | `PathBarcodeDesignTemplates` | Loading / Storing Path for Barcode Design Templates | `C:\Shoper72\Barcode` |
| Distributor | `BackupPath` | Shoper Temporary Backup Path | `C:\Shop723\Backup` |
| Distributor | `ShoperImageFilePath` | Shoper Image File Path | `C:\Shoper72\Images` |

---

## 5. Retail vs Distributor Parameter Variances (26)
Differences in parameter values between Retail and Distributor operational profiles:

| Parameter Code | Description | Category | Retail Value | Distributor Value |
|---|---|---|---|---|
| `ActivateItemwiseSalesman` | Default Setting for Sales Man Selection in Billing | 11. Billing | `Bool=0|Int=2|Txt=` | `Bool=0|Int=0|Txt=` |
| `AdlTablesToSync` | Additional Tables to be Included During Sync. | 17. House Keeping | `Bool=0|Int=0|Txt=VersionwiseTblsScript#VersionDtls#` | `Bool=0|Int=0|Txt=` |
| `AllowCreditBilling` | Credit Billing Allowed | 11. Billing | `Bool=0|Int=0|Txt=` | `Bool=1|Int=0|Txt=` |
| `BrowseDescString1` | Item Browse Description String Formation - 1 | 16. Browse | `Bool=0|Int=0|Txt=Y01#N02#Y03#Y04#Y05#Y06#Y07#Y08` | `Bool=0|Int=0|Txt=Y01#N02#Y03#Y04#Y05#Y06#Y07#N08` |
| `BrowseDescString2` | Item Browse Description String Formation - 2 | 16. Browse | `Bool=0|Int=0|Txt=N09#N10#N11#N12#N13#N14#N15#N16#N17` | `Bool=0|Int=0|Txt=N09#N10#N11#N12#N13#N14#N15#N16#Y17` |
| `CBrowseFieldSeleString1` | Primary Cust Browse Field Selection - Adv. Query | 16. Browse | `Bool=0|Int=|Txt=#Y00#Y01#Y00#N00#Y03#` | `Bool=0|Int=0|Txt=#Y00#Y01#Y00#N00#Y03#` |
| `CashRcptPayoutBillFormType` | Cash Receipt/ Payout Printing Mode | 14. Bill - Printing | `Bool=0|Int=1|Txt=` | `Bool=0|Int=2|Txt=` |
| `ClubDupInBill` | Club Duplicate Items in Bill | 11. Billing | `Bool=-1|Int=0|Txt=` | `Bool=1|Int=0|Txt=` |
| `CommonPTFileCreationEnabled` | Enable Common PT File Creation | 09. Inwards | `Bool=|Int=0|Txt=2100:N#2200:N#2300:N#2400:N#2500:N#9800:N#9900:N` | `Bool=0|Int=0|Txt=2100:N#2200:N#2300:N#2400:N#2500:N#9800:N#9900:N` |
| `CustClass1Cap` | Customer Classification1 Caption | 05. Customer | `Bool=0|Int=0|Txt=Religion` | `Bool=0|Int=0|Txt=Zone` |
| `CustClass2Cap` | Customer Classification2 Caption | 05. Customer | `Bool=0|Int=0|Txt=Ethnicity` | `Bool=0|Int=0|Txt=State` |
| `CustClass3Cap` | Customer Classification3 Caption | 05. Customer | `Bool=0|Int=0|Txt=Age Group` | `Bool=0|Int=0|Txt=District` |
| `CustClass4Cap` | Customer Classification4 Caption | 05. Customer | `Bool=0|Int=0|Txt=Profession` | `Bool=0|Int=0|Txt=City` |
| `DefaultTaxInclusiveUpdateInPMGIR` | PM Import and GIR - Update TAX automatically | 09. Inwards | `Bool=|Int=0|Txt=0N` | `Bool=0|Int=0|Txt=0N` |
| `InBillingCustSelectionCompulsary` | Customer Selection Mandatory in Billing | 11. Billing | `Bool=0|Int=0|Txt=` | `Bool=1|Int=0|Txt=` |
| `ItemAnaCd1Present` | Item Analysis Code1 Present | 03. Item Classification | `Bool=-1|Int=0|Txt=` | `Bool=1|Int=0|Txt=` |
| `ItemAnaCd2Present` | Item Analysis Code2  Present | 03. Item Classification | `Bool=-1|Int=0|Txt=` | `Bool=1|Int=0|Txt=` |
| `ItemAnaCd3Present` | Item Analysis Code3  Present | 03. Item Classification | `Bool=-1|Int=0|Txt=` | `Bool=1|Int=0|Txt=` |
| `ItemAnaCd4Present` | Item Analysis Code4  Present | 03. Item Classification | `Bool=-1|Int=0|Txt=` | `Bool=1|Int=0|Txt=` |
| `ItemAnaCd5Present` | Item Analysis Code5  Present | 03. Item Classification | `Bool=-1|Int=0|Txt=` | `Bool=1|Int=0|Txt=` |

*(Showing 20 of 26 parameter variances. Complete listing available in [parameters.json](./parameters.json))*

---

## 6. Distributor Workflow Mappings (5)

| Workflow ID | Business Capability | Legacy Shoper9 Menu | SMRITI Canonical Target | Status |
|---|---|---|---|---|
| `WF-DC-SALES` | Sales Delivery Challan (Sales DC) | Sales -> DC Generation -> Sales DC (SR115500.EXE / PgmOpt 8) | `/distributor-invoicing (Delivery Challan Mode)` | `MAPPED` |
| `WF-DC-APPROVAL` | Approval Issue Delivery Challan | Sales -> DC Generation -> Approval Issue DC (SR115500.EXE / PgmOpt 9) | `/distributor-invoicing (Approval Issue Mode)` | `MAPPED` |
| `WF-TRANSPORT-RECEIPT` | Transport Receipt Entry | Sales -> DC Generation -> Transport Receipt Entry (SD400800.EXE / PgmOpt 8) | `/dispatch-manifests (Transport LR & Carrier Receipt)` | `MAPPED` |
| `WF-CONV-SALES-APPROVAL` | Conversion of Sales DC to Approval Issue DC | Sales -> DC Generation -> Conversion of Sales DC to Approval Issue DC (SD100500.EXE) | `/distributor-invoicing (Challan Type Reclassification)` | `MAPPED` |
| `WF-PO-CONSOLIDATION` | Purchase Order Consolidation | Purchase Order -> Consolidation (SE100900.EXE / PgmOpt 3) | `/purchase-studio (PO Batch Consolidation & Multi-Store Aggregation)` | `MAPPED` |

---

## 7. Safety & Compliance Attestation
- [x] Zero direct SQL execution against `smritisys`, `smriti001`, or `smriti002`.
- [x] Zero modifications, renames, or deletions in `D:\Shoper9\Templates`.
- [x] All legacy character encodings preserved.
- [x] Quarantined temporary files excluded from production schemas.
- [x] All duplicate SQL statements pruned from reviewed copies.
