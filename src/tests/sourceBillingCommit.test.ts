import { describe, expect, it } from "vitest";
import { buildSalesOrderBillingCommitRequest } from "../utils/sourceBillingCommit.ts";

describe("buildSalesOrderBillingCommitRequest", () => {
  const invoice = { customer_id: "customer-1", status: "Completed" };

  it("uses the single-order commit contract for one Sales Order", () => {
    expect(buildSalesOrderBillingCommitRequest({
      documentId: "order-1",
      documentIds: ["order-1"],
      lines: [{ sourceDocumentId: "order-1", sourceLineId: "line-1", quantity: 2 }],
    }, invoice)).toEqual({
      source_type: "SALES_ORDER",
      source_document_id: "order-1",
      lines: [{ source_line_id: "line-1", quantity: 2 }],
      invoice,
    });
  });

  it("retains each source order on consolidated invoice lines", () => {
    expect(buildSalesOrderBillingCommitRequest({
      documentId: "order-1",
      documentIds: ["order-1", "order-2"],
      lines: [
        { sourceDocumentId: "order-1", sourceLineId: "line-1", quantity: 2 },
        { sourceDocumentId: "order-2", sourceLineId: "line-2", quantity: 1 },
      ],
    }, invoice)).toEqual({
      source_type: "SALES_ORDER",
      source_document_ids: ["order-1", "order-2"],
      lines: [
        { source_document_id: "order-1", source_line_id: "line-1", quantity: 2 },
        { source_document_id: "order-2", source_line_id: "line-2", quantity: 1 },
      ],
      invoice,
    });
  });
});
