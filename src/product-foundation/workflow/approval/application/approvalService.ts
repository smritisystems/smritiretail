import {
  ApprovalMatrixRule,
  SlaPolicy,
  WorkflowContext,
  WorkflowEngine,
} from '../domain/workflow';

export class ApprovalService {
  private readonly engine = new WorkflowEngine();

  public createWorkflow(
    id: string,
    entityType: string,
    steps = [],
    matrix?: ApprovalMatrixRule,
    slaPolicy?: SlaPolicy
  ): WorkflowContext {
    return this.engine.createWorkflow(id, entityType, steps, matrix, slaPolicy);
  }

  public addStep(
    context: WorkflowContext,
    stepId: string,
    name: string,
    level = 1,
    assignedRole?: string,
    assignedTo?: string,
    dueDate?: string
  ): WorkflowContext {
    return this.engine.addStep(context, stepId, name, level, assignedRole, assignedTo, dueDate);
  }

  public setApprovalMatrix(context: WorkflowContext, matrix: ApprovalMatrixRule): WorkflowContext {
    return this.engine.setApprovalMatrix(context, matrix);
  }

  public setSlaPolicy(context: WorkflowContext, slaPolicy: SlaPolicy): WorkflowContext {
    return this.engine.setSlaPolicy(context, slaPolicy);
  }

  public assignStep(context: WorkflowContext, stepId: string, assignedTo: string, assignedRole?: string): WorkflowContext {
    return this.engine.assignStep(context, stepId, assignedTo, assignedRole);
  }

  public submitWorkflow(context: WorkflowContext): WorkflowContext {
    return this.engine.submit(context);
  }

  public approveWorkflow(context: WorkflowContext): WorkflowContext {
    return this.engine.approveWorkflow(context);
  }

  public approveStep(context: WorkflowContext, stepId: string): WorkflowContext {
    return this.engine.approveStep(context, stepId);
  }

  public rejectStep(context: WorkflowContext, stepId: string, comments?: string): WorkflowContext {
    return this.engine.rejectStep(context, stepId, comments);
  }

  public escalateStep(context: WorkflowContext, stepId: string, comments?: string): WorkflowContext {
    return this.engine.escalateStep(context, stepId, comments);
  }

  public evaluateSla(context: WorkflowContext, currentTime?: string): WorkflowContext {
    return this.engine.evaluateSla(context, currentTime);
  }

  public getCurrentStep(context: WorkflowContext) {
    return this.engine.getCurrentStep(context);
  }
}
