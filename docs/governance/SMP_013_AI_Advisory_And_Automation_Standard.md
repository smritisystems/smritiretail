<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0 (SMP-013 Specification)
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Constitutional Governance Specification
-->

# SMP-013: AI Advisory & Automation Interface Standard

**Status:** APPROVED — Frozen Governance Specification (v1.0)  
**Parent Standard:** SMP-001 Modular Platform Specification  
**Associated Policy:** AOP-001 SMRITI AI Optionality Principle  
**Scope:** Layer 6 AI Subsystems, Advisory DTOs, Explainability, Provider Abstractions  

---

## 1. Overview & Purpose
SMP-013 defines the interface standards, explainability requirements, provider abstractions, and optionality rules for **SMRITI Retail OS AI & Automation Subsystems (Layer 6)**.

---

## 2. Fundamental Precept
> **"AI advises. The platform decides."**

AI services provide structured recommendations; core transactions execute deterministically regardless of AI enablement or availability.

---

## 3. Mandatory Structured Advisory DTO (`AdvisoryRecommendation`)

Every AI service recommendation must return a structured payload containing:
- `recommendation` — Primary suggested action/value.
- `confidence` — Numeric confidence score (0.0 to 1.0).
- `evidence` — Analytical factors supporting recommendation.
- `explanation` — Human-readable business language explanation.
- `alternatives` — Optional secondary recommendation choices.
- `model_version` — Model version identifier.
- `timestamp` — ISO 8601 generation timestamp.

---

## 4. Provider Abstraction
AI engines must implement `BaseAIProvider` allowing seamless fallback between:
- `LocalStatisticalProvider` (Zero-dependency statistical rules engine)
- `GeminiProvider` / `OpenAIProvider` (Cloud LLMs)
- `OfflineRulesProvider` (Deterministic rule-based fallback)
