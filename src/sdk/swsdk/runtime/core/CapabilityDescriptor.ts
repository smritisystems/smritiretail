export interface CapabilityDescriptor {
  id: string;
  version: string;
  status: "enabled" | "disabled" | "deprecated";
  dependencies: string[];
  permissions: string[];
  contracts: string[];
}

export function createCapabilityDescriptor(overrides: Partial<CapabilityDescriptor> = {}): CapabilityDescriptor {
  return {
    id: "default",
    version: "1.0.0",
    status: "enabled",
    dependencies: [],
    permissions: [],
    contracts: [],
    ...overrides
  };
}
