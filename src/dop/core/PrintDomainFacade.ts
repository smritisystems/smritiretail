/**
 * Project      : SMRITI Retail OS
 * System       : Universal Document Experience Platform (DXP)
 * Component    : PrintDomainFacade (SCS-DXP-002 Unified Domain Facade)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Standard     : SCS-DXP-002 Enterprise Printing Architecture v3.0
 * Version      : 3.0.0
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { PrinterProfileRegistry } from "./PrinterProfileRegistry.ts";
import { PrintProfileEngine } from "./PrintProfileEngine.ts";
import { PrintRoutingEngine } from "./PrintRoutingEngine.ts";
import { PrintAuditLogService } from "./PrintAuditLogService.ts";
import { PrintPipelineHooks } from "./PrintPipelineHooks.ts";
import { CapabilityResolver } from "./CapabilityResolver.ts";
import { PrinterDriverRegistry } from "../drivers/PrinterDriverRegistry.ts";
import { TransportRegistry } from "../transports/TransportRegistry.ts";
import { SimulationDriver } from "../drivers/SimulationDriver.ts";
import { PrintAgentManager } from "../agents/PrintAgentManager.ts";
import { QueueManagerAgent } from "../agents/system/QueueManagerAgent.ts";
import { PrinterHealthAgent } from "../agents/system/PrinterHealthAgent.ts";
import { PrinterDiscoveryAgent } from "../agents/system/PrinterDiscoveryAgent.ts";
import { PrintingSDK } from "../sdk/PrintingSDK.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../models/DxpTypes.ts";

export const PrintDomain = {
  fleet: PrinterProfileRegistry,
  profiles: PrintProfileEngine,
  routing: PrintRoutingEngine,
  audit: PrintAuditLogService,
  hooks: PrintPipelineHooks,
  resolver: CapabilityResolver,
  drivers: PrinterDriverRegistry,
  transports: TransportRegistry,
  simulation: new SimulationDriver(),
  agents: PrintAgentManager,
  queue: new QueueManagerAgent(),
  health: new PrinterHealthAgent(),
  discovery: new PrinterDiscoveryAgent(),
  sdk: PrintingSDK,

  dispatchJob: async (req: DxpDocumentRequest): Promise<DxpDocumentResult> => {
    return PrintAgentManager.dispatch(req);
  },
};

export const SPK_printing = PrintDomain;
