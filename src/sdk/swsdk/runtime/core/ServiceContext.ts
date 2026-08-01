export interface ServiceContext {
  tenant?: string;
  organization?: string;
  workspace?: string;
  user?: string;
  clock?: () => string;
  logger?: { info(message: string): void; warn(message: string): void; error(message: string): void };
  config?: Record<string, unknown>;
  eventBus?: unknown;
  serviceRegistry?: unknown;
}

export function createServiceContext(overrides: ServiceContext = {}): ServiceContext {
  return {
    clock: () => new Date().toISOString(),
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined
    },
    config: {},
    ...overrides
  };
}
