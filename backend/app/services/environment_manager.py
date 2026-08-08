"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : Environment Isolation & Database Profile Manager (PROD-003 & PROD-004 Compliant)
Author       : Jawahar Ramkripal Mallah
Copyright    : © SMRITIBooks.com. All Rights Reserved.
Version      : 4.0.0
"""

from typing import List, Dict, Any, Optional
from datetime import datetime


class EnvironmentProfile:
    def __init__(
        self,
        id: str,
        database_name: str,
        environment_type: str,  # PRODUCTION, DEMO, TRAINING, TEST, DEVELOPMENT
        is_demo: bool,
        company_count: int = 1,
        version: str = "4.0.0",
        status: str = "INSTALLED",  # INSTALLED, NOT_INSTALLED, ACTIVE
        created_by: str = "SYSTEM_INSTALLER"
    ):
        self.id = id
        self.database_name = database_name
        self.environment_type = environment_type
        self.is_demo = is_demo
        self.company_count = company_count
        self.version = version
        self.status = status
        self.created_by = created_by
        self.created_on = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "database_name": self.database_name,
            "environment_type": self.environment_type,
            "is_demo": self.is_demo,
            "company_count": self.company_count,
            "version": self.version,
            "status": self.status,
            "created_by": self.created_by,
            "created_on": self.created_on
        }


class EnvironmentManager:
    """
    Manages isolated database environments: smriti_prod, smriti_demo, smriti_training, smriti_test, smriti_dev
    Enforces Rule PROD-003 & PROD-004 Environment Isolation Standards.
    """

    KNOWN_ENVIRONMENTS: Dict[str, Dict[str, Any]] = {
        "PRODUCTION": {
            "database_name": "smriti_prod",
            "is_demo": False,
            "description": "Clean production database. Contains zero business records on first setup.",
            "recommended": True
        },
        "DEMO": {
            "database_name": "smriti_demo",
            "is_demo": True,
            "description": "Isolated demo database loaded with sample retail catalog & sales history.",
            "recommended": False
        },
        "TRAINING": {
            "database_name": "smriti_training",
            "is_demo": False,
            "description": "Isolated staff training database for safe workflow practice.",
            "recommended": False
        },
        "TEST": {
            "database_name": "smriti_test",
            "is_demo": False,
            "description": "Isolated automated test database.",
            "recommended": False
        },
        "DEVELOPMENT": {
            "database_name": "smriti_dev",
            "is_demo": False,
            "description": "Isolated developer extension database.",
            "recommended": False
        }
    }

    @classmethod
    def get_active_profile(cls) -> EnvironmentProfile:
        # Default active profile is clean PRODUCTION per Rule PROD-003
        return EnvironmentProfile(
            id="db-prof-prod",
            database_name="smriti_prod",
            environment_type="PRODUCTION",
            is_demo=False,
            company_count=1,
            version="4.0.0",
            status="ACTIVE",
            created_by="SYSTEM_INSTALLER"
        )

    @classmethod
    def list_environments(cls) -> List[Dict[str, Any]]:
        active = cls.get_active_profile()
        res = []
        for env_type, meta in cls.KNOWN_ENVIRONMENTS.items():
            is_active = env_type == active.environment_type
            res.append({
                "environment_type": env_type,
                "database_name": meta["database_name"],
                "is_demo": meta["is_demo"],
                "description": meta["description"],
                "status": "ACTIVE" if is_active else ("INSTALLED" if env_type in ["PRODUCTION", "DEMO"] else "NOT_INSTALLED"),
                "is_active": is_active,
                "recommended": meta["recommended"]
            })
        return res


environment_manager = EnvironmentManager()
