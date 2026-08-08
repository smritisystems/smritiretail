/**
 * Project      : SMRITI Retail OS
 * System       : Universal Document Experience Platform (DXP)
 * Component    : PrintAgentManager (DXP-AGT-001 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Standard     : SCS-DXP-002 Enterprise Printing Architecture v2.0
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
import { PrinterDiscoveryAgent } from "./system/PrinterDiscoveryAgent.ts";
import { CapabilityResolver } from "../core/CapabilityResolver.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../models/DxpTypes.ts";

export class PrintAgentManagerEngine {
  private agents: Map<string, IPrintAgent> = new Map();
  private discoveryAgent: PrinterDiscoveryAgent;

  constructor() {
    this.discoveryAgent = new PrinterDiscoveryAgent();
    this.registerDefaultAgents();
  }

  private registerDefaultAgents() {
    this.register(this.discoveryAgent);
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
    const printerId = req.options?.printerId as string;
    const profile = printerId ? this.discoveryAgent.getProfile(printerId) : undefined;
    const driver = CapabilityResolver.resolveDriver(req, profile);

    const activeAgents = this.listAgents();
    for (const agent of activeAgents) {
      if (agent.canHandle(req)) {
        return agent;
      }
    }
    return this.agents.get("agent.protocol.raw") || activeAgents[0];
  }

  public async dispatch(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    const printerId = req.options?.printerId as string;
    const profile = printerId ? this.discoveryAgent.getProfile(printerId) : undefined;
    const driver = CapabilityResolver.resolveDriver(req, profile);
    const transport = CapabilityResolver.resolveTransport(profile);

    const agent = this.resolveAgent(req);
    console.log(`[DXP-AGT-001 PrintAgentManager]: Resolved Driver [${driver.name}], Transport [${transport.name}], Agent [${agent.name} (${agent.standardId})].`);

    const compiledData = driver.compile(req);
    await transport.send(compiledData);

    return agent.process(req);
  }
}

export const PrintAgentManager = new PrintAgentManagerEngine();
