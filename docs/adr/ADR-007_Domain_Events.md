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

# ADR-007: Domain Events & Asynchronous Event Bus Architecture

**Status:** APPROVED — v1.0 (2026-07-28)  
**Deciders:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## Context
Direct cross-module function calls (e.g. Sales service calling Accounting repo directly) create tight coupling and prevent asynchronous scaling.

---

## Decision
We implement a **Strongly-Typed Domain Event Bus**:
- Modules communicate cross-boundary via Domain Events (`SaleCompleted`, `StockAdjusted`, `InvoiceCancelled`).
- Event publishing uses strongly-typed domain helper functions (`publish_sale_completed()`) in `backend/app/core/events/domain_events.py`.
- Application modules subscribe to event topics asynchronously without direct database dependencies.

---

## Consequences
- **Positive**: High module cohesion, low coupling, seamless future migration to Redis Streams, Kafka, or RabbitMQ.
- **Negative**: Requires handling eventual consistency for non-transactional subscribers.
