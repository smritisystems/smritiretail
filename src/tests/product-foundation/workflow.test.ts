import { describe, expect, it } from 'vitest';
import { ApprovalService } from '../../product-foundation/workflow/approval/application/approvalService';

describe('Workflow service', () => {
  it('advances an approval workflow to approved status', () => {
    const service = new ApprovalService();
    const draft = service.createWorkflow('sale-999', 'RetailSale');
    const submitted = service.submitWorkflow(draft);
    const approved = service.approveWorkflow(submitted);

    expect(approved.status).toBe('approved');
    expect(approved.id).toBe('sale-999');
    expect(approved.entityType).toBe('RetailSale');
  });
});
