<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# ADR-0006: Platform Kernel Contracts Frozen

## Status

Accepted and Architecture-Frozen (2026-08-01) — authoritative contract freeze for the Stage 5.5 Platform Kernel baseline.

## Context

The platform runtime has matured beyond isolated service collections into a true platform kernel. The kernel now owns service registration, lifecycle orchestration, dependency validation, service descriptor metadata, health aggregation, validation, and context propagation. This baseline is the stable architectural foundation for future platform services, including Audit, Configuration, and Telemetry.

## Decision

The following kernel contracts are now contract-frozen for the current platform baseline:

- `IPlatformService`
- `ServiceDescriptor`
- `DependencyDescriptor`
- `ServiceContext`
- `KernelManifest`
- `KernelEvent`
- `HealthStatus`
- `ValidationResult`
- `ServiceMetrics`
- `CapabilityDescriptor`

The implementation of these contracts may evolve, but the contract shape and semantic intent are fixed for the Stage 5.5 kernel architecture baseline.

The following design principles are binding:

1. `PlatformKernel` is orchestration-focused and not a startup-construction layer.
2. `LifecycleManager` owns lifecycle sequencing and ordering.
3. `ServiceRegistry` owns the authoritative service catalog.
4. Dependencies are explicit descriptors, not loose string references.
5. Kernel outputs are observable through a shared platform message model.
6. New platform services must consume frozen kernel outputs rather than bypass or redefine them.

## Consequences

### Positive
- The platform gains a stable core contract that future services can depend on.
- Service discovery, startup, validation, and health are unified behind one runtime model.
- Audit and other downstream services can subscribe to kernel output instead of direct orchestration.
- Architectural churn is reduced because kernel contracts are frozen and versioned by ADR.

### Trade-offs
- Architectural changes to kernel contracts require an ADR and an explicit platform review.
- Implementation-level refinements remain possible, but not contract-level redesigns.
- The kernel remains intentionally narrow and does not absorb product-specific configuration or audit business logic.

## Related Artifacts

- [src/sdk/swsdk/runtime/kernel](../src/sdk/swsdk/runtime/kernel)
- [src/tests/swsdk.kernel.test.ts](../src/tests/swsdk.kernel.test.ts)
- [docs/architecture/adr-0006.md](./adr-0006.md)
