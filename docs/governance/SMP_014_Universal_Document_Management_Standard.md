<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0 (SMP-014 Specification)
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Constitutional Governance Specification
-->

# SMP-014: Universal Document Management & Content Platform Standard (SCDP/UDMS)

**Status:** APPROVED — Frozen Governance Specification (v1.0)  
**Parent Standard:** SMP-001 Modular Platform Specification  
**Scope:** Layer 7 SMRITI Content & Document Platform, Document / Attachment Separation, Versioning, Storage Abstraction, Security, OCR Pipeline  

---

## 1. Core Architectural Precept
> **"Documents are first-class platform resources. Attachments are merely relationships between documents and business objects."**

---

## 2. Decoupled 5-Entity Schema Standard

1. **`Document`** — Global document entity storing content metadata, mime type, category, current version, and SHA256 checksum.
2. **`DocumentVersion`** — Immutable version records ensuring no file is ever overwritten.
3. **`Attachment`** — Dynamic reference linking a `Document` to any business record (`reference_type`, `reference_id`).
4. **`AttachmentTag`** — Searchable tag key-value pairs.
5. **`DocumentCategory`** — System categories (Invoice, Quotation, Photo, Warranty, Agreement, Tax, Certificate).

---

## 3. Document Lifecycle FSM

```text
 [UPLOADED] ──> [SCANNED] ──> [INDEXED] ──> [OCR_COMPLETE] ──> [ACTIVE] ──> [ARCHIVED]
```

---

## 4. Storage Provider Abstraction
Storage engines must implement `BaseStorageProvider` allowing seamless execution across Local Disk, NAS, S3, Azure Blob, and MinIO backends. Business modules interact exclusively through platform service abstractions.
