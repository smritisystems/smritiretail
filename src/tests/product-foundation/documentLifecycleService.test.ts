import { describe, expect, it } from 'vitest';
import { DocumentLifecycleService } from '../../product-foundation/document/application/documentLifecycleService';

describe('DocumentLifecycleService', () => {
  it('creates, submits, approves, and tracks audit entries for a sales invoice', () => {
    const service = new DocumentLifecycleService();

    const result = service.createDocument(
      {
        documentId: 'doc-001',
        documentType: 'SalesInvoice',
        partyId: 'cust-001',
        templateName: 'Retail Invoice Template',
        documentTitle: 'Retail Sales Invoice',
        seriesId: 'SER-001',
        branch: 'HQ',
        financialYear: '2026-2027',
        channels: ['Print'],
        metadata: { source: 'smoke-test' },
      },
      {
        customerId: 'cust-001',
        lines: [
          { itemId: 'sku-001', description: 'Test Item', quantity: 2, unitPrice: 100, netAmount: 200 },
        ],
        taxBreakdown: { cgst: 9, sgst: 9, igst: 0, totalTax: 18 },
        documentTitle: 'Retail Sales Invoice',
      }
    );

    expect(result.context.status).toBe('Draft');
    expect(result.context.documentNumber).toContain('INV');
    expect(result.document.totalAmount).toBe(218);
    expect(result.context.auditTrail).toHaveLength(1);

    const submitted = service.submitDocument(result.context);
    expect(submitted.status).toBe('Submitted');
    expect(submitted.auditTrail).toHaveLength(2);
    expect(service.getAvailableActions(submitted)).toContain('approve');

    const approved = service.approveDocument(submitted);
    expect(approved.status).toBe('Approved');
    expect(approved.auditTrail).toHaveLength(3);
  });
});
