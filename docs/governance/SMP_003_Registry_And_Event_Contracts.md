<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : SMP-003 v1.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Constitutional Architecture Standard
-->

# SMP-003: Registry & Event Contracts Standard (v1.0)

## 1. 12 Core Registries
The `RegistryManager` coordinates 12 core registries while allowing dynamic custom registry extensions:
1. **Menu Registry**
2. **Route Registry**
3. **Worker Registry**
4. **Event Registry**
5. **Permission Registry**
6. **Migration Registry**
7. **Report Registry**
8. **Dashboard Registry**
9. **Search Registry**
10. **Configuration Registry**
11. **Settings Registry**
12. **Audit Registry**

## 2. Event Contract Standard
Event names must use dot-notation format: `Domain.Entity.Action:v1`.
- **Domain Events:** `Sales.Invoice.Posted:v1`, `Inventory.Stock.Adjusted:v1`, `Customer.Created:v1`.
- **System Events:** `System.Module.Enabled:v1`, `System.Module.Disabled:v1`, `System.Startup.Completed:v1`.
