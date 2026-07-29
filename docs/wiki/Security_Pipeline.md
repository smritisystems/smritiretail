# Security Pipeline

Security checks include:
- Dependency audits for `npm` and `pip`
- Gitleaks for secrets
- CodeQL analysis
- SBOM generation (Syft)
- Container image scanning with Trivy (fail on HIGH/CRITICAL)
