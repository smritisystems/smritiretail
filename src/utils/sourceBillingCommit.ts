interface SalesOrderBillingLine {
  sourceLineId: string;
  sourceDocumentId: string;
  quantity: number;
}

interface SalesOrderBillingSelection {
  documentId: string;
  documentIds: string[];
  lines: SalesOrderBillingLine[];
}

export function buildSalesOrderBillingCommitRequest(
  source: SalesOrderBillingSelection,
  invoice: Record<string, unknown>,
) {
  const consolidated = source.documentIds.length > 1;
  return {
    source_type: "SALES_ORDER" as const,
    ...(consolidated
      ? { source_document_ids: source.documentIds }
      : { source_document_id: source.documentId }),
    lines: source.lines.map(line => ({
      ...(consolidated ? { source_document_id: line.sourceDocumentId } : {}),
      source_line_id: line.sourceLineId,
      quantity: line.quantity,
    })),
    invoice,
  };
}
