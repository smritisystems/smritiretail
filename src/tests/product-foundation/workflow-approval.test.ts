import { describe, expect, it } from 'vitest';
import { ApprovalService } from '../../product-foundation/workflow/approval/application/approvalService';

describe('Workflow approval engine', () => {
  it('supports multi-level approval with task assignment and step progression', () => {
    const approval = new ApprovalService();
    let workflow = approval.createWorkflow('wf-1', 'sales-invoice');

    workflow = approval.addStep(workflow, 'step-1', 'Sales Review', 1, 'sales-approver', 'user-sales');
    workflow = approval.addStep(workflow, 'step-2', 'Finance Approval', 2, 'finance-approver', 'user-finance');

    expect(workflow.status).toBe('draft');
    expect(workflow.steps).toHaveLength(2);
    expect(workflow.steps[0].status).toBe('pending');

    workflow = approval.submitWorkflow(workflow);
    expect(workflow.status).toBe('in-progress');
    expect(workflow.currentStepId).toBe('step-1');
    expect(workflow.steps[0].status).toBe('in-progress');
    expect(workflow.steps[1].status).toBe('pending');

    workflow = approval.approveStep(workflow, 'step-1');
    expect(workflow.steps[0].status).toBe('approved');
    expect(workflow.steps[1].status).toBe('in-progress');
    expect(workflow.currentStepId).toBe('step-2');

    workflow = approval.approveStep(workflow, 'step-2');
    expect(workflow.status).toBe('approved');
    expect(workflow.currentStepId).toBeUndefined();
    expect(workflow.steps.every((step) => step.status === 'approved')).toBe(true);
  });

  it('escalates a step when SLA is breached and allows manual escalation', () => {
    const approval = new ApprovalService();
    let workflow = approval.createWorkflow('wf-2', 'purchase-invoice');

    workflow = approval.addStep(workflow, 'step-1', 'Purchase Review', 1, 'purchase-approver', 'user-purchase', '2000-01-01T00:00:00.000Z');
    workflow = approval.setSlaPolicy(workflow, { id: 'sla-1', name: '24h SLA', durationHours: 24, escalationRole: 'manager' });
    workflow = approval.submitWorkflow(workflow);

    const escalated = approval.evaluateSla(workflow, '2100-01-01T00:00:00.000Z');
    expect(escalated.status).toBe('escalated');
    expect(escalated.steps[0].status).toBe('escalated');
    expect(escalated.steps[0].comments).toContain('SLA breach');

    const manualEscalation = approval.escalateStep(workflow, 'step-1', 'urgent review required');
    expect(manualEscalation.status).toBe('escalated');
    expect(manualEscalation.steps[0].status).toBe('escalated');
    expect(manualEscalation.steps[0].comments).toBe('urgent review required');
  });
});
