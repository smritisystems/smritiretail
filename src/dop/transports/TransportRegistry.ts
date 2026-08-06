/**
 * Project      : SMRITI Retail OS
 * System       : Universal Document Experience Platform (DXP)
 * Component    : IPrinterTransport Interface & TransportRegistry
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Standard     : SCS-DXP-002 Enterprise Printing Architecture v2.0
 * Version      : 2.0.0
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export type TransportType = "SDA" | "NETWORK" | "USB" | "BLUETOOTH" | "QZ" | "SIMULATION";

export interface TransportStatus {
  id: string;
  type: TransportType;
  isConnected: boolean;
  targetAddress: string;
}

export interface IPrinterTransport {
  id: string;
  type: TransportType;
  name: string;
  
  connect(targetAddress: string): Promise<boolean>;
  send(data: string | Uint8Array): Promise<boolean>;
  disconnect(): Promise<void>;
  getStatus(): TransportStatus;
}

class TransportRegistryService {
  private transports: Map<string, IPrinterTransport> = new Map();

  public register(transport: IPrinterTransport): void {
    this.transports.set(transport.id, transport);
  }

  public get(id: string): IPrinterTransport | undefined {
    return this.transports.get(id);
  }

  public list(): IPrinterTransport[] {
    return Array.from(this.transports.values());
  }

  public resolveBestTransport(preferred?: TransportType): IPrinterTransport {
    const list = this.list();
    if (preferred) {
      const match = list.find((t) => t.type === preferred);
      if (match) return match;
    }
    return list[0] || new DefaultMockTransport();
  }
}

export class DefaultMockTransport implements IPrinterTransport {
  id = "transport.mock";
  type: TransportType = "SIMULATION";
  name = "Default Mock Transport";
  private connected = true;
  private address = "loopback://localhost";

  async connect(targetAddress: string): Promise<boolean> {
    this.address = targetAddress;
    this.connected = true;
    return true;
  }

  async send(data: string | Uint8Array): Promise<boolean> {
    console.log(`[TransportRegistry Mock]: Data stream (${typeof data === "string" ? data.length : data.byteLength} bytes) transmitted to ${this.address}.`);
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  getStatus(): TransportStatus {
    return {
      id: this.id,
      type: this.type,
      isConnected: this.connected,
      targetAddress: this.address,
    };
  }
}

export const TransportRegistry = new TransportRegistryService();
TransportRegistry.register(new DefaultMockTransport());
