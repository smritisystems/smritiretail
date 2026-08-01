import type { IPlatformService } from "./IPlatformService.js";
import type { ValidationResult } from "./ValidationResult.js";
import { createValidationResult } from "./ValidationResult.js";

export class LifecycleManager {
  constructor(private readonly services: IPlatformService[]) {}

  public async initialize(): Promise<void> {
    for (const service of this.services) {
      service.initialize();
    }
  }

  public async validate(): Promise<ValidationResult> {
    const errors: string[] = [];
    for (const service of this.services) {
      const result = service.validate();
      if (!result.valid) {
        errors.push(...result.errors);
      }
    }
    return createValidationResult({ valid: errors.length === 0, errors, warnings: [] });
  }

  public async start(): Promise<void> {
    for (const service of this.services) {
      service.start();
    }
  }

  public async stop(): Promise<void> {
    for (const service of this.services) {
      service.stop();
    }
  }

  public async dispose(): Promise<void> {
    for (const service of this.services) {
      service.dispose();
    }
  }
}
