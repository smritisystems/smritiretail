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

# GitHub Actions Architecture


Overview of reusable workflows and orchestrator layout used by SMRITI Retail OS.

Workflows
- `verify.yml` — runs frontend/backend static checks and tests
- `security-gate.yml` — dependency audits, SBOM generation, CodeQL
- `quality-gate.yml` — linters, formatting, unit test coverage
- `build.yml` — build artifacts and export Docker images as artifacts
- `image-scan.yml` — Trivy scans of built images
- `publish.yml` — push images to GHCR and create `image-digests.json`
- `package.yml` — assemble release/rollback archives, compute checksums, attach SBOMs
- `release-manager.yml` — orchestrator `workflow_call` that sequences the above

Environments
- Use `staging` and `production` GitHub Environments for gated deployments and required reviewers.


--------------------------------------------

SMRITI Retail OS

Version: v3.39.0
Release: SMRITI Enterprise Release
Generated: 2026-07-30
Last Updated: 2026-07-30 12:22:54 UTC

© SMRITI Systems

--------------------------------------------
