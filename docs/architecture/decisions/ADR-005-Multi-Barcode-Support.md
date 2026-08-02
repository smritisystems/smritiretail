<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# ADR-005: Multi-Barcode Support

## Status
Draft

## Context
Different product channels and packaging formats require support for multiple barcodes per SKU, including GS1, internal, and alternate provider codes.

## Decision
Support multiple barcode assignments per SKU through a dedicated barcode relationship model.

- Allow one primary barcode and zero or more secondary barcode bindings.
- Track provider type, status, and assignment provenance for each barcode.
- Treat barcode reuse as a governed operation with explicit approval and state transition.

## Consequences
- Enables omnichannel packaging and alternate identifier scenarios
- Requires barcode relationship modeling and stateful lifecycle management
- Increases complexity for lookup and decommissioning logic
