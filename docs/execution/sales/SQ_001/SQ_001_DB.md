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

# Sales Quotation SQ-001 Database Design

## Proposed Storage Areas
- Sales quotation header
- Sales quotation line items
- Workflow state history
- Audit trail entries
- Print/export metadata

## Notes
- Reuse the existing platform document and audit mechanisms
- Keep transactional integrity aligned with the frozen pipeline model
