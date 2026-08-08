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

# ADR-010: Backup Governance, Point-In-Time Recovery, & Business Continuity

**Status:** APPROVED — v1.0 (2026-07-28)  
**Deciders:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## Context
Retail store transactions must survive hardware crashes, database corruption, ransomware threats, and cloud outages.

---

## Decision
1. **Automated Backups**: Daily full database dumps (`pg_dump`) + WAL archiving for Point-In-Time Recovery (PITR).
2. **Offline-First Synchronization**: POS terminals buffer offline checkouts locally in IndexedDB / local transaction queue and push to Platform API upon reconnect.
3. **Disaster Recovery Drills**: Quarterly recovery verification testing RTO < 1 hour and RPO < 5 minutes.

---

## Consequences
- **Positive**: Guaranteed retail business continuity even during complete internet or server failures.
- **Negative**: Requires dedicated storage for WAL archives and backup snapshots.
