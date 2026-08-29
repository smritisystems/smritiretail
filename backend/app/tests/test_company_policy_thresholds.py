import uuid
from datetime import date

from sqlalchemy import select

from app.models.company_policy import CompanyPolicySetting, ComplianceThreshold
from app.models.tenant import Company


async def test_company_policy_and_thresholds_read_after_write(db_session):
    company = Company(id=f"CMP-{uuid.uuid4().hex[:8].upper()}", name="Alpha Retail")
    db_session.add(company)
    await db_session.flush()

    db_session.add_all(
        [
            CompanyPolicySetting(
                company_id=company.id,
                key="credit_limit_default",
                value="50000",
                updated_by="system",
            ),
            CompanyPolicySetting(
                company_id=company.id,
                key="commission_tier_config",
                value='{"SILVER":{"threshold":50001}}',
                updated_by="system",
            ),
        ]
    )

    existing_threshold = await db_session.execute(
        select(ComplianceThreshold).where(
            ComplianceThreshold.key == "EWAY_BILL_THRESHOLD_INR",
            ComplianceThreshold.effective_from == date(2021, 4, 1),
        )
    )
    if existing_threshold.scalar_one_or_none() is None:
        db_session.add(
            ComplianceThreshold(
                key="EWAY_BILL_THRESHOLD_INR",
                value="50000",
                effective_from=date(2021, 4, 1),
                source_reference="Rule 138 CGST Rules",
                updated_by="system",
            )
        )

    await db_session.commit()

    policy = await db_session.execute(
        select(CompanyPolicySetting.value).where(
            CompanyPolicySetting.company_id == company.id,
            CompanyPolicySetting.key == "credit_limit_default",
        )
    )
    assert policy.scalar_one() == "50000"

    threshold = await db_session.execute(
        select(ComplianceThreshold.value).where(
            ComplianceThreshold.key == "EWAY_BILL_THRESHOLD_INR",
            ComplianceThreshold.effective_from == date(2021, 4, 1),
        )
    )
    assert threshold.scalar_one() == "50000"


async def test_old_invoice_threshold_is_not_rewritten_by_later_effective_date(db_session):
    old_date = date(2021, 4, 15)
    new_date = date(2022, 1, 1)

    existing_old = await db_session.execute(
        select(ComplianceThreshold).where(
            ComplianceThreshold.key == "EWAY_BILL_THRESHOLD_INR",
            ComplianceThreshold.effective_from == date(2021, 4, 1),
        )
    )
    if existing_old.scalar_one_or_none() is None:
        db_session.add(
            ComplianceThreshold(
                key="EWAY_BILL_THRESHOLD_INR",
                value="50000",
                effective_from=date(2021, 4, 1),
                source_reference="Rule 138 CGST Rules",
                updated_by="system",
            )
        )

    existing_later = await db_session.execute(
        select(ComplianceThreshold).where(
            ComplianceThreshold.key == "EWAY_BILL_THRESHOLD_INR",
            ComplianceThreshold.effective_from == new_date,
        )
    )
    if existing_later.scalar_one_or_none() is None:
        db_session.add(
            ComplianceThreshold(
                key="EWAY_BILL_THRESHOLD_INR",
                value="75000",
                effective_from=new_date,
                source_reference="later amendment",
                updated_by="system",
            )
        )
    await db_session.commit()

    row = await db_session.execute(
        select(ComplianceThreshold.value)
        .where(
            ComplianceThreshold.key == "EWAY_BILL_THRESHOLD_INR",
            ComplianceThreshold.effective_from <= old_date,
        )
        .order_by(ComplianceThreshold.effective_from.desc())
        .limit(1)
    )
    assert row.scalar_one() == "50000"
