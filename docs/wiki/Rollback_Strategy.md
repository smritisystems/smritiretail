# Rollback Strategy

Rollback artifacts include `smriti-rollback-<version>.tar.gz` and `.zip` and must contain at least:
- `docker-compose.prod.yml` (or previous deployment manifest)
- rollback scripts and migration rollbacks if applicable

Procedure
1. Deploy rollback package to target host
2. Run provided rollback script to restore previous compose and artifacts
3. Run smoke tests and validation
