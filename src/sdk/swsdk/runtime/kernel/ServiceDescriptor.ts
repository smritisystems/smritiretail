import type { DependencyDescriptor } from "./DependencyDescriptor.js";

export interface ServiceDescriptor {
  id: string;
  name: string;
  version: string;
  status: "enabled" | "disabled" | "deprecated";
  capabilities: string[];
  dependencies: DependencyDescriptor[];
  contracts: string[];
}

export function createServiceDescriptor(overrides: Partial<ServiceDescriptor> = {}): ServiceDescriptor {
  return {
    id: "default-service",
    name: "default-service",
    version: "1.0.0",
    status: "enabled",
    capabilities: [],
    dependencies: [],
    contracts: [],
    ...overrides
  };
}
