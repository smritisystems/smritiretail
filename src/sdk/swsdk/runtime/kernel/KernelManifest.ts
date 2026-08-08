import type { ServiceDescriptor } from "./ServiceDescriptor.js";

export interface KernelManifest {
  kernelVersion: string;
  runtimeBaseline: string;
  services: ServiceDescriptor[];
}

export function createKernelManifest(overrides: Partial<KernelManifest> = {}): KernelManifest {
  return {
    kernelVersion: "1.0.0-dev",
    runtimeBaseline: "stage-5.5",
    services: [],
    ...overrides
  };
}
