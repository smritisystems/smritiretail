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


async def resolve_customer_discount_policy(
    session: AsyncSession,
    customer_id: Optional[str],
    company_id: str,
    branch_id: Optional[str],
) -> CustomerDiscountPolicy:
    """Resolve the customer and discount entitlement in the active tenant scope."""
    if not customer_id or customer_id == WALK_IN_CUSTOMER_ID:
        return CustomerDiscountPolicy(None, None, Decimal("0.00"), False)

    stmt = select(Customer).where(
        Customer.id == customer_id,
        Customer.company_id == company_id,
        (Customer.branch_id == branch_id) | Customer.branch_id.is_(None),
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

    return CustomerDiscountPolicy(
        customer=customer,
        group=group,
        max_discount_percent=Decimal(str(group.max_discount_percent or "0.00")) if group else Decimal("0.00"),
        can_receive_discount=bool(group and group.can_receive_discount),
    )


def validate_customer_discount_policy(
    policy: CustomerDiscountPolicy,
    discount_amount: Decimal,
    gross_amount: Decimal,
) -> None:
    """Reject discounts not explicitly granted by the customer's group policy."""
    discount_amount = Decimal(str(discount_amount or "0.00"))
    gross_amount = Decimal(str(gross_amount or "0.00"))
    if discount_amount <= Decimal("0.00"):
        return

    if not policy.customer:
        return

    if not policy.group or not policy.can_receive_discount:
        raise HTTPException(
            status_code=400,
            detail="Customer group policy does not permit discounts.",
        )

    requested_percent = (discount_amount / gross_amount * Decimal("100.00")) if gross_amount > 0 else Decimal("100.00")
    if requested_percent > policy.max_discount_percent:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Customer discount exceeds the group limit of "
                f"{policy.max_discount_percent:.2f}% (requested {requested_percent:.2f}%)."
            ),
        )