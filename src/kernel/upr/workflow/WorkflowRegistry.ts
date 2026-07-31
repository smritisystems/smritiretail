/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Workflow Registry (UWR-001)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & UWR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { PlatformContext } from "../../context/PlatformContext.js";
import { ValidationRegistry } from "../forms/ValidationRegistry.js";

export type WorkflowState = string;

export interface WorkflowTransition {
  id: string;               // Transition key (e.g. "submit", "approve", "reject", "cancel")
  name: string;
  fromState: WorkflowState;
  toState: WorkflowState;
  permissionId?: string;    // Required permission key
  requiredRole?: string;    // Required role identifier
  validatorIds?: string[];  // Validation rules to check before transition
}

export interface WorkflowDefinition {
  id: string;               // Workflow key (e.g. "wf.purchase_order", "wf.discount_approval")
  entityId: string;         // Associated entity (e.g. "purchase_order", "invoice")
  name: string;
  initialState: WorkflowState;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}

export interface WorkflowExecutionResult {
  success: boolean;
  previousState: WorkflowState;
  newState: WorkflowState;
  transitionId: string;
  reason: string;
  errors?: string[];
}

export class WorkflowRegistryService {
  private workflows: Map<string, Readonly<WorkflowDefinition>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultWorkflows();
  }

  private seedDefaultWorkflows() {
    const defaults: WorkflowDefinition[] = [
      {
        id: "wf.purchase_order",
        entityId: "purchase_order",
        name: "Purchase Order Approval Workflow",
        initialState: "draft",
        states: ["draft", "submitted", "approved", "rejected", "completed"],
        transitions: [
          { id: "submit", name: "Submit for Approval", fromState: "draft", toState: "submitted", permissionId: "purchase.order.create" },
          { id: "approve", name: "Approve Order", fromState: "submitted", toState: "approved", requiredRole: "store_manager", permissionId: "purchase.order.approve" },
          { id: "reject", name: "Reject Order", fromState: "submitted", toState: "rejected", requiredRole: "store_manager" },
          { id: "complete", name: "Fulfill & Complete", fromState: "approved", toState: "completed" }
        ]
      }
    ];

    defaults.forEach((w) => this.registerWorkflow(w));
  }

  public registerWorkflow(workflow: WorkflowDefinition): void {
    const payload = Object.freeze({ ...workflow, id: workflow.id.toLowerCase() });
    this.workflows.set(payload.id, payload);
    this.emitChange();
  }

  public getWorkflow(id: string): Readonly<WorkflowDefinition> | undefined {
    if (!id) return undefined;
    return this.workflows.get(id.toLowerCase());
  }

  public getWorkflows(): ReadonlyArray<Readonly<WorkflowDefinition>> {
    return Array.from(this.workflows.values());
  }

  public executeTransition(
    workflowId: string,
    currentState: WorkflowState,
    transitionId: string,
    context: Readonly<PlatformContext>,
    entityValues: Record<string, any> = {}
  ): WorkflowExecutionResult {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      return { success: false, previousState: currentState, newState: currentState, transitionId, reason: `Workflow '${workflowId}' not registered.` };
    }

    const transition = workflow.transitions.find((t) => t.id.toLowerCase() === transitionId.toLowerCase() && t.fromState === currentState);
    if (!transition) {
      return { success: false, previousState: currentState, newState: currentState, transitionId, reason: `Invalid transition '${transitionId}' from state '${currentState}'.` };
    }

    // Role check
    if (transition.requiredRole && context.userRole !== "sysadmin" && context.userRole !== transition.requiredRole) {
      return { success: false, previousState: currentState, newState: currentState, transitionId, reason: `User role '${context.userRole}' cannot execute transition requiring role '${transition.requiredRole}'.` };
    }

    // Validator check
    if (transition.validatorIds) {
      const errors: string[] = [];
      for (const vId of transition.validatorIds) {
        const err = ValidationRegistry.validateField(vId, { fieldId: "workflow", fieldLabel: "Workflow Transition", value: entityValues, entityValues });
        if (err) errors.push(err);
      }
      if (errors.length > 0) {
        return { success: false, previousState: currentState, newState: currentState, transitionId, reason: "Validation failed during transition.", errors };
      }
    }

    return {
      success: true,
      previousState: currentState,
      newState: transition.toState,
      transitionId,
      reason: `Successfully transitioned from '${currentState}' to '${transition.toState}'.`
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.workflows.clear();
    this.seedDefaultWorkflows();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const WorkflowRegistry = new WorkflowRegistryService();
