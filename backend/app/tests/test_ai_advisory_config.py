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

import pytest
from app.core.ai_advisory_config import (
    AiAdvisoryConfigEngine,
    AiProvider,
)

def test_rule_aop001_default_ai_disabled():
    engine = AiAdvisoryConfigEngine()
    config = engine.get_config()

    # Rule AOP-001 assertion: Disabled by default
    assert config.ai_enabled is False
    assert config.api_key_configured is False
    assert engine.is_ai_active() is False

def test_ai_config_rbac_permission_enforcement():
    engine = AiAdvisoryConfigEngine()

    # User without AI_ADMIN permission should be blocked
    with pytest.raises(PermissionError, match="lacks required RBAC scopes"):
        engine.update_config(
            user_id="USR-OPERATOR",
            user_rbac_permissions=["POS_OPERATOR", "SALES_VIEW"],
            ai_enabled=True,
            provider=AiProvider.GEMINI,
            api_key="AIzaSyA1234567890",
        )

def test_valid_admin_ai_activation():
    engine = AiAdvisoryConfigEngine()

    config = engine.update_config(
        user_id="USR-ADMIN",
        user_rbac_permissions=["AI_ADMIN"],
        ai_enabled=True,
        provider=AiProvider.GEMINI,
        api_key="AIzaSyA1234567890",
        enable_smart_reorder=True,
    )

    assert config.ai_enabled is True
    assert config.api_key_configured is True
    assert config.obscured_key == "AIza****7890"
    assert engine.is_ai_active() is True
