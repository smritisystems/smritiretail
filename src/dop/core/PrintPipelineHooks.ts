/**
 * Project      : SMRITI Retail OS
 * System       : Universal Document Experience Platform (DXP)
 * Component    : PrintPipelineHooks (Extensible Lifecycle Interceptor System)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.1.0
 */

import { DxpDocumentRequest, DxpDocumentResult } from "../models/DxpTypes.ts";

export interface PrintPipelineHookContext {
  request: DxpDocumentRequest;
  startTime: number;
  driverId?: string;
  transportId?: string;
  compiledPayload?: string | Uint8Array;
  result?: DxpDocumentResult;
  error?: any;
}

export type PipelineHookPhase = "BEFORE_RENDER" | "BEFORE_DRIVER" | "BEFORE_TRANSPORT" | "AFTER_SUCCESS" | "AFTER_FAILURE";

export type PrintPipelineHookHandler = (context: PrintPipelineHookContext) => Promise<void> | void;

class PrintPipelineHooksManager {
  private hooks: Map<PipelineHookPhase, Set<PrintPipelineHookHandler>> = new Map();

  constructor() {
    this.hooks.set("BEFORE_RENDER", new Set());
    this.hooks.set("BEFORE_DRIVER", new Set());
    this.hooks.set("BEFORE_TRANSPORT", new Set());
    this.hooks.set("AFTER_SUCCESS", new Set());
    this.hooks.set("AFTER_FAILURE", new Set());
    this.registerDefaultHooks();
  }

  private registerDefaultHooks() {
    this.register("BEFORE_RENDER", (ctx) => {
      console.log(`[PrintPipelineHooks]: BEFORE_RENDER for ${ctx.request.documentType} ref=${ctx.request.referenceId}`);
    });

    this.register("AFTER_SUCCESS", (ctx) => {
      console.log(`[PrintPipelineHooks]: AFTER_SUCCESS job=${ctx.result?.jobId} duration=${Date.now() - ctx.startTime}ms`);
    });
  }

  public register(phase: PipelineHookPhase, handler: PrintPipelineHookHandler): void {
    this.hooks.get(phase)?.add(handler);
  }

  public async executePhase(phase: PipelineHookPhase, context: PrintPipelineHookContext): Promise<void> {
    const handlers = this.hooks.get(phase);
    if (handlers) {
      for (const handler of Array.from(handlers)) {
        try {
          await handler(context);
        } catch (err) {
          console.error(`[PrintPipelineHooks Error in ${phase}]:`, err);
        }
      }
    }
  }
}

export const PrintPipelineHooks = new PrintPipelineHooksManager();
