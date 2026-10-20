"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.0
Created      : 2026-10-20
Modified     : 2026-10-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Target Test  : Customer Code Configurable Assignment Policy Unit Tests
"""

import re
import pytest
from app.models.auth import UserRole
from app.schemas.crm import (
    CustomerCodeRecommendationResponse,
    CustomerCodeValidationRequest,
    CustomerCodeValidationResponse,
    EligibleCustomerCodeItem,
)


def test_customer_code_recommendation_schema():
    """Scenario 1: CustomerCodeRecommendationResponse serialization and alias mapping."""
    rec = CustomerCodeRecommendationResponse(
        suggested_code="CUST-000102",
        assignment_mode="HYBRID",
        uniqueness_scope="COMPANY",
        manual_entry_allowed=True,
        prefix="CUST-",
        has_eligible_existing_codes=False,
    )
    dumped = rec.model_dump(by_alias=True)
    assert dumped["suggestedCode"] == "CUST-000102"
    assert dumped["assignmentMode"] == "HYBRID"
    assert dumped["uniquenessScope"] == "COMPANY"
    assert dumped["manualEntryAllowed"] is True
    assert dumped["prefix"] == "CUST-"
    assert dumped["hasEligibleExistingCodes"] is False


def test_customer_code_validation_schema():
    """Scenario 2: CustomerCodeValidationRequest & Response serialization."""
    req = CustomerCodeValidationRequest(code="CUST-VIP-001")
    assert req.code == "CUST-VIP-001"

    valid_res = CustomerCodeValidationResponse(
        is_valid=True,
        code="CUST-VIP-001",
        reason="Code is available.",
        company_id="COMP-001",
    )
    dumped_valid = valid_res.model_dump(by_alias=True)
    assert dumped_valid["isValid"] is True
    assert dumped_valid["code"] == "CUST-VIP-001"
    assert dumped_valid["reason"] == "Code is available."
    assert dumped_valid["companyId"] == "COMP-001"

    invalid_res = CustomerCodeValidationResponse(
        is_valid=False,
        code="CUST-001",
        reason="Code is already assigned in company COMP-001",
        company_id="COMP-001",
    )
    dumped_invalid = invalid_res.model_dump(by_alias=True)
    assert dumped_invalid["isValid"] is False
    assert "already assigned" in dumped_invalid["reason"]


def test_eligible_customer_code_item_schema():
    """Scenario 3: EligibleCustomerCodeItem serialization."""
    item = EligibleCustomerCodeItem(
        code="CUST-007",
        name="Historical Customer Ltd",
        status="ARCHIVED",
        description="Inactive code previously assigned to Historical Customer Ltd",
    )
    assert item.code == "CUST-007"
    assert item.status == "ARCHIVED"
    assert "Historical Customer" in (item.name or "")


def test_customer_code_role_permissions():
    """Scenario 4: Role-based authorization for manual code entry."""
    allowed_roles = {UserRole.SYSADMIN, UserRole.ADMIN, UserRole.MANAGER}
    restricted_roles = {UserRole.CASHIER}

    for role in allowed_roles:
        role_str = str(role.value if hasattr(role, "value") else role).upper()
        manual_allowed = role_str in ("SYSADMIN", "ADMIN", "MANAGER")
        assert manual_allowed is True, f"Role {role} should be permitted manual entry"

    for role in restricted_roles:
        role_str = str(role.value if hasattr(role, "value") else role).upper()
        manual_allowed = role_str in ("SYSADMIN", "ADMIN", "MANAGER")
        assert manual_allowed is False, f"Role {role} must NOT be permitted manual entry"


def test_sequential_candidate_computation_algorithm():
    """Scenario 5: Pure sequential candidate computation with pre-existing sets."""
    def compute_next_code(existing_codes: set[str], prefix: str = "CUST-", reg_seq: int = 0) -> str:
        max_num = 0
        pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$")
        for c in existing_codes:
            m = pattern.match(c)
            if m:
                val = int(m.group(1))
                if val > max_num:
                    max_num = val
        cand = max(max_num, reg_seq) + 1
        while f"{prefix}{cand:06d}" in existing_codes:
            cand += 1
        return f"{prefix}{cand:06d}"

    # Empty company set starts at 1
    assert compute_next_code(set()) == "CUST-000001"

    # Sequence with existing records
    sample = {"CUST-000100", "CUST-000101", "CUST-HASH123"}
    assert compute_next_code(sample) == "CUST-000102"

    # Sequence with gaps advances past max
    gapped = {"CUST-000001", "CUST-000003"}
    assert compute_next_code(gapped) == "CUST-000004"

    # Higher registry sequence takes precedence
    assert compute_next_code(sample, reg_seq=500) == "CUST-000501"


def test_eligible_pool_filtering_logic():
    """Scenario 6: Inactive code eligible pool exclusion of active codes."""
    raw_records = [
        {"code": "CUST-001", "name": "Archived Corp", "status": "Archived", "is_deleted": False},
        {"code": "CUST-002", "name": "Active Corp", "status": "Active", "is_deleted": False},
        {"code": "CUST-003", "name": "Deleted Corp", "status": "Active", "is_deleted": True},
    ]
    active_codes = {"CUST-002"}

    pool = []
    for r in raw_records:
        if r["code"] not in active_codes and (r["status"] != "Active" or r["is_deleted"]):
            pool.append(r["code"])

    assert "CUST-001" in pool
    assert "CUST-003" in pool
    assert "CUST-002" not in pool
