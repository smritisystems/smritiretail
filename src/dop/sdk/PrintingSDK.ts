/**
 * Project      : SMRITI Retail OS
 * System       : Universal Document Experience Platform (DXP)
 * Component    : PrintingSDK (Developer & Partner Hardware SDK)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Standard     : SCS-DXP-002 Enterprise Printing Architecture v3.0
 * Version      : 3.0.0
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { IPrinterDriver, DriverCapabilities, DriverProtocol, DriverManifest, PrinterDriverRegistry } from "../drivers/PrinterDriverRegistry.ts";
import { IPrinterTransport, TransportType, TransportRegistry } from "../transports/TransportRegistry.ts";
import { PrintPipelineHooks, PipelineHookPhase, PrintPipelineHookHandler } from "../core/PrintPipelineHooks.ts";
import { PrintProfileEngine, PrintProfile } from "../core/PrintProfileEngine.ts";
import { DxpDocumentRequest } from "../models/DxpTypes.ts";

export interface CustomDriverOptions {
  id: string;
  name: string;
  protocol: DriverProtocol;
  capabilities: DriverCapabilities;
  manifest?: DriverManifest;
  compileHandler: (req: DxpDocumentRequest) => string | Uint8Array;
}

export class PrintingSDKService {
  public createDriver(options: CustomDriverOptions): IPrinterDriver {
    const driver: IPrinterDriver = {
      id: options.id,
      name: options.name,
      protocol: options.protocol,
      capabilities: options.capabilities,
      manifest: options.manifest,
      compile: options.compileHandler,
    };
    PrinterDriverRegistry.register(driver);
    console.log(`[PrintingSDK]: Registered custom driver plugin '${driver.name}' (${driver.id}).`);
    return driver;
  }

  public createTransport(
    id: string,
    name: string,
    type: TransportType,
    sendHandler: (data: string | Uint8Array) => Promise<boolean>
  ): IPrinterTransport {
    const transport: IPrinterTransport = {
      id,
      name,
      type,
      connect: async () => true,
      send: sendHandler,
      disconnect: async () => {},
      getStatus: () => ({ id, type, isConnected: true, targetAddress: "custom://endpoint" }),
    };
    TransportRegistry.register(transport);
    console.log(`[PrintingSDK]: Registered custom transport plugin '${name}' (${id}).`);
    return transport;
  }

  public registerHook(phase: PipelineHookPhase, handler: PrintPipelineHookHandler): void {
    PrintPipelineHooks.register(phase, handler);
  }

  public registerProfile(profile: PrintProfile): void {
    PrintProfileEngine.register(profile);
  }
}

export const PrintingSDK = new PrintingSDKService();
