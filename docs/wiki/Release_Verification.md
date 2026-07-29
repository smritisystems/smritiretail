# Release Verification

This page describes the automated verification performed after a release is created.

Checks performed by `scripts/release_verify.py`:
- Verify completeness of required artifacts
- Validate `SHA256SUMS` checksums
- Validate `release-manifest.json` contents and consistency with tag
- Validate SBOM JSON (SPDX and CycloneDX)
- Parse Trivy JSON reports; fail on HIGH/CRITICAL
- Pull Docker images and compare repo digests with `image-digests.json`
- Generate `release-validation-report.md` and `release-validation.json`

If verification fails, the pipeline stops and deployments are skipped.
