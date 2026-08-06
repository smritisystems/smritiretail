/**
 * Project      : SMRITI Retail OS
 * System       : Universal Document Experience Platform (DXP)
 * Component    : PrintAgentManager (DXP-AGT-001 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Standard     : SCS-DXP-002 — Printing Intelligence Layer
 * Version      : 2.0.0
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { IPrintAgent, PrintAgentStatus } from "./IPrintAgent.ts";
import { RawPrintAgent } from "./protocol/RawPrintAgent.ts";
import { EscPosAgent } from "./protocol/EscPosAgent.ts";
import { ZplAgent } from "./protocol/ZplAgent.ts";
import { TsplAgent } from "./protocol/TsplAgent.ts";
import { EplAgent } from "./protocol/EplAgent.ts";
import { CpclAgent } from "./protocol/CpclAgent.ts";
import { PrinterHealthAgent } from "./system/PrinterHealthAgent.ts";
import { QueueManagerAgent } from "./system/QueueManagerAgent.ts";
import { RetryAgent } from "./system/RetryAgent.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../models/DxpTypes.ts";

export class PrintAgentManagerEngine {
  private agents: Map<string, IPrintAgent> = new Map();

  constructor() {
    this.registerDefaultAgents();
  }

  private registerDefaultAgents() {
    this.register(new EscPosAgent());
    this.register(new ZplAgent());
    this.register(new TsplAgent());
    this.register(new EplAgent());
    this.register(new CpclAgent());
    this.register(new RawPrintAgent());
    this.register(new PrinterHealthAgent());
    this.register(new QueueManagerAgent());
    this.register(new RetryAgent());
  }

  public register(agent: IPrintAgent): void {
    this.agents.set(agent.id, agent);
  }

  public getAgent(id: string): IPrintAgent | undefined {
    return this.agents.get(id);
  }

  public listAgents(): IPrintAgent[] {
    return Array.from(this.agents.values());
  }

  public getAgentStatuses(): PrintAgentStatus[] {
    return this.listAgents().map((agent) => agent.getStatus());
  }

  public resolveAgent(req: DxpDocumentRequest): IPrintAgent {
    const activeAgents = this.listAgents();
    for (const agent of activeAgents) {
      if (agent.canHandle(req)) {
        return agent;
      }
    }
    return this.agents.get("agent.protocol.raw") || activeAgents[0];
  }

  public async dispatch(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    const agent = this.resolveAgent(req);
    console.log(`[DXP-AGT-001 PrintAgentManager]: Routing ${req.documentType} via ${agent.name} (${agent.standardId}).`);
    return agent.process(req);
  }
}

export const PrintAgentManager = new PrintAgentManagerEngine();
