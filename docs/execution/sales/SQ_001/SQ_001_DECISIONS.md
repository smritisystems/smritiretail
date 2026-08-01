# Sales Quotation SQ-001 Decisions

## Purpose
Capture implementation decisions specific to the Sales Quotation document without expanding the architecture ADR set.

## Decisions
- Use the frozen document framework and business transaction pipeline for lifecycle execution.
- Keep pricing, discount, and tax logic policy-driven where possible.
- Use the existing audit and notification mechanisms rather than introducing new services.
- Keep the first implementation focused on a complete document flow rather than broad customization.
