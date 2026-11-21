"""Signed callbacks from Stripe, NOWPayments and Sumsub. Each event is processed at most once."""
from __future__ import annotations

import logging
from typing import Any

from ..db import Json, UniqueViolation, utcnow
from ..services import emails
from ..services.container import Services, audit
from ..services.domain import payment_failed, payment_succeeded
from ..services.kyc import KycError, sumsub_verify, user_id_from_external
from ..services.payments import SignatureError, nowpayments_verify, stripe_verify
from ..web import Api, ApiError, Ctx

api = Api("/api/v1", tags=("webhooks",))
log = logging.getLogger("bolt.webhooks")


def bad_signature() -> ApiError:
    return ApiError(400, "BAD_SIGNATURE", "Signature check failed.", "فشل التحقق من التوقيع.")


def first_delivery(services: Services, provider: str, event_id: str, event_type: str, payload: dict[str, Any]) -> bool:
    try:
        with services.db.tx() as c:
            c.insert("webhook_events", {"provider": provider, "event_id": event_id[:200], "event_type": event_type[:100], "payload": Json(payload), "created_at": utcnow()})
        return True
    except UniqueViolation:
        return False


def mark_processed(services: Services, provider: str, event_id: str, error: str | None = None) -> None:
    with services.db.tx() as c:
        c.exec("UPDATE webhook_events SET processed_at = :now, error = :err WHERE provider = :p AND event_id = :e",
               now=utcnow(), err=error, p=provider, e=event_id[:200])


def find_tx(services: Services, provider: str, provider_ref: str | None, tx_id: Any) -> dict[str, Any] | None:
    with services.db.tx() as c:
        if provider_ref:
            row = c.one("SELECT * FROM transactions WHERE provider = :p AND provider_ref = :r", p=provider, r=str(provider_ref))
            if row:
                return row
        if tx_id is not None and str(tx_id).isdigit():
            row = c.get("transactions", int(str(tx_id)))
            if row and row["provider"] == provider:
                return row
    return None


def flag(services: Services, tx_id: int, note: str) -> None:
    with services.db.tx() as c:
        c.update("transactions", tx_id, {"status": "processing", "admin_note": note[:500], "updated_at": utcnow()})
        services.notify_staff(c, emails.staff_notice("Payment needs review", [f"Transaction #{tx_id}", note], services.admin_link(f"/transactions/{tx_id}")))


@api.post("/webhooks/stripe", auth="public", hidden=True, max_body=512 * 1024)
def stripe_webhook(ctx: Ctx) -> dict[str, Any]:
    s = ctx.settings
    if not s.stripe_enabled:
        raise ApiError(404, "NOT_FOUND", "Not found.", "غير موجود.")
    try:
        event = stripe_verify(s.stripe_webhook_secret, ctx.raw, ctx.request.headers.get("stripe-signature", ""))
    except (SignatureError, ValueError) as exc:
        raise bad_signature() from exc
    event_id, event_type = str(event.get("id", "")), str(event.get("type", ""))
    if not first_delivery(ctx.services, "stripe", event_id, event_type, event):
        return {"received": True, "duplicate": True}
    session = (event.get("data") or {}).get("object") or {}
    tx = find_tx(ctx.services, "stripe", session.get("id"), (session.get("metadata") or {}).get("transaction_id") or session.get("client_reference_id"))
    if tx is None:
        mark_processed(ctx.services, "stripe", event_id, "unknown checkout session")
        return {"received": True}
    if event_type in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        if session.get("payment_status") == "paid" or event_type.endswith("succeeded"):
            amount, currency = session.get("amount_total"), str(session.get("currency", "")).upper()
            if amount is not None and (int(amount) != tx["amount_cents"] or currency != tx["currency"].upper()):
                flag(ctx.services, tx["id"], f"Stripe amount {amount} {currency} does not match the transaction.")
            else:
                payment_succeeded(ctx.services, tx["id"])
        else:
            with ctx.db.tx() as c:
                c.update("transactions", tx["id"], {"status": "processing", "updated_at": utcnow()})
    elif event_type == "checkout.session.async_payment_failed":
        payment_failed(ctx.services, tx["id"], "failed", "The payment did not go through.")
    elif event_type == "checkout.session.expired":
        payment_failed(ctx.services, tx["id"], "cancelled", "The checkout expired before payment.")
    mark_processed(ctx.services, "stripe", event_id)
    return {"received": True}


@api.post("/webhooks/nowpayments", auth="public", hidden=True, max_body=256 * 1024)
def nowpayments_webhook(ctx: Ctx) -> dict[str, Any]:
    s = ctx.settings
    if not s.nowpayments_enabled:
        raise ApiError(404, "NOT_FOUND", "Not found.", "غير موجود.")
    try:
        data = nowpayments_verify(s.nowpayments_ipn_secret, ctx.raw, ctx.request.headers.get("x-nowpayments-sig", ""))
    except (SignatureError, ValueError) as exc:
        raise bad_signature() from exc
    status = str(data.get("payment_status", ""))
    event_id = f"{data.get('payment_id') or data.get('invoice_id')}:{status}"
    if not first_delivery(ctx.services, "nowpayments", event_id, status, data):
        return {"received": True, "duplicate": True}
    tx = find_tx(ctx.services, "nowpayments", data.get("invoice_id"), data.get("order_id"))
    if tx is None:
        mark_processed(ctx.services, "nowpayments", event_id, "unknown order")
        return {"received": True}
    if status == "finished":
        price = data.get("price_amount")
        if price is not None and round(float(price) * 100) < tx["amount_cents"]:
            flag(ctx.services, tx["id"], f"NOWPayments reported {price} {data.get('price_currency')} for this order.")
        else:
            payment_succeeded(ctx.services, tx["id"])
    elif status == "partially_paid":
        flag(ctx.services, tx["id"], f"Partially paid: {data.get('actually_paid')} {data.get('pay_currency')}. Review before crediting.")
    elif status in ("confirming", "confirmed", "sending"):
        with ctx.db.tx() as c:
            c.exec("UPDATE transactions SET status = 'processing', updated_at = :now WHERE id = :id AND status IN ('pending', 'awaiting_payment')", now=utcnow(), id=tx["id"])
    elif status == "failed":
        payment_failed(ctx.services, tx["id"], "failed", "The crypto payment failed.")
    elif status == "expired":
        payment_failed(ctx.services, tx["id"], "cancelled", "The crypto invoice expired before payment.")
    elif status == "refunded":
        flag(ctx.services, tx["id"], "NOWPayments reports this payment as refunded.")
    mark_processed(ctx.services, "nowpayments", event_id)
    return {"received": True}


@api.post("/webhooks/sumsub", auth="public", hidden=True, max_body=256 * 1024)
def sumsub_webhook(ctx: Ctx) -> dict[str, Any]:
    s = ctx.settings
    if not (s.sumsub_enabled and s.sumsub_webhook_secret):
        raise ApiError(404, "NOT_FOUND", "Not found.", "غير موجود.")
    try:
        data = sumsub_verify(s.sumsub_webhook_secret, ctx.raw, ctx.request.headers.get("x-payload-digest", ""),
                             ctx.request.headers.get("x-payload-digest-alg", "HMAC_SHA256_HEX"))
    except (KycError, ValueError) as exc:
        raise bad_signature() from exc
    event_type = str(data.get("type", ""))
    event_id = f"{data.get('applicantId')}:{event_type}:{data.get('createdAtMs') or data.get('createdAt') or data.get('correlationId')}"
    if not first_delivery(ctx.services, "sumsub", event_id, event_type, data):
        return {"received": True, "duplicate": True}
    user_id = user_id_from_external(str(data.get("externalUserId", "")))
    if user_id is None:
        mark_processed(ctx.services, "sumsub", event_id, "unknown applicant")
        return {"received": True}
    review = data.get("reviewResult") or {}
    now = utcnow()
    with ctx.db.tx() as c:
        user = c.get("users", user_id, lock=True)
        if user is None:
            return {"received": True}
        changes: dict[str, Any] = {"kyc_applicant_id": str(data.get("applicantId") or user["kyc_applicant_id"] or "") or None, "updated_at": now}
        if event_type in ("applicantPending", "applicantOnHold") and user["kyc_status"] != "approved":
            changes.update(kyc_status="pending", kyc_submitted_at=now)
        elif event_type == "applicantCreated" and user["kyc_status"] in ("none", "rejected"):
            changes.update(kyc_status="draft")
        elif event_type == "applicantReviewed":
            answer = review.get("reviewAnswer")
            if answer == "GREEN":
                changes.update(kyc_status="approved", kyc_rejection_reason=None, kyc_reviewed_at=now)
                ctx.services.mailer.enqueue(c, user["email"], emails.kyc_result(user["language"], user["full_name"], True, None,
                                                                                  ctx.services.portal_link("/portal", user["language"])))
            elif answer == "RED":
                reason = review.get("clientComment") or review.get("moderationComment") or ", ".join(review.get("rejectLabels") or []) or "Documents not accepted"
                changes.update(kyc_status="rejected", kyc_rejection_reason=str(reason)[:500], kyc_reviewed_at=now)
                ctx.services.mailer.enqueue(c, user["email"], emails.kyc_result(user["language"], user["full_name"], False, str(reason)[:500],
                                                                                  ctx.services.portal_link("/portal/verification", user["language"])))
        c.update("users", user_id, changes)
        audit(c, None, f"kyc.sumsub.{event_type}", "user", user_id, {"answer": review.get("reviewAnswer")})
    mark_processed(ctx.services, "sumsub", event_id)
    return {"received": True}
