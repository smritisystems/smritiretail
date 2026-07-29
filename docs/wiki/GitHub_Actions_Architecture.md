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
