<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Version      : 3.18.0
  Created      : 2026-07-17
  Modified     : 2026-07-17
  Copyright    : © SMRITIBooks.com and SMRITI Retail OS. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# SMRITI Platform Microservices Roadmap

**Status:** Target architecture for a long-lived, cross-domain SMRITI Platform.

## Vision

SMRITI Retail OS is evolving into a modular platform capable of supporting Retail, Pharma, Restaurant, Manufacturing, Distribution, School, Hospital, and other verticals. The long-term architecture should be service-oriented, not a single monolith, but also not dozens of tiny services from day one.

## Target Architecture

```
                 SMRITI API Gateway
                        │
 ───────────────────────────────────────────────────────
                        │
        Authentication & Identity Service
                        │
 ───────────────────────────────────────────────────────
                        │
        Service Discovery / Message Bus
                        │
────────────────────────────────────────────────────────

 License Service

 Device Management Service

 Configuration Service

 Customer Service

 Supplier Service

 Item Master Service

 Inventory Service

 Warehouse Service

 Purchase Service

 Sales Service

 POS Service

 Pricing Service

 Cost Service

 Tax (GST) Service

 Accounting Service

 Payment Service

 Modern Trade Service

 Reporting Service

 Print Service

 Barcode Service

 Notification Service

 AI Service

 Integration Service

 Audit Service
```

## Each Service Owns Its Data

Every service should own:

- API surface
- database schema
- business logic
- event contracts
- tests and documentation

Example service structure:

```
Inventory Service
├── API
├── Database
├── Business Rules
├── Events
└── Tests
```

```
Sales Service
├── API
├── Database
├── Business Rules
├── Events
└── Tests
```

## Communication

Use a hybrid communication model:

- REST / HTTP for synchronous domain APIs
- RabbitMQ (or comparable message bus) for asynchronous events
- Redis for cache, distributed locks, and shared configuration

Example event flow:

```
Sales Invoice Created
        │
        ▼
Inventory Service

reduces stock

        │
        ▼
Accounting Service

creates accounting entry

        │
        ▼
Notification Service

sends WhatsApp/email

        │
        ▼
Reporting Service

updates dashboard
```

Key rule: no service writes directly into another service's database.

## Database Strategy

Each service owns its schema and persistence layer.

Examples:

```
Inventory DB

stock
warehouse
batch
serial
```

```
Sales DB

invoice
invoice_items
customer_credit
```

```
Accounting DB

ledger
voucher
payments
```

This avoids tight coupling, enables independent scaling, and keeps service boundaries clear.

## Suggested Open-Source Stack

### Gateway

- FastAPI Gateway

### Backend

- Python
- FastAPI

### ORM

- SQLAlchemy 2.x

### Database

- PostgreSQL

### Cache

- Redis

### Event Bus

- RabbitMQ

### Background Jobs

- Celery

### Frontend

- React
- TypeScript
- Tailwind CSS

### Reports

- ReportLab
- openpyxl

### Barcode

- python-barcode
- qrcode
- python-escpos

### Object Storage

- MinIO

### Containers

- Docker
- Kubernetes (for larger deployments)

## Recommended Service Groups

### Platform Services

- Identity
- Licensing
- Device Management
- Configuration
- Workflow
- Audit

### Business Services

- Customer
- Supplier
- Item Master
- Inventory
- Warehouse
- Purchase
- Sales
- POS
- Pricing
- Cost
- GST / Tax
- Accounting
- Payment
- Modern Trade

### Infrastructure Services

- Print
- Barcode
- Reports
- Notification
- Integration
- AI

## Implementation Approach

Start with a manageable set of core services and split further only when the operational benefit is clear.

### Phase 1: Core Platform and Domain Services

Focus the first phase on the services that deliver the most business value and establish a strong platform foundation. This avoids premature fragmentation while enabling independent evolution.

- Identity / Authentication
- Licensing
- Configuration / Audit
- Inventory
- Sales / POS
- Purchase
- Accounting
- Reporting
- Integration
- AI

#### Phase 1 Migration Guidance

- Migrate one service domain at a time, starting with services that have the smallest external dependencies.
- Keep API contracts stable during migration by providing compatibility aliases or a gateway translation layer.
- Use a strangler pattern to incrementally replace legacy endpoints and preserve application continuity.
- Use shared events for cross-service communication instead of direct database access.
- Preserve existing frontend behavior while incrementally switching clients to the new service endpoints.
- Continuously validate each service with smoke tests and integration tests.

### Phase 2: Domain Expansion and Refinement

- Add Customer and Supplier domain services
- Add Pricing, Cost, Tax, and Warehouse services
- Add Print, Barcode, Notification, and external Integration services
- Migrate service-specific data into owned schemas

### Phase 3: Verticalization

- Reuse core services across new verticals: Pharma, Restaurant, Manufacturing, Distribution, School, Hospital
- Add vertical-specific services only where required
- Keep identity, audit, reporting, and integration shared platform services

## Why This Fits SMRITI

- Deploy only the services you need
- Scale inventory independently from reporting
- Update AI without touching POS
- Reuse core services across new verticals
- Enable third-party developers to build new services via APIs

## Practical Guidance

- Do not start with 25 separate deployments. Begin with 8–10 core services.
- Keep service boundaries large enough to reduce operational complexity.
- Use a strangler pattern to migrate the current hybrid architecture gradually.
- Maintain a strong gateway and event bus to coordinate the platform.

## Recommended first-phase services

1. Identity / Auth
2. Licensing / Device / Config
3. Inventory
4. Sales / POS
5. Purchase
6. Accounting
7. Reporting
8. Integration / Notification
9. AI
10. Audit

This provides a strong foundation without premature fragmentation.
