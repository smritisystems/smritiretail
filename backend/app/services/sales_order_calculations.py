from decimal import Decimal


CENT = Decimal("0.01")
ONE_HUNDRED = Decimal("100.00")


def calculate_sales_order_line_amounts(
    quantity: Decimal,
    price: Decimal,
    discount_percent: Decimal,
    discount_amount: Decimal,
    tax_rate: Decimal,
) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    gross_amount = (quantity * price).quantize(CENT)
    if discount_percent > Decimal("0.00"):
        resolved_discount = (gross_amount * discount_percent / ONE_HUNDRED).quantize(CENT)
    else:
        resolved_discount = discount_amount

    if resolved_discount > gross_amount:
        raise ValueError("Discount cannot exceed the line value.")

    taxable_value = gross_amount - resolved_discount
    tax_amount = (taxable_value * tax_rate / ONE_HUNDRED).quantize(CENT)
    total_amount = taxable_value + tax_amount
    return resolved_discount, taxable_value, tax_amount, total_amount
