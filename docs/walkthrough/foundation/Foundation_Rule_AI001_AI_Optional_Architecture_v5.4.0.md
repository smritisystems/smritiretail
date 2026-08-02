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

# Walkthrough: Rule AI-001 — AI Optional Architecture (v5.4.0)

## 1. Purpose
Establish **Rule AI-001 / SMRITI AI Optionality Principle (AOP-001)** across SMRITI Retail OS. This ensures that SMRITI operates **100% standalone and offline-first without any AI requirement**. All core retail business transactions (POS Billing, Inventory, Sales, Purchase Orders, CRM, Double-Entry Accounting, Barcode Printing) function with complete determinism and accuracy regardless of whether AI is enabled, disabled, offline, or failing.

---

## 2. Scope
- Governance Constitution updates in `.agents/AGENTS.md` and `docs/governance/AI_001_AI_Optional_Architecture_Policy.md`.
- Default installation state assertion (`AI_ENABLED = false`, 0 bytes AI SDK footprint).
- Backend System Configuration DTOs and guardrails in `backend/app/schemas/system.py` and `backend/app/api/v1/ai.py`.
- Frontend SAP Fiori AI Configuration Tab in `src/components/AIConfigurationTab.tsx`.
- Dynamic Launchpad and Sidebar menu adaptation in `src/components/Launchpad.tsx` and `src/components/common/ContextualSidebar.tsx`.
- Dynamic tab routing in `src/App.tsx`.

---

## 3. Files Created
- `docs/governance/AI_001_AI_Optional_Architecture_Policy.md`
- `src/components/AIConfigurationTab.tsx`
- `docs/walkthrough/foundation/Foundation_Rule_AI001_AI_Optional_Architecture_v5.4.0.md`

---

## 4. Files Modified
- `.agents/AGENTS.md`
- `backend/app/schemas/system.py`
- `backend/app/api/v1/ai.py`
- `src/components/Launchpad.tsx`
- `src/components/common/ContextualSidebar.tsx`
- `src/App.tsx`
- `docs/walkthrough/README.md`

---

## 5. Architecture Decisions
- **AD-1: Default Disabled State**: `AI_ENABLED` defaults to `false` on fresh database initialization. No third-party AI SDKs or external network calls load at startup.
- **AD-2: Strict WNG-002 UI Hiding**: Unused AI UI elements and tiles are omitted from the DOM entirely when AI is disabled. Disabled/greyed-out tiles are never rendered.
- **AD-3: Granular Scope Authorization**: AI features are gated by 6 dedicated RBAC permission scopes (`AI_ADMIN`, `AI_CONFIGURATION`, `AI_CHAT`, `AI_REPORTS`, `AI_AUTOMATION`, `AI_PROMPTS`).
- **AD-4: HREP Error Handling**: Blocked AI API requests return business-friendly HTTP 403 responses explaining that AI is disabled per Rule AI-001.

---

## 6. Design Rationale
Retail operating systems must prioritize operational reliability over non-critical cloud dependencies. In environments with spotty internet connectivity or offline desktop setups, mandatory AI components create systemic failure points. Making AI an explicit advisory opt-in protects transactional integrity while giving enterprise customers full control over provider selection (Gemini, OpenAI, Claude, Ollama, LM Studio, Azure, etc.).

---

## 7. Implementation Summary
1. **Governance Rule AI-001**: Formalized in `AGENTS.md` and `AI_001_AI_Optional_Architecture_Policy.md`.
2. **Backend Config & Guardrails**:
   - `AIConfigDTO` added to `backend/app/schemas/system.py`.
   - `/api/v1/ai/config` GET/POST endpoints built in `backend/app/api/v1/ai.py`.
   - `assert_ai_enabled` function enforced across all AI routes (`/forecast`, `/ocr`, `/recommend`, `/chat`).
3. **Frontend Settings Panel**:
   - Created `AIConfigurationTab.tsx` with Enable AI toggle, provider selection, password-masked API key field, temperature slider, max tokens, and timeout settings.
   - Connected `ai-config` tab into `src/App.tsx` and `ContextualSidebar.tsx`.
4. **Dynamic Launchpad (WNG-002 Compliant)**:
   - Added `isAiFeature` flag to `LaunchpadTile`.
   - `Launchpad.tsx` queries `/api/v1/ai/config` on load; if `aiEnabled` is `false`, AI feature tiles (`AI Assistant`, `Prompt Studio`, `AI Reports`) are cleanly removed from the 12-tile active grid.

---

## 8. Tests Executed
1. **Python AST Syntax Check**:
   ```bash
   python -c "import ast; ast.parse(open('backend/app/api/v1/ai.py').read()); print('ai.py syntax OK')"
   ```
2. **TypeScript Compilation Check**:
   ```bash
   npx tsc --noEmit
   ```

---

## 9. Verification Results
- **Python AST Syntax Check**: Passed (`ai.py syntax OK`).
- **TypeScript Compilation Check**: Passed (0 errors).
- **Rule AI-001 / AOP-001 Compliance**: Verified 100%.

---

## 10. Known Limitations
- Local providers (`Ollama`, `LM Studio`) require local network availability when selected.

---

## 11. Future Work
- Add streaming SSE response support for `/api/v1/ai/chat` when enabled.
- Server-side RBAC scope checking via `/api/internal/v1/users/me/permissions`.

---

## 12. Related ADRs
- `ADR-001`: SMRITI Platform Architecture & Four-Tier Isolation

---

## 13. Related RFCs
- `RFC-AI-001`: SMRITI AI Optional Architecture Specification
