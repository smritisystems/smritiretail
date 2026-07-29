# Release Manifest Format

The `release-manifest.json` contains metadata about the release such as version, build-info, docker image tags, and artifact listing.

Minimal example:
```
{
  "version": "v0.9.0-rc1",
  "git_sha": "abcdef123456",
  "build_timestamp": "2026-07-29T12:00:00Z",
  "docker_frontend": "ghcr.io/org/frontend:v0.9.0-rc1",
  "docker_backend": "ghcr.io/org/backend:v0.9.0-rc1"
}
```
