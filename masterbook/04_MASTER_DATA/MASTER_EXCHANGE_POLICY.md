# SMRITI RETAIL OS — MASTER EXCHANGE POLICY GOVERNANCE
**Document ID:** MBOOK-MD-POL-001  
**Version:** 1.0.0 (Phase 3 Baseline)  
**Date:** 2026-08-11  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Proprietary Master Exchange Policy Specification — FROZEN BASELINE  

---

## 1. Executive Summary

This policy governs the exchange of master data across legal entities within SMRITI Retail OS via the Secondary Master Database (`smriti_master_hub`).

---

## 2. Granular Policy Matrix

Each legal entity (Company) configures master exchange policies per `MasterType`:

```text
Company A:
Product      → Publish ✓ | Fetch ✓
Supplier     → Publish ✓ | Fetch ✓
Customer     → Publish ✗ | Fetch ✗
Brand        → Publish ✓ | Fetch ✓

Company B:
Product      → Publish ✗ | Fetch ✓
Supplier     → Publish ✗ | Fetch ✓
Customer     → Publish ✗ | Fetch ✗
Brand        → Publish ✗ | Fetch ✓
```

---

## 3. Payload Sanitation Rules

Every `PUBLISH` payload MUST be sanitized before writing to `master_hub_versions`:

### Prohibited Attributes (Stripped automatically):
- Selling Price / Price List Rates
- Purchase Cost Rates
- Stock Balances / On-Hand Quantities / Reservations
- Customer / Supplier Outstanding Balances
- Journal Entries / Ledger Balances
- Sales History / Transaction Logs

### Allowed Attributes (Exchangeable):
- Product Name & Category
- SKU Code / Barcode / HSN Code
- UOM / Packaging Attributes
- Brand Name
- Non-financial specifications
