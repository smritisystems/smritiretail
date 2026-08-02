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

# Sales Quotation SQ-001 API Design

## Endpoints
- POST /sales/quotations
- GET /sales/quotations/{id}
- PUT /sales/quotations/{id}
- POST /sales/quotations/{id}/submit
- POST /sales/quotations/{id}/approve
- POST /sales/quotations/{id}/print

## Payload Notes
- Include customer reference
- Include line items with pricing and tax details
- Support workflow state transitions
- Return audit trail references
