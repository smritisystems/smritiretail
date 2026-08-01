export type EventLifecycleState = "Register" | "Publishable" | "Deprecated" | "Retired";

export interface CapabilityEventMetadata {
  publishes: string[];
  subscribes: string[];
  lifecycle?: Record<string, EventLifecycleState>;
}

export interface CapabilityDependencyCategories {
  runtime: string[];
  business: string[];
  optional: string[];
}

export interface CapabilityManifest {
  id: string;
  owner: string;
  maturity: string;
  releaseRing: string;
  version: string;
  studios: string[];
  dependencies: CapabilityDependencyCategories | string[];
  dependsOn: string[];
  consumedBy: string[];
  provides: string[];
  events: CapabilityEventMetadata;
  publicApi: boolean;
}

export interface CapabilityModuleManifest {
  name: string;
  owner: string;
  capabilities: CapabilityManifest[];
}

export function createCapabilityManifest(overrides: Partial<CapabilityManifest> = {}): CapabilityManifest {
  return {
    id: "capability",
    owner: "Foundation",
    maturity: "CML-0",
    releaseRing: "Experimental",
    version: "0.1.0",
    studios: [],
    dependencies: {
      runtime: [],
      business: [],
      optional: [],
    },
    dependsOn: [],
    consumedBy: [],
    provides: [],
    events: {
      publishes: [],
      subscribes: [],
      lifecycle: {},
    },
    publicApi: true,
    ...overrides,
  };
}
