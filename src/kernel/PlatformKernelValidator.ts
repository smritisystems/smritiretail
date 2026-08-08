import { createValidationResult, type ValidationResult } from "../sdk/swsdk/runtime/kernel/ValidationResult.js";
import { DocumentDefinitionRegistry } from "../product-foundation/document/application/documentDefinitionRegistry.js";
import { TransactionPolicyRegistry } from "../product-foundation/commerce/application/transactionPolicyRegistry.js";
import { WorkflowPolicyRegistry } from "../product-foundation/workflow/approval/application/workflowPolicyRegistry.js";
import { NumberingPolicyRegistry } from "../product-foundation/document/numbering/application/numberingPolicyRegistry.js";
import { PrintPolicyRegistry } from "../product-foundation/document/print/application/printPolicyRegistry.js";
import { NotificationPolicyRegistry } from "../product-foundation/commerce/application/notificationPolicyRegistry.js";
import { PrintRegistry } from "./upr/printing/PrintRegistry.js";
import { WorkflowRegistry } from "./upr/workflow/WorkflowRegistry.js";
import { NumberingEngine } from "../services/numberingEngine.js";
import { PipelineStageRegistry } from "../product-foundation/commerce/application/businessTransactionStageRegistry.js";

export class PlatformKernelValidator {
  public static validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Validate document definitions and referenced policies
    for (const def of DocumentDefinitionRegistry.listDefinitions()) {
      // Transaction policy presence
      try {
        const tp = def.transactionPolicy;
        if (!tp || !TransactionPolicyRegistry.hasPolicy(tp.policyName)) {
          errors.push(`Document definition '${def.id}' references missing transaction policy '${tp?.policyName ?? "<none>"}'.`);
        }
      } catch (e) {
        errors.push(`Error validating transaction policy for document '${def.id}': ${(e as Error).message}`);
      }

      // Workflow policy presence (warn if missing)
      try {
        const wf = def.workflowPolicy;
        if (!wf || !WorkflowPolicyRegistry.getPolicy(wf.policyName)) {
          warnings.push(`Document definition '${def.id}' references unknown workflow policy '${wf?.policyName ?? "<none>"}'.`);
        }
      } catch (e) {
        warnings.push(`Workflow policy lookup failed for '${def.id}': ${(e as Error).message}`);
      }

      // Numbering policy -> series existence
      try {
        const np = def.numberingPolicy;
        if (np && np.seriesId) {
          const series = NumberingEngine.getAllSeries().find((s) => s.id === np.seriesId);
          if (!series) {
            errors.push(`Document definition '${def.id}' references missing numbering series '${np.seriesId}'.`);
          }
        }
      } catch (e) {
        errors.push(`Error validating numbering for document '${def.id}': ${(e as Error).message}`);
      }

      // Print policy -> template existence
      try {
        const pp = def.printPolicy;
        if (pp && pp.templateName) {
          const tmpl = PrintRegistry.getTemplate(pp.templateName);
          if (!tmpl) {
            errors.push(`Document definition '${def.id}' references missing print template '${pp.templateName}'.`);
          }
        }
      } catch (e) {
        errors.push(`Error validating print policy for document '${def.id}': ${(e as Error).message}`);
      }

      // Notification policy basic check
      try {
        const npol = def.notificationPolicy;
        if (npol && (!npol.eventTypes || npol.eventTypes.length === 0)) {
          warnings.push(`Notification policy for document '${def.id}' has no eventTypes configured.`);
        }
      } catch (e) {
        warnings.push(`Error validating notification policy for '${def.id}': ${(e as Error).message}`);
      }
    }

    // 2. Validate transaction policies for stage names
    for (const policy of TransactionPolicyRegistry.listPolicies()) {
      for (const stageName of policy.stages) {
        if (!PipelineStageRegistry[stageName]) {
          errors.push(`Transaction policy '${policy.policyName}' references unknown pipeline stage '${stageName}'.`);
        }
      }
    }

    // 3. Validate workflow policies against registered workflows (non-fatal warning)
    for (const wfPolicy of WorkflowPolicyRegistry.listPolicies()) {
      try {
        if (wfPolicy.workflowTemplate) {
          const wf = WorkflowRegistry.getWorkflow(wfPolicy.workflowTemplate);
          if (!wf) {
            warnings.push(`Workflow policy '${wfPolicy.policyName}' references unknown workflow template '${wfPolicy.workflowTemplate}'.`);
          }
        }
      } catch (e) {
        warnings.push(`Workflow lookup error for policy '${wfPolicy.policyName}': ${(e as Error).message}`);
      }
    }

    // 4. Validate print policies reference existing templates
    for (const p of PrintPolicyRegistry.listPolicies()) {
      if (p.templateName) {
        const tmpl = PrintRegistry.getTemplate(p.templateName);
        if (!tmpl) {
          errors.push(`Print policy '${p.policyName}' references missing template '${p.templateName}'.`);
        }
      }
    }

    // 5. Validate numbering policies reference a known series
    for (const n of NumberingPolicyRegistry.listPolicies()) {
      if (n.seriesId) {
        const series = NumberingEngine.getAllSeries().find((s) => s.id === n.seriesId);
        if (!series) {
          errors.push(`Numbering policy '${n.policyName}' references missing series '${n.seriesId}'.`);
        }
      }
    }

    // 6. Notification policies basic sanity
    for (const notif of NotificationPolicyRegistry.listPolicies()) {
      if (!notif.eventTypes || notif.eventTypes.length === 0) {
        warnings.push(`Notification policy '${notif.policyName}' has no event types configured.`);
      }
      if (!notif.channels || notif.channels.length === 0) {
        warnings.push(`Notification policy '${notif.policyName}' has no channels configured.`);
      }
    }

    const valid = errors.length === 0;
    return createValidationResult({ valid, errors, warnings, recommendations: [] });
  }
}

export default PlatformKernelValidator;
