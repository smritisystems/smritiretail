# Sales Quotation SQ-001 Design

## Purpose
Provide the implementation design for the first Sales Quotation document using the frozen platform foundation.

## Design Principles
- Use the document definition registry and workflow policies
- Follow the business transaction pipeline
- Use the lifecycle framework for document state progression
- Keep platform logic policy-driven and avoid new abstractions

## Proposed Flow
1. Create quotation draft
2. Validate customer, item, pricing, and tax data
3. Submit for workflow processing
4. Approve if approval is configured
5. Print or export the quotation
6. Record audit trail and notifications
