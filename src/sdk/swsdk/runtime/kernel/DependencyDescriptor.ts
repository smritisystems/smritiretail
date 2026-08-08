export interface DependencyDescriptor {
  serviceId: string;
  minimumVersion: string;
  optional: boolean;
  reason: string;
}

export function createDependencyDescriptor(overrides: Partial<DependencyDescriptor> = {}): DependencyDescriptor {
  return {
    serviceId: "",
    minimumVersion: "0.0.0",
    optional: false,
    reason: "required dependency",
    ...overrides
  };
}
