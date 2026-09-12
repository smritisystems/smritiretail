"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-01
Modified     : 2026-09-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Configuration-Driven Cohort Evaluator (Gate 9)
"""

import os
import hashlib
from typing import Optional, List, Dict, Any


class CohortEvaluator:
    """
    Configuration-Driven Dynamic Rollout Cohort Evaluator.
    Determines whether a given request / user context belongs to the active canonical read cohort.
    Does NOT hardcode any tenant ID; evaluates against dynamic environment/configuration rules.
    """

    @classmethod
    def get_cohort_config(cls) -> Dict[str, Any]:
        mode = os.getenv("CANONICAL_COHORT_MODE", "INTERNAL_TEST").upper()
        companies_str = os.getenv("CANONICAL_COHORT_COMPANIES", "COMP-001")
        roles_str = os.getenv("CANONICAL_COHORT_ROLES", "SYSADMIN,ADMIN,CATALOG_REVIEWER,MANAGER")
        users_str = os.getenv("CANONICAL_COHORT_USERS", "")
        percentage_str = os.getenv("CANONICAL_COHORT_PERCENTAGE", "0")

        return {
            "mode": mode,  # DISABLED, INTERNAL_TEST, PERCENTAGE_PILOT, GLOBAL_ACTIVE
            "companies": [c.strip() for c in companies_str.split(",") if c.strip()],
            "roles": [r.strip().upper() for r in roles_str.split(",") if r.strip()],
            "users": [u.strip() for u in users_str.split(",") if u.strip()],
            "percentage": int(percentage_str) if percentage_str.isdigit() else 0,
            "master_toggle": os.getenv("ENABLE_CANONICAL_READ_PRIMARY", "true").lower() == "true"
        }

    @classmethod
    def is_canonical_read_enabled(
        cls,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        user_id: Optional[str] = None,
        user_role: Optional[str] = None
    ) -> bool:
        cfg = cls.get_cohort_config()
        if not cfg["master_toggle"] or cfg["mode"] == "DISABLED":
            return False

        if cfg["mode"] == "GLOBAL_ACTIVE":
            return True

        if cfg["mode"] == "INTERNAL_TEST":
            # Stage 1: Explicit matching against configured test companies, roles, and users
            company_match = (company_id in cfg["companies"]) if cfg["companies"] else False
            role_match = (user_role.upper() in cfg["roles"]) if (user_role and cfg["roles"]) else False
            user_match = (user_id in cfg["users"]) if (user_id and cfg["users"]) else False

            # Matches if within allowed test companies AND (allowed role OR explicitly listed user)
            if company_match and (role_match or user_match or not cfg["roles"]):
                return True
            return False

        if cfg["mode"] == "PERCENTAGE_PILOT":
            if not company_id:
                return False
            # If explicit companies list is provided, filter by company
            if cfg["companies"] and company_id not in cfg["companies"]:
                return False
            # Deterministic hash-based percentage cohort assignment
            hash_input = f"{company_id}:{branch_id or ''}:{user_id or ''}".encode("utf-8")
            bucket = int(hashlib.sha256(hash_input).hexdigest()[:8], 16) % 100
            return bucket < cfg["percentage"]

        return False
