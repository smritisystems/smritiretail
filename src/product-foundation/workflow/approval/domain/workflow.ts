export type WorkflowStatus =
  | 'draft'
  | 'submitted'
  | 'in-progress'
  | 'approved'
  | 'rejected'
  | 'escalated'
  | 'cancelled';

export type WorkflowStepStatus = 'pending' | 'in-progress' | 'approved' | 'rejected' | 'escalated';

export interface SlaPolicy {
  id: string;
  name: string;
  durationHours: number;
  escalationRole?: string;
}

export interface ApprovalMatrixRule {
  id: string;
  entityType: string;
  minimumAmount?: number;
  maximumAmount?: number;
  approvalLevels: number;
  approverRoles: string[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  level: number;
  status: WorkflowStepStatus;
  assignedTo?: string;
  assignedRole?: string;
  dueDate?: string;
  completedAt?: string;
  escalatedAt?: string;
  comments?: string;
}

export interface WorkflowContext {
  id: string;
  entityType: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  currentStepId?: string;
  matrix?: ApprovalMatrixRule;
  slaPolicy?: SlaPolicy;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class WorkflowEngine {
  public createWorkflow(
    id: string,
    entityType: string,
    steps: WorkflowStep[] = [],
    matrix?: ApprovalMatrixRule,
    slaPolicy?: SlaPolicy
  ): WorkflowContext {
    const timestamp = nowIso();
    return {
      id,
      entityType,
      status: 'draft',
      steps,
      currentStepId: undefined,
      matrix,
      slaPolicy,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {},
    };
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
    const step: WorkflowStep = {
      id: stepId,
      name,
      level,
      status: 'pending',
      assignedRole,
      assignedTo,
      dueDate,
    };

    return this.updateContext(context, {
      steps: [...context.steps, step],
    });
  }

  public setApprovalMatrix(context: WorkflowContext, matrix: ApprovalMatrixRule): WorkflowContext {
    return this.updateContext(context, { matrix });
  }

  public setSlaPolicy(context: WorkflowContext, slaPolicy: SlaPolicy): WorkflowContext {
    return this.updateContext(context, { slaPolicy });
  }

  public assignStep(
    context: WorkflowContext,
    stepId: string,
    assignedTo: string,
    assignedRole?: string
  ): WorkflowContext {
    return this.updateContext(context, {
      steps: context.steps.map((step) =>
        step.id === stepId ? { ...step, assignedTo, assignedRole, status: step.status === 'pending' ? 'pending' : step.status } : step
      ),
    });
  }

  public submit(context: WorkflowContext): WorkflowContext {
    if (context.status !== 'draft') {
      throw new Error('Only draft workflows can be submitted.');
    }

    const steps: WorkflowStep[] = context.steps.map((step, index) => ({
      ...step,
      status: (index === 0 ? 'in-progress' : 'pending') as WorkflowStepStatus,
    }));

    return this.updateContext(context, {
      status: steps.length > 0 ? 'in-progress' : 'submitted',
      steps,
      currentStepId: steps.length > 0 ? steps[0].id : undefined,
    });
  }

  public approveStep(context: WorkflowContext, stepId: string): WorkflowContext {
    const step = this.getStep(context, stepId);
    if (step.status !== 'in-progress') {
      throw new Error('Only in-progress steps can be approved.');
    }

    const approvedAt = nowIso();
    const updatedSteps: WorkflowStep[] = context.steps.map((current) =>
      current.id === stepId ? { ...current, status: 'approved' as WorkflowStepStatus, completedAt: approvedAt } : current
    );

    const nextStep = updatedSteps.find((next) => next.status === 'pending');
    if (nextStep) {
      const progressedSteps: WorkflowStep[] = updatedSteps.map((next) =>
        next.id === nextStep.id ? { ...next, status: 'in-progress' as WorkflowStepStatus } : next
      );
      return this.updateContext(context, {
        status: 'in-progress',
        steps: progressedSteps,
        currentStepId: nextStep.id,
      });
    }

    return this.updateContext(context, {
      status: 'approved',
      steps: updatedSteps,
      currentStepId: undefined,
    });
  }

  public approveWorkflow(context: WorkflowContext): WorkflowContext {
    if (context.status === 'approved') {
      return context;
    }

    const currentStep = this.getCurrentStep(context);
    if (currentStep) {
      return this.approveStep(context, currentStep.id);
    }

    if (context.status === 'submitted') {
      return this.updateContext(context, {
        status: 'approved',
        currentStepId: undefined,
      });
    }

    throw new Error('No current step available to approve.');
  }

  public rejectStep(context: WorkflowContext, stepId: string, comments?: string): WorkflowContext {
    const step = this.getStep(context, stepId);
    if (step.status !== 'in-progress') {
      throw new Error('Only in-progress steps can be rejected.');
    }

    const rejectedAt = nowIso();
    const updatedSteps: WorkflowStep[] = context.steps.map((current) =>
      current.id === stepId ? { ...current, status: 'rejected' as WorkflowStepStatus, completedAt: rejectedAt, comments } : current
    );

    return this.updateContext(context, {
      status: 'rejected',
      steps: updatedSteps,
      currentStepId: undefined,
    });
  }

  public escalateStep(context: WorkflowContext, stepId: string, comments?: string): WorkflowContext {
    const step = this.getStep(context, stepId);
    if (step.status !== 'in-progress') {
      throw new Error('Only in-progress steps can be escalated.');
    }

    const escalatedAt = nowIso();
    const updatedSteps: WorkflowStep[] = context.steps.map((current) =>
      current.id === stepId
        ? { ...current, status: 'escalated' as WorkflowStepStatus, escalatedAt, comments: comments ?? current.comments }
        : current
    );

    return this.updateContext(context, {
      status: 'escalated',
      steps: updatedSteps,
      currentStepId: stepId,
    });
  }

  public evaluateSla(context: WorkflowContext, currentTime = nowIso()): WorkflowContext {
    if (context.status !== 'in-progress') {
      return context;
    }

    const currentStep = this.getCurrentStep(context);
    if (!currentStep?.dueDate || currentStep.status !== 'in-progress') {
      return context;
    }

    if (currentStep.dueDate < currentTime) {
      return this.escalateStep(context, currentStep.id, 'SLA breach');
    }

    return context;
  }

  public getCurrentStep(context: WorkflowContext): WorkflowStep | undefined {
    return context.steps.find((step) => step.id === context.currentStepId) ?? context.steps.find((step) => step.status === 'in-progress');
  }

  private getStep(context: WorkflowContext, stepId: string): WorkflowStep {
    const step = context.steps.find((current) => current.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found.`);
    }
    return step;
  }

  private updateContext(context: WorkflowContext, updates: Partial<WorkflowContext>): WorkflowContext {
    return {
      ...context,
      ...updates,
      updatedAt: nowIso(),
    };
  }
}
