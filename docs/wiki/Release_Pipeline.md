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

# Release Pipeline (CI/CD)


This page documents the SMRITI Retail OS release pipeline and orchestrator.

Summary
- Phase 1 (Verify) → Phase 2 (Security) → Phase 3 (Quality) → Phase 4 (Build) → Phase 5 (Image Scan) → Phase 6 (Publish) → Phase 7 (Package) → Phase 8 (Staging Deploy) → Phase 9 (Smoke Tests) → Phase 10 (Production Deploy Gate) → Phase 11 (GitHub Release) → Phase 12 (Production Publish) → Phase 13 (Post Release Report) → Phase 14 (GitHub Announcement) → Phase 15 (Release Completion Summary)

Final Phase Order
```text
Phase 11 – GitHub Release
Phase 12 – Production Publish
Phase 13 – Post Release Report
Phase 14 – GitHub Announcement
Phase 15 – Release Completion Summary
```

Key artifacts produced
- `smriti-release-<version>.tar.gz` / `.zip`
- `smriti-rollback-<version>.tar.gz` / `.zip`
- `build-info.json`, `release-manifest.json`, `image-digests.json`
- `sbom.spdx.json`, `sbom.cyclonedx.json`
- `SHA256SUMS`, `release-validation-report.md`, `release-validation.json`
- `docs/releases/<version>/announcement/` (6 announcement formats: GitHub Release, Discussion, Org, Community Markdown, HTML, PDF)
- `docs/releases/<version>/RELEASE_COMPLETION_SUMMARY.md`

See also: `Enterprise_Release_Management.md` and `SMRITI_MASTER_RELEASE_PIPELINE.md`.


--------------------------------------------

SMRITI Retail OS

Version: v3.39.0
Release: SMRITI Enterprise Release
Generated: 2026-07-30
Last Updated: 2026-07-30 12:22:54 UTC

© SMRITI Systems

--------------------------------------------
