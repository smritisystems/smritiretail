# SBOM Generation

We generate SBOMs using Syft in both SPDX JSON and CycloneDX JSON formats. SBOMs are attached to releases and used for downstream compliance and supply-chain analysis.

Recommended usage
- `syft packages dir:. -o spdx-json=sbom.spdx.json`
- `syft packages dir:. -o cyclonedx=json=sbom.cyclonedx.json`
