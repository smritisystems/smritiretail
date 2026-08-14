<!--
  Title: Product Identity Engine Error Catalogue
  Version: 1.0
  Status: Draft
  Owner: Enterprise Architecture
  Reviewers: Product, Engineering, QA
  Last Updated: 2026-07-18
  Dependencies: PRODUCT_IDENTITY_ENGINE_API_SPEC.md
  Related Documents: PRODUCT_IDENTITY_ENGINE_STATE_MACHINE.md, PRODUCT_IDENTITY_ENGINE_SEQUENCE.md
  Change History:
    - v1.0 2026-07-18 Created.
-->

# Product Identity Engine Error Catalogue

## Purpose

Provides a canonical set of error codes, descriptions, causes, and remediation guidance for PIE developers and API consumers.

## Error Catalogue

| Code | Description | Cause | Remediation |
|---|---|---|---|
| PIE-001 | Duplicate business key | Incoming SKU or import row maps to a business key already assigned to an active identity | Review the SKU attributes and resolve the duplicate rule or business key conflict |
| PIE-002 | GS1 pool exhausted | The configured GS1 provider has no available barcodes to assign | Replenish the GS1 pool or fall back to alternate barcode provider | 
| PIE-003 | Invalid rule | Rule definition is malformed, missing fields, or violates schema | Fix rule definition and revalidate in the rule simulator | 
| PIE-004 | Fingerprint conflict | Two SKUs share the same identity fingerprint under current hashing strategy | Adjust fingerprint rules or refine attribute selection | 
| PIE-005 | Rule simulation failed | Import or preflight simulation produced errors | Review simulation report, correct payload or rules, rerun simulation | 
| PIE-006 | Identity reserved | Requested barcode or identity candidate is reserved by another transaction | Retry after reservation expires or release the existing reservation | 
| PIE-007 | Barcode already assigned | Requested barcode is assigned to a different SKU | Choose a different barcode or release the existing assignment | 
| PIE-008 | Permission denied | Caller lacks role/permission for action | Verify API token role mapping and authorization policy | 
| PIE-009 | Import validation error | One or more import rows fail schema or business rule validation | Correct import data and rerun import | 
| PIE-010 | Rollback conflict | Rollback transaction cannot be applied due to state mismatch | Inspect transaction history and resolve conflicting assignments | 

## Error Response Format

Errors returned by PIE APIs should include:

- `code` — standardized error code
- `message` — human-readable explanation
- `details` — optional contextual metadata
- `status` — HTTP status code
- `timestamp` — event timestamp

Example:

```json
{
  "code": "PIE-002",
  "message": "GS1 pool exhausted",
  "details": {
    "provider": "GS1-IN",
    "pool": "EAN13-33"
  },
  "status": 409,
  "timestamp": "2026-07-18T12:34:56Z"
}
```

## Mapping to HTTP Status Codes

- `400 Bad Request` — `PIE-003`, `PIE-005`, `PIE-009`
- `401 Unauthorized` — `PIE-008`
- `403 Forbidden` — permission or governance access denied
- `409 Conflict` — `PIE-001`, `PIE-002`, `PIE-004`, `PIE-006`, `PIE-007`, `PIE-010`
- `500 Internal Server Error` — unexpected failures
