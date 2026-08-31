<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Architectural Decision Record (ADR-001) — Compliance Architecture

## Context
SMRITI Retail OS requires robust, extensible compliance integrations (E-Way Bills, E-Invoices, GST returns) for Indian merchants. Previously, transactional business logic was split between Express and FastAPI, creating potential issues for credential security and data consistency.

## Decision
1. **FastAPI Backend System of Record**: All compliance schemas, event logs, credentials, and API connections are handled strictly in the FastAPI + Postgres backend. Express is confined to layout routing and UI proxies.
2. **Stateless Connectors**: External API adapters are implemented as pure, stateless connectors. They are prohibited from reading or writing to the database directly.
3. **Outbox Pattern Async Queue**: Compliance API submissions are decoupled from the main request threads. An outbox pattern guarantees that event registration and database commits occur in a single database transaction.
4. **Milestone Phasing**: To mitigate integration risks, the platform rollout is split into 5 distinct milestones. Milestone 1 establishes the local database, schemas, vault, and registry foundations, excluding all external HTTP connections.

## Consequences
* **Pros**:
  * Decouples retail sales transactions from government network downtime.
  * Ensures corporate API credentials are safe and encrypted with AES-256-GCM + dynamic keys.
  * Allows future integrations (e.g. PAN, MCA, UDYAM) to be plugged in as modular packages without modifying core application code.
* **Cons**:
  * Introduces minor database overhead for writing outbox tasks.
  * Requires routing traffic from Next.js through an Express-to-FastAPI proxy.
