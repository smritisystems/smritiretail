"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.14.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI Indian Compliance Core Layer (ICCL) - Unified Payment Aggregator / PG Gateway

Defines standard interfaces and mock drivers for Indian Payment Gateways:
- UPIGatewayInterface: Standard method structures for POS payments.
- RazorpayGateway: Driver for Razorpay QR/Intent payments.
- PaytmGateway: Driver for Paytm QR/Intent payments.
- CashfreeGateway: Driver for Cashfree QR/Intent payments.

Standard UPI URI Schema (as per NPCI specifications):
upi://pay?pa={vpa}&pn={name}&tr={txn_id}&am={amount}&cu=INR
"""

import hmac
import hashlib
from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Dict, Any, Optional
from urllib.parse import quote

# Pure logic helper
class UPIGatewayInterface(ABC):
    """
    Standard interface for all UPI/PG gateway providers in SMRITI.
    """

    @abstractmethod
    def generate_dynamic_qr_string(
        self,
        merchant_vpa: str,
        merchant_name: str,
        transaction_id: str,
        amount: Decimal,
    ) -> str:
        """
        Generate a raw UPI protocol string for dynamic QR code rendering.
        """
        pass

    @abstractmethod
    def create_payment_request(
        self,
        transaction_id: str,
        amount: Decimal,
        customer_phone: str,
        purpose_note: str = "POS Purchase",
    ) -> Dict[str, Any]:
        """
        Initiate a payment request (e.g. UPI Collect or gateway order creation).
        """
        pass

    @abstractmethod
    def verify_webhook_signature(
        self,
        payload_body: bytes,
        signature: str,
        secret: str,
    ) -> bool:
        """
        Verify the authenticity of a payment status callback webhook from the provider.
        """
        pass


class BaseMockGateway(UPIGatewayInterface):
    """
    Base helper providing common NPCI UPI URI generation.
    """

    def generate_dynamic_qr_string(
        self,
        merchant_vpa: str,
        merchant_name: str,
        transaction_id: str,
        amount: Decimal,
    ) -> str:
        """
        Builds standard NPCI-compliant upi:// protocol URL.
        """
        escaped_name = quote(merchant_name)
        return (
            f"upi://pay?pa={merchant_vpa}"
            f"&pn={escaped_name}"
            f"&tr={transaction_id}"
            f"&am={amount:.2f}"
            f"&cu=INR"
        )


class RazorpayGateway(BaseMockGateway):
    """
    Razorpay integration driver (Mock).
    """

    def create_payment_request(
        self,
        transaction_id: str,
        amount: Decimal,
        customer_phone: str,
        purpose_note: str = "POS Purchase",
    ) -> Dict[str, Any]:
        # Razorpay expects amounts in paise (1 INR = 100 paise)
        amount_paise = int(amount * Decimal("100"))
        
        # Mock order generation response
        return {
            "gateway": "RAZORPAY",
            "order_id": f"order_rzp_{transaction_id}",
            "amount": amount_paise,
            "currency": "INR",
            "receipt": transaction_id,
            "status": "created",
            "notes": {
                "phone": customer_phone,
                "note": purpose_note
            }
        }

    def verify_webhook_signature(
        self,
        payload_body: bytes,
        signature: str,
        secret: str,
    ) -> bool:
        """
        Razorpay signature verification: HMAC-SHA256 of payload using webhook secret.
        """
        if not signature or not secret:
            return False
        expected = hmac.new(
            secret.encode("utf-8"),
            payload_body,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)


class PaytmGateway(BaseMockGateway):
    """
    Paytm integration driver (Mock).
    """

    def create_payment_request(
        self,
        transaction_id: str,
        amount: Decimal,
        customer_phone: str,
        purpose_note: str = "POS Purchase",
    ) -> Dict[str, Any]:
        return {
            "gateway": "PAYTM",
            "txnToken": f"token_paytm_{transaction_id}",
            "orderId": transaction_id,
            "amount": f"{amount:.2f}",
            "currency": "INR",
            "mid": "SMRITI_PAYTM_MID_1029",
            "status": "SUCCESS"
        }

    def verify_webhook_signature(
        self,
        payload_body: bytes,
        signature: str,
        secret: str,
    ) -> bool:
        """
        Paytm signature verification placeholder (mocks check digit comparison).
        """
        if not signature or not secret:
            return False
        # Simplified hash verification for mock
        expected = hashlib.sha256(payload_body + secret.encode("utf-8")).hexdigest()
        return expected == signature


class CashfreeGateway(BaseMockGateway):
    """
    Cashfree integration driver (Mock).
    """

    def create_payment_request(
        self,
        transaction_id: str,
        amount: Decimal,
        customer_phone: str,
        purpose_note: str = "POS Purchase",
    ) -> Dict[str, Any]:
        return {
            "gateway": "CASHFREE",
            "cf_order_id": f"cf_order_{transaction_id}",
            "order_id": transaction_id,
            "order_amount": float(amount),
            "order_status": "ACTIVE",
            "payment_link": f"https://link.cashfree.com/mock/{transaction_id}"
        }

    def verify_webhook_signature(
        self,
        payload_body: bytes,
        signature: str,
        secret: str,
    ) -> bool:
        """
        Cashfree signature verification using standard HMAC-SHA256.
        """
        if not signature or not secret:
            return False
        expected = hmac.new(
            secret.encode("utf-8"),
            payload_body,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
