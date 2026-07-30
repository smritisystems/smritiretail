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


--------------------------------------------

SMRITI Retail OS

Version: v3.39.0
Release: SMRITI Enterprise Release
Generated: 2026-07-30
Last Updated: 2026-07-30 12:22:54 UTC

© SMRITI Systems

--------------------------------------------
