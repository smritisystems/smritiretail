"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.13.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI Indian Compliance Core Layer (ICCL) - Compliance Rate Registry

Replaces hard-coded TCS/TDS/GST rate values from v4.12 with a versioned,
configuration-driven compliance rate registry.

Design Principles:
- Every rate entry carries an effective_date and optional end_date.
- The registry is queried by (rule_type, effective_for_date) to get the
  applicable rate for a given financial year.
- Override via environment variable SMRITI_COMPLIANCE_RATES_JSON to inject
  a JSON-file path for custom rate tables (e.g. after budget amendments).
- Falls back to embedded defaults when no override is present.

Rate types supported:
  GST_SLAB          : Valid GST rate slabs (0, 0.1, 0.25, 3, 5, 12, 18, 28)
  TCS_RATE          : Tax Collected at Source rate (Sec 206C 1H)
  TCS_TURNOVER_THRESHOLD : Seller annual turnover threshold for TCS applicability
  TCS_PER_BUYER_THRESHOLD: Per-buyer cumulative purchase threshold for TCS
  TDS_RATE          : Tax Deducted at Source rate (Sec 194Q)
  TDS_PURCHASE_THRESHOLD : Buyer cumulative purchase threshold for TDS
  GST_LATE_INTEREST : GSTR-3B late payment interest rate per annum
  GST_LATE_FEE_DAILY: GSTR-3B late filing fee per day (non-NIL return)
  GST_LATE_FEE_NIL  : GSTR-3B late filing fee per day (NIL return)
  UPI_MAX_TXN_LIMIT : UPI per-transaction amount limit (NPCI)
  MSME_PAYMENT_DAYS : Maximum days for MSME payment (MSMED Act)
  MSME_INTEREST_FACTOR: Compound interest rate multiplier (3x bank rate)
"""

import json
import os
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Optional


@dataclass
class ComplianceRateEntry:
    rule_type: str           # e.g. "TCS_RATE", "TDS_PURCHASE_THRESHOLD"
    value: Decimal           # The actual rate or threshold value
    effective_date: date     # When this rate became effective
    end_date: Optional[date] # None = currently in effect
    fy_label: str            # e.g. "FY2025-26"
    authority: str           # e.g. "CBDT Notification 37/2024"
    description: str         # Human-readable description
    unit: str                # "percent", "rupees", "days", "multiplier"


# ---------------------------------------------------------------------------
# Embedded Default Rate Table
# Source: Finance Act 2025, GST Council notifications, NPCI guidelines
# Last updated: FY 2025-26
# ---------------------------------------------------------------------------

_DEFAULT_RATE_TABLE: list[ComplianceRateEntry] = [

    # -----------------------------------------------------------------------
    # GST Valid Rate Slabs
    # -----------------------------------------------------------------------
    ComplianceRateEntry("GST_SLAB", Decimal("0"),    date(2017, 7, 1), None, "FY2017+", "GST Council", "NIL GST rate slab", "percent"),
    ComplianceRateEntry("GST_SLAB", Decimal("0.1"),  date(2020, 1, 1), None, "FY2020+", "GST Council Notification 02/2020", "0.1% GST slab (TCS special)", "percent"),
    ComplianceRateEntry("GST_SLAB", Decimal("0.25"), date(2017, 7, 1), None, "FY2017+", "GST Council", "0.25% GST slab (diamonds/rough gems)", "percent"),
    ComplianceRateEntry("GST_SLAB", Decimal("3"),    date(2017, 7, 1), None, "FY2017+", "GST Council", "3% GST slab (gold, silver, precious metals)", "percent"),
    ComplianceRateEntry("GST_SLAB", Decimal("5"),    date(2017, 7, 1), None, "FY2017+", "GST Council", "5% GST standard slab", "percent"),
    ComplianceRateEntry("GST_SLAB", Decimal("12"),   date(2017, 7, 1), None, "FY2017+", "GST Council", "12% GST standard slab", "percent"),
    ComplianceRateEntry("GST_SLAB", Decimal("18"),   date(2017, 7, 1), None, "FY2017+", "GST Council", "18% GST standard slab", "percent"),
    ComplianceRateEntry("GST_SLAB", Decimal("28"),   date(2017, 7, 1), None, "FY2017+", "GST Council", "28% GST peak slab (luxury/demerit goods)", "percent"),

    # -----------------------------------------------------------------------
    # TCS - Section 206C(1H) Income Tax Act
    # -----------------------------------------------------------------------
    ComplianceRateEntry(
        "TCS_RATE", Decimal("0.001"),
        date(2020, 10, 1), None,
        "FY2020+",
        "CBDT Circular 17/2020 - Section 206C(1H)",
        "TCS rate: 0.1% on sale consideration above Rs 50L per buyer (seller turnover > Rs 10Cr)",
        "percent",
    ),
    ComplianceRateEntry(
        "TCS_TURNOVER_THRESHOLD", Decimal("10_00_00_000"),
        date(2020, 10, 1), None,
        "FY2020+",
        "Finance Act 2020 - Section 206C(1H)",
        "TCS applicability: seller annual turnover must exceed Rs 10 Crore in previous FY",
        "rupees",
    ),
    ComplianceRateEntry(
        "TCS_PER_BUYER_THRESHOLD", Decimal("50_00_000"),
        date(2020, 10, 1), None,
        "FY2020+",
        "Finance Act 2020 - Section 206C(1H)",
        "TCS collection threshold: cumulative purchases from single buyer exceeds Rs 50 Lakh per FY",
        "rupees",
    ),

    # -----------------------------------------------------------------------
    # TDS - Section 194Q Income Tax Act
    # -----------------------------------------------------------------------
    ComplianceRateEntry(
        "TDS_RATE", Decimal("0.001"),
        date(2021, 7, 1), None,
        "FY2021+",
        "Finance Act 2021 - Section 194Q",
        "TDS rate: 0.1% on purchase consideration above Rs 50L per seller (buyer purchases > Rs 50L)",
        "percent",
    ),
    ComplianceRateEntry(
        "TDS_PURCHASE_THRESHOLD", Decimal("50_00_000"),
        date(2021, 7, 1), None,
        "FY2021+",
        "Finance Act 2021 - Section 194Q",
        "TDS applicability: buyer cumulative purchases from single seller exceeds Rs 50 Lakh per FY",
        "rupees",
    ),

    # -----------------------------------------------------------------------
    # GST Late Payment Interest - CGST Act Section 50
    # -----------------------------------------------------------------------
    ComplianceRateEntry(
        "GST_LATE_INTEREST_NORMAL", Decimal("18"),
        date(2017, 7, 1), None,
        "FY2017+",
        "CGST Act Section 50(1)",
        "GST late payment interest: 18% per annum on net tax liability (GSTR-3B delay)",
        "percent_per_annum",
    ),
    ComplianceRateEntry(
        "GST_LATE_INTEREST_ITC_FRAUD", Decimal("24"),
        date(2017, 7, 1), None,
        "FY2017+",
        "CGST Act Section 50(3)",
        "GST late interest for wrongful ITC availment or utilisation: 24% per annum",
        "percent_per_annum",
    ),

    # -----------------------------------------------------------------------
    # GST Late Filing Fee - CGST Act Section 47
    # -----------------------------------------------------------------------
    ComplianceRateEntry(
        "GST_LATE_FEE_DAILY", Decimal("50"),
        date(2017, 7, 1), None,
        "FY2017+",
        "CGST Act Section 47 + SGST Act Section 47",
        "GST late filing fee: Rs 50/day (Rs 25 CGST + Rs 25 SGST) for non-NIL returns",
        "rupees_per_day",
    ),
    ComplianceRateEntry(
        "GST_LATE_FEE_NIL_DAILY", Decimal("20"),
        date(2020, 6, 1), None,
        "FY2020+",
        "CGST Act Section 47 - amended by Finance Act 2020",
        "GST late filing fee: Rs 20/day (Rs 10 CGST + Rs 10 SGST) for NIL returns",
        "rupees_per_day",
    ),
    ComplianceRateEntry(
        "GST_LATE_FEE_MAX_PER_RETURN", Decimal("10000"),
        date(2023, 4, 1), None,
        "FY2023+",
        "CGST Act Section 47 - GST Council 49th meeting cap",
        "GST late filing fee maximum cap per return: Rs 10,000 (Rs 5000 CGST + Rs 5000 SGST)",
        "rupees",
    ),

    # -----------------------------------------------------------------------
    # UPI Transaction Limit - NPCI
    # -----------------------------------------------------------------------
    ComplianceRateEntry(
        "UPI_MAX_TXN_LIMIT", Decimal("1_00_000"),
        date(2024, 1, 1), None,
        "FY2024+",
        "NPCI UPI Circular - Standard per-transaction limit",
        "UPI maximum per-transaction limit: Rs 1,00,000. Higher limits for specific categories (capital markets, healthcare, IPO: Rs 5L)",
        "rupees",
    ),
    ComplianceRateEntry(
        "UPI_MAX_TXN_LIMIT_PREMIUM", Decimal("5_00_000"),
        date(2024, 1, 1), None,
        "FY2024+",
        "NPCI UPI Circular - Premium categories",
        "UPI maximum limit for capital markets, healthcare, IPO, education, insurance: Rs 5,00,000",
        "rupees",
    ),

    # -----------------------------------------------------------------------
    # MSME Payment Compliance - MSMED Act 2006
    # -----------------------------------------------------------------------
    ComplianceRateEntry(
        "MSME_PAYMENT_DAYS_WITH_AGREEMENT", Decimal("45"),
        date(2006, 10, 2), None,
        "FY2007+",
        "MSMED Act 2006 Section 15",
        "MSME payment deadline with written agreement: maximum 45 days from acceptance",
        "days",
    ),
    ComplianceRateEntry(
        "MSME_PAYMENT_DAYS_WITHOUT_AGREEMENT", Decimal("15"),
        date(2006, 10, 2), None,
        "FY2007+",
        "MSMED Act 2006 Section 15",
        "MSME payment deadline without written agreement: 15 days from delivery",
        "days",
    ),
    ComplianceRateEntry(
        "MSME_INTEREST_FACTOR", Decimal("3"),
        date(2006, 10, 2), None,
        "FY2007+",
        "MSMED Act 2006 Section 16",
        "MSME delayed payment interest: 3 times RBI bank rate (monthly compounding)",
        "multiplier",
    ),
]


class ComplianceRateRegistry:
    """
    Versioned compliance rate registry.
    Loads from embedded defaults + optional override JSON file.
    Thread-safe for read operations (no mutable state post-init).
    """

    def __init__(self) -> None:
        self._entries: list[ComplianceRateEntry] = list(_DEFAULT_RATE_TABLE)
        self._load_overrides()

    def _load_overrides(self) -> None:
        """Load custom rate overrides from SMRITI_COMPLIANCE_RATES_JSON env var if set."""
        override_path = os.environ.get("SMRITI_COMPLIANCE_RATES_JSON")
        if not override_path:
            return
        try:
            with open(override_path, encoding="utf-8") as f:
                raw: list[dict] = json.load(f)
            for entry in raw:
                self._entries.append(ComplianceRateEntry(
                    rule_type=entry["rule_type"],
                    value=Decimal(str(entry["value"])),
                    effective_date=date.fromisoformat(entry["effective_date"]),
                    end_date=date.fromisoformat(entry["end_date"]) if entry.get("end_date") else None,
                    fy_label=entry.get("fy_label", "custom"),
                    authority=entry.get("authority", "Custom Override"),
                    description=entry.get("description", ""),
                    unit=entry.get("unit", ""),
                ))
        except (OSError, json.JSONDecodeError, KeyError, ValueError) as exc:
            # Log but do not crash — fall back to embedded defaults
            import logging
            logging.getLogger(__name__).warning(
                "SMRITI_COMPLIANCE_RATES_JSON override failed: %s. Using embedded defaults.", exc
            )

    def get_rate(
        self,
        rule_type: str,
        as_of_date: Optional[date] = None,
    ) -> Optional[ComplianceRateEntry]:
        """
        Get the most recently effective rate entry for a given rule_type.
        Returns the entry with the latest effective_date that is <= as_of_date.
        """
        target_date = as_of_date or date.today()
        candidates = [
            e for e in self._entries
            if e.rule_type == rule_type
            and e.effective_date <= target_date
            and (e.end_date is None or e.end_date >= target_date)
        ]
        if not candidates:
            return None
        return max(candidates, key=lambda e: e.effective_date)

    def get_value(
        self,
        rule_type: str,
        as_of_date: Optional[date] = None,
        default: Optional[Decimal] = None,
    ) -> Decimal:
        """
        Convenience method: return just the Decimal value for a rule_type.
        Returns `default` if no matching entry is found.
        """
        entry = self.get_rate(rule_type, as_of_date)
        if entry is None:
            if default is not None:
                return default
            raise KeyError(
                f"No compliance rate found for rule_type='{rule_type}' "
                f"as of {as_of_date or date.today()}. "
                "Check the registry or set SMRITI_COMPLIANCE_RATES_JSON."
            )
        return entry.value

    def get_all_gst_slabs(self, as_of_date: Optional[date] = None) -> set[Decimal]:
        """Return the set of valid GST rate slabs as of a given date."""
        target_date = as_of_date or date.today()
        return {
            e.value for e in self._entries
            if e.rule_type == "GST_SLAB"
            and e.effective_date <= target_date
            and (e.end_date is None or e.end_date >= target_date)
        }

    def list_rules(self) -> list[str]:
        """Return all distinct rule_type keys in the registry."""
        return sorted({e.rule_type for e in self._entries})

    def get_history(self, rule_type: str) -> list[ComplianceRateEntry]:
        """Return all historical entries for a given rule_type, sorted by date."""
        return sorted(
            [e for e in self._entries if e.rule_type == rule_type],
            key=lambda e: e.effective_date,
        )


# Module-level singleton — import and use directly
_registry: Optional[ComplianceRateRegistry] = None


def get_compliance_registry() -> ComplianceRateRegistry:
    """Return the module-level singleton registry instance."""
    global _registry
    if _registry is None:
        _registry = ComplianceRateRegistry()
    return _registry
