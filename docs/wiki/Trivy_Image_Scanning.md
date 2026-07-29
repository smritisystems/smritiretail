# Trivy Image Scanning

We run Trivy in JSON mode and fail the pipeline if any HIGH or CRITICAL vulnerabilities are detected.

Example:
- `trivy image --format json -o trivy-backend-v1.0.0.json myorg/backend:v1.0.0`
