"""NIC E-Way Bill API v1.03 transport and session encryption."""

from __future__ import annotations

import base64
import json
import os
from typing import Any, Mapping

import httpx
from cryptography.hazmat.primitives import hashes, padding
from cryptography.hazmat.primitives.asymmetric import padding as asymmetric_padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.serialization import load_pem_public_key

from app.compliance.connectors.ewaybill.payloads import build_action_request
from app.compliance.exceptions import ConfigurationException, PolicyViolationException
from app.core.config import settings


def _b64(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def _unb64(value: str) -> bytes:
    return base64.b64decode(value.encode("ascii"))


def _aes_ecb(data: bytes, key: bytes, encrypt: bool) -> bytes:
    if len(key) not in (16, 24, 32):
        raise ConfigurationException("SGIP-EWB-CFG-001: NIC AES key must be 16, 24, or 32 bytes.")
    if encrypt:
        padder = padding.PKCS7(algorithms.AES.block_size).padder()
        data = padder.update(data) + padder.finalize()
    cipher = Cipher(algorithms.AES(key), modes.ECB())
    context = cipher.encryptor() if encrypt else cipher.decryptor()
    result = context.update(data) + context.finalize()
    if not encrypt:
        unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
        result = unpadder.update(result) + unpadder.finalize()
    return result


class NICV103EWayBillClient:
    """Synchronous NIC v1.03 client used only when live mode is enabled."""

    def __init__(self) -> None:
        required = {
            "EWAYBILL_CLIENT_ID": settings.EWAYBILL_CLIENT_ID,
            "EWAYBILL_CLIENT_SECRET": settings.EWAYBILL_CLIENT_SECRET,
            "EWAYBILL_GSTIN": settings.EWAYBILL_GSTIN,
            "EWAYBILL_PUBLIC_KEY": settings.EWAYBILL_PUBLIC_KEY,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ConfigurationException(f"SGIP-EWB-CFG-002: Missing NIC configuration: {', '.join(missing)}")
        self.base_url = settings.EWAYBILL_BASE_URL.rstrip("/")
        self.client = httpx.Client(timeout=settings.EWAYBILL_TIMEOUT_SECONDS)
        self.public_key = load_pem_public_key(settings.EWAYBILL_PUBLIC_KEY.encode("utf-8"))
        self.sek: bytes | None = None

    def _encrypt_for_nic(self, payload: Mapping[str, Any], key: bytes) -> str:
        encoded = base64.b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        return _b64(_aes_ecb(encoded, key, encrypt=True))

    def _decrypt_from_nic(self, value: str, key: bytes) -> dict[str, Any]:
        decoded = _aes_ecb(_unb64(value), key, encrypt=False)
        return json.loads(base64.b64decode(decoded).decode("utf-8"))

    def _headers(self, gstin: str, token: str | None = None) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "client-id": settings.EWAYBILL_CLIENT_ID or "",
            "client-secret": settings.EWAYBILL_CLIENT_SECRET or "",
            "Gstin": gstin,
        }
        if token:
            headers["authtoken"] = token
        return headers

    def authenticate(self, credentials: dict[str, Any]) -> str:
        username = credentials.get("username") or settings.EWAYBILL_USERNAME
        password = credentials.get("password") or settings.EWAYBILL_PASSWORD
        if not username or not password:
            raise ConfigurationException("SGIP-EWB-CFG-003: NIC username and password are required.")
        app_key = os.urandom(16).hex()
        encrypted = self.public_key.encrypt(
            json.dumps({"action": "ACCESSTOKEN", "username": username, "password": password, "app_key": app_key}).encode("utf-8"),
            asymmetric_padding.PKCS1v15(),
        )
        response = self.client.post(
            f"{self.base_url}/auth/",
            headers=self._headers(settings.EWAYBILL_GSTIN or ""),
            json={"Data": _b64(encrypted)},
        )
        response.raise_for_status()
        body = response.json()
        if str(body.get("status")) != "1":
            raise PolicyViolationException(f"SGIP-EWB-AUTH-001: NIC authentication failed: {body}")
        self.sek = _aes_ecb(_unb64(body["sek"]), app_key.encode("utf-8"), encrypt=False)
        return body["authtoken"]

    def _call(self, action: str, payload: dict[str, Any], token: str) -> dict[str, Any]:
        if self.sek is None:
            raise PolicyViolationException("SGIP-EWB-AUTH-002: NIC session key is not initialized.")
        request = build_action_request(action, self._encrypt_for_nic(payload, self.sek))
        response = self.client.post(
            f"{self.base_url}/ewayapi/",
            headers=self._headers(settings.EWAYBILL_GSTIN or "", token),
            json=request,
        )
        response.raise_for_status()
        body = response.json()
        if str(body.get("status")) != "1":
            raise PolicyViolationException(f"SGIP-EWB-NIC-001: NIC rejected {action}: {body}")
        return self._decrypt_from_nic(body["data"], self.sek)

    def generate(self, payload: dict[str, Any], token: str) -> dict[str, Any]:
        result = self._call("GENEWAYBILL", payload, token)
        return {
            "status": "SUCCESS",
            "eway_bill_no": str(result["ewayBillNo"]),
            "eway_bill_date": result["ewayBillDate"],
            "valid_upto": result["validUpto"],
            "doc_no": payload["docNo"],
            "total_value": payload["totInvValue"],
            "trans_distance_km": int(payload["transDistance"]),
            "vehicle_no": payload.get("vehicleNo", ""),
            "transporter_id": payload.get("transporterId", ""),
            "status_code": "GEN",
        }

    def cancel(self, document_no: str, reason_code: int, remarks: str, token: str) -> dict[str, Any]:
        result = self._call(
            "CANEWB",
            {"ewbNo": int(document_no), "cancelRsnCode": reason_code, "cancelRmrk": remarks},
            token,
        )
        return {
            "status": "CANCELLED",
            "eway_bill_no": str(result["ewayBillNo"]),
            "cancel_date": result["cancelDate"],
            "status_code": "CAN",
        }
