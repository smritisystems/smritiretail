# ⚡ PRESENTATION 2: PRODUCT & FEATURE OVERVIEW
**SMRITI Retail OS — Next-Generation Retail ERP & POS Ecosystem**

---

## SLIDE 1: SYSTEM CAPABILITY HIGHLIGHTS

SMRITI Retail OS is an enterprise-grade AI-powered Retail ERP platform built as a modular monolith. It unifies all store operational touchpoints under a single system-of-record.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SMRITI RETAIL OS SUITE                          │
├───────────────────────────────────┬────────────────────────────────────┤
│ 🛒 High-Speed Barcode POS         │ 📦 Barcode & Variant Matrix        │
│ 📑 GST E-Invoicing & E-Way Bill   │ 🔒 MCA Immutable Audit Trail       │
│ ⚡ Offline-First Edge Execution   │ 🏢 Multi-Branch Centralization     │
│ 💳 UPI Dynamic QR & Split Pay     │ 🖨️ ESC/POS Thermal Print Studio    │
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## SLIDE 2: POINT OF SALE (POS) & CHECKOUT SPEED

* **Zero-Click Keyboard Billing:** Full shortcut navigation (`F2` Pay, `F3` Hold Ticket, `F4` Void, `F8` Customer) eliminates mouse dependency for rapid cashier throughput.
* **Barcode Scanner Integration:** Instant item lookup, quantity accumulation, and automatic unit conversion (Loose, Pack, Kg, Grams).
* **Multi-Tender Split Payment:** Accept Cash, UPI Dynamic QR, Credit Card, and Customer Udhaar Ledger in a single transaction.
* **Bill Parking & Recall:** Hold active transactions when customers retrieve additional items, maintaining smooth queue flow.

---

## SLIDE 3: BARCODE & 2D VARIANT MATRIX MANAGEMENT

* **Garment & Footwear Matrix:** Define item variants across Size (S, M, L, XL), Color (Red, Blue, Black), Brand, and Style without creating messy duplicate SKUs.
* **Dynamic Barcode Sticker Studio:** Design and print custom barcode tags directly on Zebra (ZPL) or TSC (TSPL) thermal label printers.
* **Consignment & Franchise Stock:** Segregate company-owned inventory from franchise/consignment stock with automated party visibility.

---

## SLIDE 4: GST COMPLIANCE & MCA AUDIT LOG

* **Automated HSN Tax Mapping:** HSN codes automatically drive CGST, SGST, and IGST tax slab calculations (0%, 5%, 12%, 18%, 28%).
* **E-Invoicing & E-Way Bill Engine:** Generates compliant JSON payloads for real-time submission to the Indian Tax Portal (IRP/NIC).
* **Section 144 MCA Audit Trail:** Immutable, tamper-evident transaction edit logging ensures compliance with Ministry of Corporate Affairs regulations.

---

## SLIDE 5: HYBRID OFFLINE-FIRST ARCHITECTURE

* **Edge Billing Continuity:** Keeps cash registers running seamlessly even during total internet or local network outages.
* **Background Cloud Sync:** Automatically synchronizes offline store transactions, inventory counts, and customer balances back to the central server when connectivity resumes.
* **Zero Data Loss:** Transactions are cached locally in secure persistent browser storage / sqlite edge engines.
