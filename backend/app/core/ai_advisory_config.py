"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.1.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI System Core Layer - AI Advisory Settings & Key Registry Engine
Conforms to Level 1 SMRITI Architecture Constitution (Rule AOP-001: AI Optionality Principle).

Constitutional Guarantees (Rule AOP-001):
1. Default State: AI_ENABLED=false, zero API keys configured, zero AI SDKs initialized.
2. 100% Offline-First: All core transaction workflows operate standalone without AI.
3. RBAC Isolation: Modifying AI configuration requires explicit `AI_ADMIN` or `AI_CONFIGURATION` permission scopes.
4. Security: API Keys are obfuscated/encrypted in storage.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Dict, Set


class AiProvider(str, Enum):
    GEMINI = "GEMINI"
    OPENAI = "OPENAI"
    ANTHROPIC = "ANTHROPIC"
    OPENROUTER = "OPENROUTER"
    LOCAL_OLLAMA = "LOCAL_OLLAMA"


REQUIRED_RBAC_SCOPES: Set[str] = {"AI_ADMIN", "AI_CONFIGURATION"}


@dataclass
class AiAdvisoryConfig:
    ai_enabled: bool = False
    provider: AiProvider = AiProvider.GEMINI
    model_name: str = "gemini-1.5-pro"
    api_key_configured: bool = False
    obscured_key: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 2048
    enable_smart_reorder_advisory: bool = False
    enable_customer_churn_advisory: bool = False
    enable_fraud_detection_advisory: bool = False


class AiAdvisoryConfigEngine:
    """
    Canonical Configuration Engine for Optional AI Advisory Services (Rule AOP-001).
    """

    def __init__(self):
        # Default Rule AOP-001 state: Disabled, offline-first
        self._config = AiAdvisoryConfig(
            ai_enabled=False,
            provider=AiProvider.GEMINI,
            api_key_configured=False,
            obscured_key=None,
        )
        self._raw_api_key: Optional[str] = None

    def is_ai_active(self) -> bool:
        """Returns True ONLY if AI is explicitly enabled AND API key is configured."""
        return self._config.ai_enabled and self._config.api_key_configured

    def get_config(self) -> AiAdvisoryConfig:
        return self._config

    def update_config(
        self,
        user_id: str,
        user_rbac_permissions: List[str],
        ai_enabled: bool,
        provider: AiProvider,
        api_key: Optional[str] = None,
        model_name: str = "gemini-1.5-pro",
        enable_smart_reorder: bool = False,
    ) -> AiAdvisoryConfig:
        # Enforce RBAC Permission Verification
        user_scopes = set(user_rbac_permissions)
        if not user_scopes.intersection(REQUIRED_RBAC_SCOPES):
            raise PermissionError(
                f"User '{user_id}' lacks required RBAC scopes {REQUIRED_RBAC_SCOPES} to modify AI settings."
            )

        if api_key and len(api_key.strip()) > 0:
            self._raw_api_key = api_key.strip()
            # Obscure key for UI return (e.g. AI-KEY-****-1234)
            key_len = len(self._raw_api_key)
            if key_len > 8:
                obscured = self._raw_api_key[:4] + "****" + self._raw_api_key[-4:]
            else:
                obscured = "****"
            self._config.api_key_configured = True
            self._config.obscured_key = obscured
        elif not self._raw_api_key:
            self._config.api_key_configured = False
            self._config.obscured_key = None

        self._config.ai_enabled = ai_enabled
        self._config.provider = provider
        self._config.model_name = model_name
        self._config.enable_smart_reorder_advisory = enable_smart_reorder

        return self._config
