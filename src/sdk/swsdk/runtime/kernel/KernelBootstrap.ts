import { PlatformKernel } from "./PlatformKernel.js";
import { createServiceContext, type ServiceContext } from "./ServiceContext.js";
import type { IPlatformService } from "./IPlatformService.js";
import type { PlatformConfiguration } from "./PlatformConfiguration.js";
import { PLATFORM_KERNEL_API_VERSION } from "./version.js";

export interface KernelBootstrapOptions {
  config?: PlatformConfiguration;
  context?: Partial<ServiceContext>;
  services?: Array<{ id: string; service: IPlatformService; descriptor?: Record<string, unknown> }>;
}

export class KernelBootstrap {
  public static readonly API_VERSION = PLATFORM_KERNEL_API_VERSION;

  public static async bootstrap(options: KernelBootstrapOptions = {}): Promise<PlatformKernel> {
    const config = options.config ?? { runtime: {}, featureFlags: {}, limits: {}, policies: {} };
    const context = createServiceContext({
      ...options.context,
      config: { ...config }
    });

    const kernel = new PlatformKernel(context);

    for (const entry of options.services ?? []) {
      kernel.register(entry.service, entry.id);
    }

    await kernel.start();
    return kernel;
  }

  public static async create(options: KernelBootstrapOptions = {}): Promise<PlatformKernel> {
    return this.bootstrap(options);
  }
}
