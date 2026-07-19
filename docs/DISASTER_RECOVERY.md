<!--
  Project         : SMRITI Retail OS
  Organization    : SmritiSys

  Founders
  • Pushpa Devi Jawahar Mallah
    Founder & Chairperson

  • Jawahar Ramkripal Mallah
    Founder, Chief Executive Officer (CEO) &
    Chief Systems Architect

  Email           : support@smritisys.com
  Website         : https://smritisys.com
  Other Domains   : smritibooks.com | erpnbook.com | aitdl.com

  Version         : 3.32.0
  Created         : 2026-07-19
  Modified         : 2026-07-19

  Copyright       : © SmritiSys. All Rights Reserved.
  License         : Proprietary Commercial Software
  Classification  : Internal
-->

# SMRITI Retail OS Disaster Recovery (DR) Plan

This document describes the disaster recovery architecture, recovery metrics, failover sequences, and business continuity strategies.

---

## 1. System Targets (RTO and RPO)

In the event of database corruption, data center outages, or server hardware failures, SMRITI targets:
* **Recovery Time Objective (RTO):** < 4 Hours (the absolute maximum acceptable downtime to restore POS service).
* **Recovery Point Objective (RPO):** < 1 Hour (maximum target transaction history loss).

---

## 2. Disaster Scenarios & Playbooks

### Scenario A: Local Database Server Hardware Outage
1. **Trigger:** Main DB connection timeout errors cascade across API logs.
2. **Action:**
   * Stop traffic routes on the proxy layer.
   * Failover to the hot-standby PostgreSQL mirror replica using Pgpool-II/Patroni.
   * Verify read-write capabilities on replica and update the backend `DATABASE_URL` environment parameter.
   * Restart API containers and resume client requests.

### Scenario B: Data Center Power/Cloud Provider Failure
1. **Trigger:** Regional network outage reported on primary cloud hosting provider.
2. **Action:**
   * Re-provision the infrastructure on the secondary cloud provider using Terraform configurations.
   * Pull the latest off-site daily database dump from secure S3/Blob storage.
   * Apply database schema updates and WAL archive logs to resolve transactions up to the latest hourly partition.
   * Point DNS routing records to the new regional IP address.
