<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.1.0
  Created      : 2026-10-29
  Modified     : 2026-10-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Report Builder: Field Resolution & Intelligent Auto-Consolidation Walkthrough v1.1.0

## 1. Purpose
This walkthrough documents the technical resolution for missing fields (`Article No`, `Style Code`), null/hyphen values (`Color`, `Size`), placeholder categories (`Footwear` / `TOMBSTONE`), and repeated line items (`Quantity = 2`, `Net Total = ₹ 3,069.53`) encountered during custom export runs in the SMRITI Visual Report Builder.

## 2. Scope
- Disambiguation and registration of item dimension attributes across the frontend logical catalog and backend semantic registry.
- PostgreSQL query layer auto-consolidation and aggregation in `ReportsService.query_report_builder`.
- Resilience against orphaned product records via multi-source joins (`Product`, `ItemVariant`, `Item`) and deterministic SKU token parsing fallback (`_parse_sku_tokens`).
- Frontend live data binding enhancements in `ReportBuilder.tsx` to forward active columns and layout signatures to the backend query engine.

## 3. Files Created
None (modifications and test enhancements only).

## 4. Files Modified
- `src/components/reports/reportLayoutEngine.ts`: Disambiguated `id_article_no` to `key: "article_no"` and added `id_item_name` (`key: "item_name"`).
- `backend/app/services/report_field_registry.py`: Registered `item_code`, `style_code`, `article_no`, `item_name`, and `item_category` under `Purchase` and `Sales` domains.
- `backend/app/services/reports.py`: Added static `_parse_sku_tokens`, multi-source joins, batch `sales_order_items` lookup for SAP Article numbers, `func.max(...)` safe projection in consolidated queries, and category sanitization.
- `src/components/reports/ReportBuilder.tsx`: Restored backward-compatible exports (`REPORT_BUILDER_CATALOG_FIELDS`, `DEFAULT_REPORT_BUILDER_ROWS`), forwarded `consolidation_mode="auto"` and `selected_columns`, added `layoutSignature` reactive fetching, and aligned `withCapability` metadata.
- `backend/app/tests/test_report_builder_auto_consolidation.py`: Extended test coverage to assert dimension classification for all newly registered attributes.

## 5. Architecture Decisions
- **Decoupled Projection from Group Key**: In consolidated queries, non-grouping dimension expressions are projected using `func.max(...)` to prevent PostgreSQL `GroupingError` when multiple logical fields derive from the same physical column or subexpression.
- **Batch Resolution over Correlated Subqueries**: Correlated scalar subqueries inside SQL `GROUP BY` caused performance bottlenecks due to unindexed lookups. Replacing them with post-query batch resolution (`sales_order_items.code.in_(distinct_skus)`) reduced query execution latency to milliseconds.
- **Dual-Layer Attribute Fallback**: If relational joins to `products` or `items` return null (e.g. for deleted tombstone products), the system deterministically parses `<STYLE>-<COLOR>-<SIZE>` SKU tokens as an authoritative fallback.

## 6. Design Rationale
In enterprise B2B retail (such as Reliance Retail store dispatch POs), invoices often consist of individual 2-pair or pack-level lines. Without auto-consolidation forwarding active dimension keys, raw invoice line records repeat. Ensuring client layout state automatically drives query grouping allows users to see either fine-grained invoice lines or consolidated style-level summaries on demand.

## 7. Implementation Summary
1. Disambiguated catalog key `id_article_no` from `article_sku` to `article_no`.
2. Mapped `article_no` to SAP article numbers in `sales_order_items` and `item_code` to Master Item Code.
3. Added outer joins to `item_variants` (`variant_id`) and `items` (`item_id`).
4. Replaced correlated scalar subqueries with fast batch lookups for returned row pages.
5. Injected `layoutSignature` into `ReportBuilder.tsx` to automatically re-fetch aggregated data whenever columns or rows are reordered.

## 8. Tests Executed
- `npx vitest run src/tests/reportBuilderAutoConsolidation.test.ts src/tests/reportBuilder.test.ts` (21/21 passed).
- `npx tsc --noEmit` (0 errors).
- `python -c "... asyncio.run(test_report_field_registry_classification()) ..."` (Passed 100%).
- Live PostgreSQL query against tenant `smriti001` (Port 2781) confirming 876 consolidated groups across 26,325 units and ₹25,375,403.02 net total.

## 9. Verification Results
All tests and validations completed with status `Done`. No console errors, type errors, or unhandled nulls were observed.

## 10. Known Limitations
- SKU token fallback assumes standard footwear/apparel SKU syntax (`<STYLE>-<COLOR>-<SIZE>`). Non-standard custom SKUs without dashes rely entirely on database master records.

## 11. Future Work
- Add database index `ix_sales_order_items_code` on `sales_order_items (code)` for multi-million row production databases.

## 12. Related ADRs
- `ADR-0045`: Unified Dimension & Measure Metadata Registry.
- `ADR-0078`: Multi-Tenant Dual-Mode Report Engine Architecture.

## 13. Related RFCs
- `RFC-2026-08`: Intelligent Auto-Consolidation & Dynamic Matrix Pivot Engine.
