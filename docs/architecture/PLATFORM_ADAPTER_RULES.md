<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 2.1.1
  * Created    : 2026-07-10
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Platform Adapter Rules (SPAR)

**Status:** ASPIRATIONAL / TARGET FUTURE ARCHITECTURE (Under Research & Development)

> [!NOTE]
> **Scope & Prototype Notice:** This document outlines the long-term target architecture for the production system and is not active in this v2.1.2 standalone prototype. It represents a planned migration target for the SMRITI Platform Abstraction Layer (PAL).

This document defines the conceptual implementation mapping between the **SMRITI Platform Abstraction Layer (PAL)** and the underlying framework. Only adapter implementations may access the framework directly. All business services must remain framework-independent.

## Long-Term Target Architecture

* **Target Architecture:** Modular Microservices Platform
* **Roadmap:** [PLATFORM_MICROSERVICES_ROADMAP.md](./PLATFORM_MICROSERVICES_ROADMAP.md)

This file currently documents the adapter rules for the existing hybrid platform. The roadmap describes the future transition toward a modular microservices architecture.

---

## 1. Current Platform Adapter Stack
* **Application Backend:** FastAPI + Python 3.11
* **Underlying Database:** PostgreSQL (via SQLAlchemy 2.x + Alembic)
* **Underlying Cache:** In-memory (Redis roadmap)
* **Client UI Runtime:** React 18 / TypeScript / Tailwind CSS

---

## 2. Python Platform Adapter Mapping

All direct calls to the underlying framework APIs are strictly prohibited in business logic services, studios, APIs, or data models. They are allowed ONLY within the platform adapter implementation (`core/platform/`).

### Forbidden — bypassing the PAL in business services:
```python
# VIOLATION: Do not call the database, ORM, or cache layer directly
# from any business service, studio, or API module.
# All access must route through smriti.documents, smriti.db, smriti.cache, etc.
```

### Approved PAL wrappers (SMRITI Platform Abstraction Layer):
All business service code must utilize the SMRITI PAL interface:
```python
from smriti_retail_os import smriti

# CORRECT PATTERN:
customer = smriti.documents.get("Customer", name)
value    = smriti.db.get("Customer", name, "credit_limit")
data     = smriti.cache.get_or_set("key", lambda: build_data(), ttl=300)
smriti.events.publish("smriti:stock_update", {"item": item_code})
smriti.jobs.enqueue("smriti_retail_os.services.sync.run", company=company)
smriti.errors.raise_validation("Field Required", "Please fill in all required fields.")
smriti.permissions.require("Customer", "read")
```

---

## 3. Client JavaScript Platform Adapter Mapping

Client applications must communicate with server-side endpoints exclusively using the SMRITI JavaScript SDK. Direct framework-specific requests or message publishers are forbidden outside the SDK.

### Forbidden — bypassing the SMRITI SDK in client code:
```javascript
// VIOLATION: Do not make direct backend calls or use low-level platform APIs
// outside the SMRITI JavaScript SDK. All API communication must
// route through smriti.api.*, smriti.notify.*, smriti.navigation.*, etc.
```

### Approved SMRITI JavaScript SDK usages:
```javascript
// CORRECT PATTERN:
smriti.api.call("smriti_retail_os.module.method", { arg })
  .then(data => smriti.notify.success("Done", "Action completed."))
  .catch(err => smriti.notify.error("Failed", err.message));

smriti.navigation.go(smriti.navigation.routes.customers);
smriti.dialog.confirm("Delete?", "This cannot be undone.", () => doDelete());
smriti.events.on("smriti:stock_update", data => refreshDisplay(data));
```

---

## 4. Platform Model Configuration

To add a new business concept, map it inside `smriti_retail_os/core/platform/document_map.yaml`:
```yaml
MyModel:
  platform: "Platform DocType Name"
  description: "What this model represents"
```

The registry will automatically resolve the mapping through the **SMRITI Platform Abstraction Layer (PAL)**.

---

## 5. Service Extensions
All domain business services must extend `BaseService` from `smriti_retail_os.core.services` to inherit standard validation and security controls:
```python
from smriti_retail_os.core.services import BaseService
from smriti_retail_os import smriti

class MyService(BaseService):
    MODEL = "MyModel"

    def do_something(self, name: str):
        self._require_read()   # Raises PermissionError if not allowed
        self._validate_required({"Name": name})
        doc = smriti.documents.get(self.MODEL, name)
        # Business logic here
        return doc.as_dict()
```
