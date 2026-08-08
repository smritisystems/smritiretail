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

# SMRITI Platform Services Architecture

## Purpose

SMRITI Retail OS shall expose a unified platform services layer for cross-cutting enterprise capabilities so that business modules do not reimplement common functionality.

## Core Principle

Business modules shall not implement cross-cutting platform capabilities independently. Capabilities such as workspace persistence, attachments, audit, notifications, workflow, search, export, offline synchronization, and AI integration must be consumed exclusively through the SMRITI Platform Services APIs.

## Platform Services

- Workspace Persistence
- Attachment Framework
- Audit & Activity Framework
- Notification Framework
- Search & Saved Search Framework
- Workflow & Approval Framework
- Export & Print Framework
- Offline & Synchronization Framework
- Event & Automation Framework
- AI Services

## Architectural Rule

Every ERP module including Sales, Purchase, Inventory, Finance, CRM, HR, POS, and Reports shall consume these capabilities through the platform services layer.
