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

# Trivy Container Image Scanning


We run Trivy in JSON mode and fail the pipeline if any HIGH or CRITICAL vulnerabilities are detected.

Example:
- `trivy image --format json -o trivy-backend-v1.0.0.json myorg/backend:v1.0.0`


--------------------------------------------

SMRITI Retail OS

Version: v3.39.0
Release: SMRITI Enterprise Release
Generated: 2026-07-30
Last Updated: 2026-07-30 12:22:54 UTC

© SMRITI Systems

--------------------------------------------
