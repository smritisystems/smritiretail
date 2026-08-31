"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Reporting & BI Engine — Report Registry Service Layer.
Enforces Invariants 1, 2, 3, 4, and 7:
- Validates all requests against central registry
- Enforces Governed Metric Dictionary formula contracts
- Resolves Shoper 9 aliases without polluting core domain models
- Constructs forensic Execution Identity Envelopes
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status

from ..schemas.report_registry import (
    ReportRegistryEntry,
    StudioType,
    ExecutionEnvelope,
    LegacyAliasResolutionResponse,
    ReportCatalogResponse,
)
from ..db.seed_reports_registry import CANONICAL_REPORT_REGISTRY
from ..core.metric_dictionary import GovernedMetricDictionary


class ReportRegistryService:
    """Service for managing, resolving, and validating report contracts."""

    @classmethod
    def get_report(cls, report_id: str) -> ReportRegistryEntry:
        """Fetch report contract by unique identifier."""
        report = CANONICAL_REPORT_REGISTRY.get(report_id)
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report contract '{report_id}' not found in registry."
            )
        return report

    @classmethod
    def list_reports(
        cls,
        studio: Optional[StudioType] = None,
        role: Optional[str] = None
    ) -> List[ReportRegistryEntry]:
        """List reports filtered optionally by studio or authorized role."""
        results = list(CANONICAL_REPORT_REGISTRY.values())
        if studio:
            results = [r for r in results if r.studio == studio]
        if role:
            role_upper = role.upper()
            if role_upper in ["SYSADMIN", "ADMIN", "CEO", "SUPERADMIN"]:
                pass  # Full access
            elif role_upper in ["MANAGER", "STORE_MANAGER"]:
                results = [
                    r for r in results
                    if any(ar.upper() in ["STORE_MANAGER", "MANAGER", "ADMIN", "ACCOUNTANT", "MERCHANDISER", "CASHIER"] for ar in r.allowed_roles)
                ]
            else:
                results = [r for r in results if role_upper in [ar.upper() for ar in r.allowed_roles]]
        return results

    @classmethod
    def resolve_legacy_alias(cls, query_code: str) -> LegacyAliasResolutionResponse:
        """
        Resolve a legacy Shoper 9 jump-code (e.g., '411', '412', 'SR202000', 'SR236300')
        to its canonical modern SMRITI report contract.
        """
        clean_query = query_code.strip().upper()
        # Normalize and strip natural query prefixes
        for prefix in ["MNUNO", "MNU NO", "MNU", "MENU", "CODE", "REPORT", "RPT"]:
            if clean_query.startswith(prefix):
                candidate = clean_query[len(prefix):].strip()
                if candidate:
                    clean_query = candidate
                break
        
        for report in CANONICAL_REPORT_REGISTRY.values():
            # Match directly against shoper_aliases
            aliases_upper = [a.upper() for a in report.shoper_aliases]
            if clean_query in aliases_upper:
                return LegacyAliasResolutionResponse(
                    query_code=query_code,
                    matched_report_id=report.report_id,
                    matched_report_name=report.name,
                    studio=report.studio,
                    is_matched=True,
                )
            
            # Also match direct report_id (e.g. 'RPT-SAL-001' or 'sal-001')
            if clean_query == report.report_id.upper() or clean_query in report.report_id.upper():
                return LegacyAliasResolutionResponse(
                    query_code=query_code,
                    matched_report_id=report.report_id,
                    matched_report_name=report.name,
                    studio=report.studio,
                    is_matched=True,
                )

        return LegacyAliasResolutionResponse(
            query_code=query_code,
            is_matched=False
        )

    @classmethod
    def get_all_shoper_aliases(cls) -> Dict[str, str]:
        """Returns flat mapping of all legacy Shoper jump-codes to canonical report IDs."""
        mapping: Dict[str, str] = {}
        for report in CANONICAL_REPORT_REGISTRY.values():
            for alias in report.shoper_aliases:
                mapping[alias] = report.report_id
        return mapping

    @classmethod
    def validate_execution_request(
        cls,
        report_id: str,
        user_role: str,
        requested_dimensions: Optional[List[str]] = None,
        requested_measures: Optional[List[str]] = None,
    ) -> ReportRegistryEntry:
        """
        Validates RBAC and ensures requested measures/dimensions are legally defined
        in both the Report Registry and the Governed Metric Dictionary.
        """
        report = cls.get_report(report_id)

        # 1. RBAC Check
        role_upper = user_role.upper()
        allowed_upper = [r.upper() for r in report.allowed_roles]
        if role_upper not in allowed_upper and role_upper not in ["ADMIN", "CEO", "SUPERADMIN", "SYSADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user_role}' is not authorized to execute report '{report_id}'."
            )

        # 2. Measures Validation via Governed Metric Dictionary
        if requested_measures:
            for m in requested_measures:
                if m not in report.measures:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Measure '{m}' is not permitted in report '{report_id}'."
                    )
                # Verify metric exists in Governed Metric Dictionary
                GovernedMetricDictionary.get_metric(m)

        # 3. Dimensions Validation
        if requested_dimensions:
            for d in requested_dimensions:
                if d not in report.dimensions:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Dimension '{d}' is not supported in report '{report_id}'."
                    )

        return report

    @classmethod
    def build_execution_envelope(
        cls,
        report_id: str,
        executed_by_user: str,
        executed_by_role: str,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        data_as_of: Optional[datetime] = None,
        filters_applied: Optional[Dict[str, Any]] = None,
    ) -> ExecutionEnvelope:
        """
        Generates the canonical 5-Vector forensic execution envelope.
        """
        report = cls.get_report(report_id)
        now_utc = datetime.now(timezone.utc)
        as_of = data_as_of or now_utc

        return ExecutionEnvelope(
            execution_id=f"EXEC-{uuid.uuid4().hex[:12].upper()}",
            report_id=report.report_id,
            report_name=report.name,
            studio=report.studio,
            contract_version=report.contract_version,
            metric_version=report.metric_version,
            schema_version=report.schema_version,
            security_policy_version=report.security_policy_version,
            data_as_of=as_of,
            executed_at=now_utc,
            executed_by_user=executed_by_user,
            executed_by_role=executed_by_role,
            company_id=company_id,
            branch_id=branch_id,
            audit_trace_id=f"AUD-{uuid.uuid4().hex[:16].upper()}",
            filters_applied=filters_applied or {},
        )
