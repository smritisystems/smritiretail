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

# AI-001: SMRITI AI Optional Architecture & Governance Policy

**Policy ID:** AI-001 / AOP-001  
**Status:** FROZEN — LEVEL 1 SMRITI ARCHITECTURE CONSTITUTION  
**Author:** Jawahar Ramkripal Mallah  
**Designation:** Chief Systems Architect & Creator  
**Copyright:** © SMRITIBooks.com. All Rights Reserved.  
**Effective:** 2026-07-28  

---

## 1. Objective & Core Mandate
> **AI is Optional. Business Operations are Mandatory.**

SMRITI Retail OS must operate **100% standalone and offline-first without AI**. Every core business function—including Point of Sale (POS), Sales & Invoicing, Procurement & Purchase Orders, Inventory & Product SKUs, Customer CRM, Double-Entry Accounting, Reporting, and Barcode Label Printing—must execute with 100% correctness, availability, and performance regardless of whether an AI service is configured, disabled, failing, or offline.

---

## 2. Default Installation State
On a fresh installation of SMRITI Retail OS:

```text
AI Engine
─────────────────────────────────────────────
Status       : Disabled (AI_ENABLED = false)
Provider     : None
API Key      : Not Configured
SDK Footprint: Zero (0 bytes initialized)
UI Elements  : Completely Hidden
API Endpoint : Blocked (HTTP 403 / 400)
```

No AI SDKs or third-party artificial intelligence dependencies shall load unless AI is explicitly enabled by an authorized administrator.

---

## 3. Settings Navigation & Configuration
1. **Navigation Flow**:
   `Settings` ──► `Integrations` / `AI Configuration`
2. **Access Control**:
   Visible strictly to users possessing `AI_ADMIN` or `AI_CONFIGURATION` permission scopes.
3. **Configuration Schema**:
   * **Enable AI Features** (`boolean`, default: `false`)
   * **AI Provider** (`enum`: `OpenAI`, `Google Gemini`, `Anthropic Claude`, `Ollama (Local)`, `LM Studio`, `Azure OpenAI`, `OpenRouter`, `Custom API`)
   * **API Key** (`string`, password-masked)
   * **Default Model** (`string`, e.g. `gemini-1.5-flash`, `gpt-4o`, `llama3`)
   * **Temperature** (`float`, default: `0.3`)
   * **Max Tokens** (`integer`, default: `4096`)
   * **Timeout** (`integer` seconds, default: `30`)

---

## 4. UI Hiding & Dynamic Launchpad Adaptation (WNG-002 Compliant)
* **Disabled Mode (Default)**:
  - Zero AI buttons, zero AI Assistant triggers, zero AI chat interfaces across all screens.
  - Launchpad renders ONLY standard retail operational tiles.
* **Enabled Mode**:
  - Dynamic AI Launchpad tiles (`AI Assistant`, `Prompt Studio`, `AI Reports`) are conditionally injected based on configuration state and user permissions.
  - Max 12 tile rendering cap enforced per WNG-002.

---

## 5. Granular RBAC Permission Model
```text
AI_ADMIN         : Full control over AI configuration and keys
AI_CONFIGURATION : Permission to read/edit AI settings
AI_CHAT          : Permission to use AI Assistant & Chat
AI_REPORTS       : Permission to view AI insights & reports
AI_AUTOMATION    : Permission to run AI automated suggestions
AI_PROMPTS       : Permission to access Prompt Studio & templates
```

---

## 6. API Safety & Error Handling (HREP Compliant)
All backend `/api/v1/ai/*` endpoints MUST verify `AI_ENABLED == true`. If disabled, requests return:
```json
{
  "title": "AI Service Disabled",
  "explanation": "SMRITI AI Advisory Engine is currently disabled by System Administrator per Rule AI-001.",
  "suggested_action": "Enable AI under Settings -> AI Configuration or contact your System Administrator.",
  "reference_id": "SMRITI-AI-001"
}
```
