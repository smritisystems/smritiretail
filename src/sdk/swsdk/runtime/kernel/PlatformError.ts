export class PlatformError extends Error {
  constructor(message: string, public readonly code: string = "PLATFORM_ERROR") {
    super(message);
    this.name = "PlatformError";
  }
}

export class ValidationError extends PlatformError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class DependencyError extends PlatformError {
  constructor(message: string) {
    super(message, "DEPENDENCY_ERROR");
    this.name = "DependencyError";
  }
}

export class CapabilityError extends PlatformError {
  constructor(message: string) {
    super(message, "CAPABILITY_ERROR");
    this.name = "CapabilityError";
  }
}

export class TransportError extends PlatformError {
  constructor(message: string) {
    super(message, "TRANSPORT_ERROR");
    this.name = "TransportError";
  }
}
