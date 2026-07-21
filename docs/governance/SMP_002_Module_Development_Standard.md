<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : SMP-002 v1.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Constitutional Architecture Standard
-->

# SMP-002: Module Development Standard & Public Contract (v1.0)

## 1. Package Structure Standard
Every module conforming to SMP-001 must adhere to this directory layout:
```text
modules/<module_id>/
├── module.json
├── bootstrap.py
├── api/
├── ui/
├── services/
├── events/
├── workers/
├── reports/
├── dashboards/
├── search/
├── configuration/
├── settings/
├── permissions/
├── migrations/
├── tests/
├── docs/
└── assets/
```

## 2. Public Abstract Contract (`SmritiModule`)
```python
from abc import ABC, abstractmethod
from typing import Dict, Any

class SmritiModule(ABC):
    @abstractmethod
    async def install(self, context: Any) -> None: pass
    
    @abstractmethod
    async def uninstall(self, context: Any) -> None: pass

    @abstractmethod
    async def enable(self, context: Any) -> None: pass

    @abstractmethod
    async def disable(self, context: Any) -> None: pass

    @abstractmethod
    async def upgrade(self, context: Any, from_version: str) -> None: pass

    @abstractmethod
    async def health(self, context: Any) -> Dict[str, Any]: pass

    @abstractmethod
    def register(self, registry_manager: Any) -> None: pass
```
