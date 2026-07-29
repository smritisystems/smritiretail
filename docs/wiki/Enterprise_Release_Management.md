# Enterprise Release Management

This flagship page documents the release architecture, policies, and operational checklist for SMRITI Retail OS.

Contents
- Release architecture and flow
- Branch strategy and versioning policy
- GitHub Environments and required approvals
- Release assets and formats (SBOM, digests, checksums)
- Release verification and gating
- Rollback and recovery procedures
- RC process and production checklist

Operational checklist (short)
1. Run RC validation (`deploy=false`) and confirm verification artifacts
2. Configure `staging` environment secrets and reviewers
3. Run staging deploy (`deploy=true`), verify health and smoke tests
4. Run rollback test in staging
5. If staging passes, tag `v1.0.0` and open release
