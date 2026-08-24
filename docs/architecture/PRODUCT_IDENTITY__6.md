<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Version    : 1.0.0
  Created    : 2026-07-18
  Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  License    : Proprietary Commercial Software
-->

# Product Identity Engine API Specification

This document defines the REST API contract for the SMRITI Product Identity Engine.

## 1. Identity Rule Management

### GET /identity/rules

Returns all identity rules.

Response:
```json
[
  {
    "id": "uuid",
    "name": "Footwear Rule V5",
    "domain": "product",
    "scope": { "company": "SMRITI-Retail", "category": "Footwear" },
    "priority": 100,
    "status": "active",
    "effectiveDate": "2026-07-20T00:00:00Z"
  }
]
```

### GET /identity/rules/{ruleId}

Returns a single identity rule with full configuration.

Response:
```json
{
  "id": "uuid",
  "name": "Footwear Rule V5",
  "domain": "product",
  "scope": {
    "company": "SMRITI-Retail",
    "branch": "Mumbai",
    "category": "Footwear"
  },
  "priority": 100,
  "fieldSequence": ["articleNo", "color", "size"],
  "normalizeCase": true,
  "ignoreSpaces": true,
  "ignoreSpecialChars": true,
  "duplicatePolicy": "block",
  "autoCreateSku": true,
  "autoAssignBarcode": true,
  "reuseExistingBarcode": true,
  "barcodePolicy": "reuse_existing",
  "status": "active",
  "effectiveDate": "2026-07-20T00:00:00Z",
  "version": 5,
  "metadata": {}
}
```

### POST /identity/rules

Create a new identity rule.

Request:
```json
{
  "name": "Footwear Rule V5",
  "domain": "product",
  "scope": { "company": "SMRITI-Retail", "category": "Footwear" },
  "priority": 100,
  "fieldSequence": ["articleNo", "color", "size"],
  "normalizeCase": true,
  "ignoreSpaces": true,
  "ignoreSpecialChars": true,
  "duplicatePolicy": "block",
  "autoCreateSku": true,
  "autoAssignBarcode": true,
  "reuseExistingBarcode": true,
  "barcodePolicy": "reuse_existing",
  "status": "draft",
  "effectiveDate": "2026-07-20T00:00:00Z",
  "reason": "Footwear launch policy"
}
```

Response:
```json
{
  "id": "uuid",
  "status": "draft",
  "version": 1
}
```

### PUT /identity/rules/{ruleId}

Update an existing rule.

Request and response follow the same shape as `POST /identity/rules`.

### POST /identity/rules/{ruleId}/publish

Publish a drafted rule, moving it into active lifecycle.

Request:
```json
{
  "approvedBy": "owner@example.com",
  "approvedAt": "2026-07-18T12:34:56Z",
  "reason": "Approved for footwear launch"
}
```

Response:
```json
{
  "ruleId": "uuid",
  "status": "published",
  "version": 5
}
```

### POST /identity/rules/{ruleId}/simulate

Simulate a rule against sample SKU rows.

Request:
```json
{
  "skuSamples": [
    { "articleNo": "SH100", "color": "Black", "size": "8" },
    { "articleNo": "SH100", "color": "Black", "size": "9" }
  ]
}
```

Response:
```json
{
  "ruleId": "uuid",
  "results": [
    {
      "businessKey": "SH100|BLACK|8",
      "fingerprint": "...",
      "conflicts": 0,
      "warnings": [],
      "recommendedRule": "Footwear Rule V5"
    }
  ]
}
```

### POST /identity/rules/{ruleId}/rollback

Rollback an active rule to a prior version.

Request:
```json
{
  "targetVersion": 4,
  "reason": "Revert unintended rule change",
  "requestedBy": "admin@example.com"
}
```

Response:
```json
{
  "ruleId": "uuid",
  "status": "active",
  "version": 4
}
```

### GET /identity/rules/{ruleId}/history

Retrieve rule change history.

Response:
```json
[
  {
    "ruleVersion": 5,
    "changedBy": "owner@example.com",
    "changedAt": "2026-07-18T12:34:56Z",
    "reason": "Add new size field",
    "status": "published"
  }
]
```

## 2. Business Identity Evaluation

### POST /identity/evaluate

Request:
```json
{
  "domain": "product",
  "scope": {
    "company": "SMRITI-Retail",
    "branch": "Mumbai",
    "category": "Footwear"
  },
  "skuData": {
    "articleNo": "SH100",
    "color": "Black",
    "size": "8",
    "brand": "NIKE"
  }
}
```

Response:
```json
{
  "businessKey": "SH100|BLACK|8",
  "normalizedKey": "sh100:black:8",
  "fingerprint": "d2d2f0f1c2d05bc248398837abb35f08f5230b479d5588a19bd6c8b139083d8f",
  "matchedRuleId": "0a1b2c3d-...",
  "confidence": 100,
  "suggestedAction": "reuse_barcode",
  "keyComponents": {
    "articleNo": "SH100",
    "color": "Black",
    "size": "8"
  }
}
```

### POST /identity/simulate

Request:
```json
{
  "domain": "product",
  "scope": {
    "company": "SMRITI-Retail"
  },
  "skuSamples": [
    { "articleNo": "SH100", "color": "Black", "size": "8" },
    { "articleNo": "SH100", "color": "Black", "size": "9" }
  ],
  "ruleId": "0a1b2c3d-..."
}
```

Response:
```json
{
  "results": [
    {
      "businessKey": "SH100|BLACK|8",
      "fingerprint": "...",
      "conflicts": 0,
      "warnings": [],
      "recommendedRule": "Footwear Rule V5"
    },
    {
      "businessKey": "SH100|BLACK|9",
      "fingerprint": "...",
      "conflicts": 0,
      "warnings": [],
      "recommendedRule": "Footwear Rule V5"
    }
  ]
}
```

## 3. Barcode Assignment

### POST /barcode/assign

Request:
```json
{
  "domain": "product",
  "skuData": {
    "articleNo": "SH100",
    "color": "Black",
    "size": "9",
    "brand": "NIKE"
  },
  "providerId": "cbf0a5f3-...",
  "barcodeType": "GS1-128",
  "policy": "reuse_existing",
  "ruleId": "0a1b2c3d-..."
}
```

Response:
```json
{
  "barcodeValue": "8901234567002",
  "status": "assigned",
  "decisionId": "f0e1d2c3-...",
  "ruleVersionId": "0a1b2c3d-...",
  "providerId": "cbf0a5f3-..."
}
```

### POST /barcode/reuse

Request:
```json
{
  "domain": "product",
  "businessKey": "SH100|BLACK|8",
  "providerId": "cbf0a5f3-..."
}
```

Response:
```json
{
  "barcodeValue": "8901234567001",
  "status": "reused",
  "decisionId": "a1b2c3d4-..."
}
```

### POST /barcode/release

Request:
```json
{
  "barcodeValue": "8901234567002",
  "providerId": "cbf0a5f3-...",
  "reason": "SKU deleted during cleanup"
}
```

Response:
```json
{
  "releaseStatus": "released",
  "releasedAt": "2026-07-18T15:00:00Z"
}
```

### GET /barcode/history

Response example:
```json
[
  {
    "skuId": "uuid",
    "barcodeValue": "8901234567001",
    "action": "assigned",
    "timestamp": "2026-07-18T14:00:00Z"
  }
]
```

### GET /barcode/pool

Response example:
```json
[
  {
    "id": "uuid",
    "barcodeValue": "8901234567001",
    "status": "assigned",
    "providerId": "cbf0a5f3-..."
  }
]
```

### GET /barcode/pool/{barcodeId}

Response example:
```json
{
  "id": "uuid",
  "barcodeValue": "8901234567001",
  "status": "assigned",
  "assignedToSkuId": "sku-uuid",
  "assignedAt": "2026-07-18T14:00:00Z"
}
```

## 4. Decision and Audit

### GET /decision/{decisionId}

Response example:
```json
{
  "id": "uuid",
  "businessKeyValue": "SH100|BLACK|8",
  "fingerprint": "...",
  "ruleVersionId": "0a1b2c3d-...",
  "skuFound": true,
  "action": "reuse_barcode",
  "barcodeValue": "8901234567001",
  "confidenceScore": 100,
  "explainText": "Matched Footwear Rule V5; exact business key match found; existing barcode reused.",
  "timestamp": "2026-07-18T14:00:00Z"
}
```

### GET /decision/history

Response example:
```json
[
  {
    "id": "uuid",
    "businessKeyValue": "SH100|BLACK|8",
    "action": "reuse_barcode",
    "timestamp": "2026-07-18T14:00:00Z"
  }
]
```

### GET /rule/history

Response example:
```json
[
  {
    "ruleVersion": 5,
    "changedBy": "owner@example.com",
    "changedAt": "2026-07-18T12:34:56Z",
    "reason": "Add new size field"
  }
]
```

### GET /import/jobs

Response example:
```json
[
  {
    "id": "uuid",
    "fileName": "footwear_import.xlsx",
    "totalRows": 250,
    "reusedCount": 230,
    "generatedCount": 18,
    "failedCount": 2,
    "status": "completed"
  }
]
```

### GET /import/jobs/{jobId}

Response example:
```json
{
  "id": "uuid",
  "fileName": "footwear_import.xlsx",
  "totalRows": 250,
  "reusedCount": 230,
  "generatedCount": 18,
  "failedCount": 2,
  "status": "completed",
  "rows": [
    {
      "rowNumber": 12,
      "businessKeyValue": "SH100|BLACK|8",
      "barcodeFound": "8901234567001",
      "status": "reused"
    }
  ]
}
```

### GET /identity/templates

Response example:
```json
[
  {
    "id": "uuid",
    "name": "Footwear Template",
    "domain": "product",
    "fieldSequence": ["articleNo", "color", "size"]
  }
]
```

### POST /identity/templates

Request:
```json
{
  "name": "Footwear Template",
  "domain": "product",
  "description": "Standard footwear identity template",
  "fieldSequence": ["articleNo", "color", "size"]
}
```

Response:
```json
{
  "id": "uuid",
  "name": "Footwear Template"
}
```

## 5. Permissions

Each endpoint should enforce role-based security.

Minimum permission model:

- `identity.rule.create`
- `identity.rule.edit`
- `identity.rule.publish`
- `identity.rule.rollback`
- `identity.evaluate`
- `barcode.assign`
- `barcode.reuse`
- `barcode.release`
- `barcode.history.view`
- `decision.history.view`
- `import.history.view`

---

This API specification is designed to be the implementation contract for the Product Identity Engine.