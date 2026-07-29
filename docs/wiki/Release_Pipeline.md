# Release Pipeline (CI/CD)

This page documents the SMRITI Retail OS release pipeline and orchestrator.

Summary
- Verify → Quality → Security → Build → Image Scan → Publish → Package → Release Create → Release Verify → Job Summary → Deploy Staging → Smoke Tests → Deploy Production

Key artifacts produced
- `smriti-release-<version>.tar.gz` / `.zip`
- `smriti-rollback-<version>.tar.gz` / `.zip`
- `build-info.json`, `release-manifest.json`, `image-digests.json`
- `sbom.spdx.json`, `sbom.cyclonedx.json`
- `SHA256SUMS`, `release-validation-report.md`, `release-validation.json`

See also: `Enterprise_Release_Management.md`.
