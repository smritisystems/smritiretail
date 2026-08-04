# Architecture Freeze Rule (AFR-001)

Once an architecture, governance framework, audit framework, or platform specification reaches FROZEN status, AI agents must not expand, duplicate, rename, or replace it without explicit approval. Future work must focus on evidence collection, implementation, validation, and audit closure.

## Required Workflow

1. Audit
2. Evidence
3. Finding
4. Severity
5. Backlog
6. Implementation
7. Verification
8. Close Finding
9. Update Audit Score

## Traceability Rule

Every implementation PR must reference at least one Audit ID (AUD-xxx) and one Finding ID (F-xxx). Changes without audit traceability should not be merged.
