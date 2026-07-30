<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritisys.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.39.0
  Created      : 2026-07-19
  Modified     : 2026-07-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Release Verification Workflow

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


--------------------------------------------

SMRITI Retail OS

Version: v3.39.0
Release: SMRITI Enterprise Release
Generated: 2026-07-30
Last Updated: 2026-07-30 12:22:54 UTC

© SMRITI Systems

--------------------------------------------
