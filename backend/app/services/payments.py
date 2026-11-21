"""Card payments (Stripe Checkout) and crypto payments (NOWPayments invoices), plus webhook checks."""
from __future__ import annotations

import hashlib
import hmac
import json
import math
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

from ..config import Settings
from .http import HttpClient, IntegrationError


class PaymentError(Exception):
    pass


class SignatureError(Exception):
    pass


@dataclass
class Checkout:
    provider: str
    provider_ref: str
    redirect_url: str


# --- Stripe --------------------------------------------------------------------------------------

def stripe_checkout(
    settings: Settings, http: HttpClient, *, amount_cents: int, currency: str, description: str, transaction_id: int,
    customer_email: str, success_url: str, cancel_url: str,
) -> Checkout:
    form = {
        "mode": "payment",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": str(transaction_id),
        "customer_email": customer_email,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": currency.lower(),
        "line_items[0][price_data][unit_amount]": str(amount_cents),
        "line_items[0][price_data][product_data][name]": description,
        "metadata[transaction_id]": str(transaction_id),
        "payment_intent_data[metadata][transaction_id]": str(transaction_id),
    }
    try:
        res = http.request(
            "POST",
            "https://api.stripe.com/v1/checkout/sessions",
            headers={
                "Authorization": f"Bearer {settings.stripe_secret_key}",
                "Content-Type": "application/x-www-form-urlencoded",
                "Idempotency-Key": f"bolt-tx-{transaction_id}",
            },
            body=urlencode(form).encode(),
        )
    except IntegrationError as exc:
        raise PaymentError("card payments are temporarily unavailable") from exc
    data = res.json()
    if not res.ok or not data.get("url"):
        message = ((data or {}).get("error") or {}).get("message", f"HTTP {res.status}")
        raise PaymentError(f"Stripe rejected the checkout: {message}")
    return Checkout("stripe", str(data["id"]), str(data["url"]))


def stripe_verify(secret: str, payload: bytes, header: str, *, tolerance: int = 300, now: float | None = None) -> dict[str, Any]:
    timestamp = ""
    signatures: list[str] = []
    for item in header.split(","):
        key, _, value = item.strip().partition("=")
        if key == "t":
            timestamp = value
        elif key == "v1":
            signatures.append(value)
    if not timestamp or not signatures:
        raise SignatureError("missing Stripe signature")
    expected = hmac.new(secret.encode(), f"{timestamp}.".encode() + payload, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, s) for s in signatures):
        raise SignatureError("bad Stripe signature")
    if abs((now if now is not None else time.time()) - int(timestamp)) > tolerance:
        raise SignatureError("Stripe signature too old")
    return json.loads(payload)


def stripe_sign(secret: str, payload: bytes, timestamp: int | None = None) -> str:
    """Builds a Stripe-Signature header (used by tests and local webhook replays)."""
    ts = int(timestamp if timestamp is not None else time.time())
    sig = hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={ts},v1={sig}"


# --- NOWPayments ------------------------------------------------------------------------------------

def _np_base(settings: Settings) -> str:
    return "https://api-sandbox.nowpayments.io/v1" if settings.nowpayments_sandbox else "https://api.nowpayments.io/v1"


def nowpayments_invoice(
    settings: Settings, http: HttpClient, *, amount_cents: int, currency: str, description: str, transaction_id: int,
    success_url: str, cancel_url: str,
) -> Checkout:
    payload = {
        "price_amount": round(amount_cents / 100, 2),
        "price_currency": currency.lower(),
        "order_id": str(transaction_id),
        "order_description": description,
        "ipn_callback_url": f"{settings.public_api_url}/api/v1/webhooks/nowpayments",
        "success_url": success_url,
        "cancel_url": cancel_url,
    }
    try:
        res = http.post_json(f"{_np_base(settings)}/invoice", payload, headers={"x-api-key": settings.nowpayments_api_key})
    except IntegrationError as exc:
        raise PaymentError("crypto payments are temporarily unavailable") from exc
    data = res.json()
    if not res.ok or not data.get("invoice_url"):
        raise PaymentError(f"NOWPayments rejected the invoice: {(data or {}).get('message', f'HTTP {res.status}')}")
    return Checkout("nowpayments", str(data["id"]), str(data["invoice_url"]))


def _js_number(value: float) -> str:
    """Format a float the way JavaScript's JSON.stringify does."""
    if value.is_integer() and abs(value) < 1e21:
        return str(int(value))
    text = repr(value)
    if "e" in text:
        mantissa, exp = text.split("e")
        sign = "-" if exp.startswith("-") else "+"
        text = f"{mantissa}e{sign}{exp.lstrip('+-').lstrip('0') or '0'}"
    return text


def _canonical_js(value: Any) -> str:
    if isinstance(value, dict):
        return "{" + ",".join(f"{json.dumps(k, ensure_ascii=False)}:{_canonical_js(value[k])}" for k in sorted(value)) + "}"
    if isinstance(value, list):
        return "[" + ",".join(_canonical_js(v) for v in value) + "]"
    if isinstance(value, bool) or value is None:
        return json.dumps(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            return "null"
        return _js_number(value)
    if isinstance(value, int):
        return str(value)
    return json.dumps(value, ensure_ascii=False)


def nowpayments_verify(secret: str, payload: bytes, signature: str) -> dict[str, Any]:
    if not signature:
        raise SignatureError("missing NOWPayments signature")
    data = json.loads(payload)
    candidates = {_canonical_js(data), json.dumps(data, sort_keys=True, separators=(",", ":"))}
    for text in candidates:
        expected = hmac.new(secret.encode(), text.encode(), hashlib.sha512).hexdigest()
        if hmac.compare_digest(expected, signature.strip().lower()):
            return data
    raise SignatureError("bad NOWPayments signature")


def nowpayments_sign(secret: str, data: dict[str, Any]) -> str:
    return hmac.new(secret.encode(), _canonical_js(data).encode(), hashlib.sha512).hexdigest()
