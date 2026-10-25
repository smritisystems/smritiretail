from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..models.crm import Customer, CustomerGroup


WALK_IN_CUSTOMER_ID = "CUST-WALKIN"


@dataclass(frozen=True)
class CustomerDiscountPolicy:
    customer: Optional[Customer]
    group: Optional[CustomerGroup]
    max_discount_percent: Decimal
    can_receive_discount: bool
    contractual_discount_percent: Decimal = Decimal("0.00")


async def resolve_customer_discount_policy(
    session: AsyncSession,
    customer_id: Optional[str],
    company_id: str,
    branch_id: Optional[str],
) -> CustomerDiscountPolicy:
    """Resolve the customer and discount entitlement in the active tenant scope."""
    walkin_code = WALK_IN_CUSTOMER_ID
    if company_id:
        try:
            from .system_parameter import SystemParameterService
            walkin_param = await SystemParameterService.resolve_parameter(
                db=session,
                param_code="SMRITI.POS.WALKIN_CUSTOMER_CODE",
                company_id=company_id,
                branch_id=branch_id,
            )
            if walkin_param and walkin_param.effective_value:
                walkin_code = str(walkin_param.effective_value).strip()
        except Exception:
            walkin_code = WALK_IN_CUSTOMER_ID

    clean_cid = str(customer_id).strip().upper() if customer_id else ""
    if not customer_id or clean_cid in (WALK_IN_CUSTOMER_ID.upper(), walkin_code.upper()):
        return CustomerDiscountPolicy(None, None, Decimal("0.00"), False, Decimal("0.00"))

    branch_candidates = {branch_id, "MAIN", "BR-MAIN-001", "BR-001"} if branch_id in ("MAIN", "BR-MAIN-001", "BR-001") else {branch_id}
    stmt = select(Customer).where(
        Customer.id == customer_id,
        Customer.company_id == company_id,
        (Customer.branch_id.in_(branch_candidates)) | Customer.branch_id.is_(None),
        Customer.is_deleted == False,
    )
    customer = (await session.execute(stmt)).scalars().first()
    if not customer:
        raise HTTPException(
            status_code=404,
            detail=f"Customer '{customer_id}' not found in the active company and branch.",
        )

    group = None
    if customer.customer_group_id:
        group = (await session.execute(
            select(CustomerGroup).where(
                CustomerGroup.id == customer.customer_group_id,
                CustomerGroup.company_id == company_id,
                (CustomerGroup.branch_id == branch_id) | CustomerGroup.branch_id.is_(None),
                CustomerGroup.is_deleted == False,
            )
        )).scalars().first()

    # Check contractual customer policy factor (dealer_factor, retail_factor, selling_factor)
    contractual_disc = Decimal("0.00")
    try:
        from ..models.crm import CustomerPolicy
        pol_stmt = select(CustomerPolicy).where(
            CustomerPolicy.customer_id == customer.id,
            CustomerPolicy.is_deleted == False,
        )
        c_pol = (await session.execute(pol_stmt)).scalars().first()
        if c_pol and c_pol.dealer_factor is not None:
            df = Decimal(str(c_pol.dealer_factor))
            if Decimal("0.00") < df < Decimal("1.00"):
                contractual_disc = (Decimal("1.00") - df) * Decimal("100.00")
        elif c_pol and c_pol.retail_factor is not None:
            rf = Decimal(str(c_pol.retail_factor))
            if Decimal("0.00") < rf < Decimal("1.00"):
                contractual_disc = (Decimal("1.00") - rf) * Decimal("100.00")
        elif customer.selling_factor is not None:
            sf = Decimal(str(customer.selling_factor))
            if Decimal("0.00") < sf < Decimal("1.00"):
                contractual_disc = (Decimal("1.00") - sf) * Decimal("100.00")
    except Exception:
        pass

    max_disc = Decimal(str(group.max_discount_percent or "0.00")) if group else Decimal("0.00")
    can_disc = bool(group and group.can_receive_discount)
    if contractual_disc > 0:
        can_disc = True
        max_disc = max(max_disc, contractual_disc)

    return CustomerDiscountPolicy(
        customer=customer,
        group=group,
        max_discount_percent=max_disc,
        can_receive_discount=can_disc,
        contractual_discount_percent=contractual_disc,
    )


def validate_customer_discount_policy(
    policy: CustomerDiscountPolicy,
    discount_amount: Decimal,
    gross_amount: Decimal,
    authorized_discount_override: bool = False,
) -> None:
    """Reject discounts not explicitly granted by the customer's group policy or contractual policy."""
    if authorized_discount_override:
        return

    discount_amount = Decimal(str(discount_amount or "0.00"))
    gross_amount = Decimal(str(gross_amount or "0.00"))
    if discount_amount <= Decimal("0.00"):
        return

    if not policy.customer:
        return

    if not policy.can_receive_discount:
        raise HTTPException(
            status_code=400,
            detail="Customer group policy does not permit discounts.",
        )

    requested_percent = (discount_amount / gross_amount * Decimal("100.00")) if gross_amount > 0 else Decimal("100.00")
    effective_max = max(policy.max_discount_percent, policy.contractual_discount_percent)
    if requested_percent > effective_max:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Customer discount exceeds the policy limit of "
                f"{effective_max:.2f}% (requested {requested_percent:.2f}%)."
            ),
        )