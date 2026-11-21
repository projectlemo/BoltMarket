"""Deposits, withdrawals and transaction history."""
from __future__ import annotations

import re
from typing import Any

from ..db import Json, utcnow
from ..schemas import DepositIn, DepositOut, TransactionOut, TransactionPageOut, WithdrawIn, to_cents
from ..serializers import tx_out
from ..services import emails
from ..services.container import Services, audit
from ..services.domain import withdrawable_cents
from ..services.payments import Checkout, PaymentError, nowpayments_invoice, stripe_checkout
from ..web import Api, ApiError, Ctx, rate_limit

api = Api("/api/v1", tags=("payments",))

CRYPTO_NETWORKS = {"TRC20", "ERC20", "BEP20", "BTC", "ETH"}
_ADDRESS = re.compile(r"^[A-Za-z0-9:]{20,120}$")


def payment_methods(services: Services) -> list[dict[str, Any]]:
    s = services.settings
    out: list[dict[str, Any]] = []
    if s.stripe_enabled:
        out.append({"id": "card", "provider": "stripe", "min_amount": float(s.min_deposit), "currency": "USD"})
    if s.nowpayments_enabled:
        out.append({"id": "crypto", "provider": "nowpayments", "min_amount": float(s.min_deposit), "currency": "USD"})
    return out


def withdrawal_methods(services: Services) -> list[dict[str, Any]]:
    # Return-to-source policy: clients withdraw through the rails they can deposit with.
    return [{**m, "min_amount": float(services.settings.min_withdrawal)} for m in payment_methods(services)]


def start_checkout(services: Services, *, method: str, amount_cents: int, currency: str, description: str, tx_id: int,
                   email: str, success_url: str, cancel_url: str) -> Checkout:
    s = services.settings
    if method == "card" and s.stripe_enabled:
        return stripe_checkout(s, services.http, amount_cents=amount_cents, currency=currency, description=description, transaction_id=tx_id,
                               customer_email=email, success_url=success_url, cancel_url=cancel_url)
    if method == "crypto" and s.nowpayments_enabled:
        return nowpayments_invoice(s, services.http, amount_cents=amount_cents, currency=currency, description=description, transaction_id=tx_id,
                                   success_url=success_url, cancel_url=cancel_url)
    raise ApiError(409, "METHOD_UNAVAILABLE", "This payment method is not available.", "وسيلة الدفع هذه غير متاحة.")


def tx_with_login(ctx: Ctx, tx_id: int) -> dict[str, Any]:
    with ctx.db.tx() as c:
        row = c.one(
            "SELECT t.*, a.login AS account_login FROM transactions t LEFT JOIN trading_accounts a ON a.id = t.account_id "
            "WHERE t.id = :id AND t.user_id = :u", id=tx_id, u=ctx.me["id"],
        )
    if row is None:
        raise ApiError(404, "NOT_FOUND", "Transaction not found.", "المعاملة غير موجودة.")
    return row


def live_account(ctx: Ctx, account_id: int) -> dict[str, Any]:
    with ctx.db.tx() as c:
        acc = c.one("SELECT * FROM trading_accounts WHERE id = :id AND user_id = :u", id=account_id, u=ctx.me["id"])
    if acc is None or acc["kind"] != "live" or acc["status"] != "active":
        raise ApiError(422, "VALIDATION_ERROR", "Please check the highlighted fields.", "يرجى مراجعة الحقول المحددة.",
                       {"account_id": ("Choose one of your active live accounts.", "اختر أحد حساباتك الحقيقية النشطة.")})
    return acc


@api.post("/deposits", body=DepositIn, response=DepositOut, status=201, summary="Start a deposit")
def create_deposit(ctx: Ctx) -> dict[str, Any]:
    b: DepositIn = ctx.body
    s = ctx.settings
    rate_limit(ctx, "deposit", 20, 3600, key=str(ctx.me["id"]))
    if s.require_kyc_for_deposit and ctx.me["kyc_status"] != "approved":
        raise ApiError(403, "KYC_REQUIRED", "Verify your identity before depositing.", "تحقّق من هويتك قبل الإيداع.")
    if not any(m["id"] == b.method for m in payment_methods(ctx.services)):
        raise ApiError(409, "METHOD_UNAVAILABLE", "This payment method is not available.", "وسيلة الدفع هذه غير متاحة.")
    acc = live_account(ctx, b.account_id)
    cents = to_cents(b.amount)
    with ctx.db.tx() as c:
        funded_before = c.val("SELECT COUNT(*) AS n FROM transactions WHERE account_id = :a AND type = 'deposit' AND status = 'completed'", a=acc["id"])
    minimum = s.min_deposit * 100
    if not funded_before:
        minimum = max(minimum, s.account_min_deposits.get(acc["account_type"], 0) * 100)
    if cents < minimum:
        raise ApiError(422, "BELOW_MINIMUM", f"The minimum for this deposit is USD {minimum / 100:,.2f}.", f"الحد الأدنى لهذا الإيداع {minimum / 100:,.2f} دولار.",
                       {"amount": (f"The minimum is USD {minimum / 100:,.2f}.", f"الحد الأدنى {minimum / 100:,.2f} دولار.")})
    now = utcnow()
    with ctx.db.tx() as c:
        tx = c.insert("transactions", {
            "user_id": ctx.me["id"], "account_id": acc["id"], "type": "deposit", "method": b.method, "amount_cents": cents,
            "currency": acc["currency"], "status": "pending", "created_at": now, "updated_at": now,
        })
        audit(c, ctx.me["id"], "deposit.created", "transaction", tx["id"], {"amount_cents": cents, "method": b.method}, ctx.ip)
    lang = ctx.lang
    try:
        checkout = start_checkout(
            ctx.services, method=b.method, amount_cents=cents, currency=acc["currency"], description=f"Deposit to MT5 account {acc['login']}",
            tx_id=tx["id"], email=ctx.me["email"],
            success_url=ctx.services.portal_link(f"/portal/deposit?tx={tx['id']}", lang),
            cancel_url=ctx.services.portal_link(f"/portal/deposit?tx={tx['id']}&status=cancelled", lang),
        )
    except PaymentError as exc:
        with ctx.db.tx() as c:
            c.update("transactions", tx["id"], {"status": "failed", "admin_note": str(exc)[:500], "updated_at": utcnow()})
        raise ApiError(502, "PAYMENT_PROVIDER_ERROR", "The payment provider is not responding. Please try again shortly.",
                       "مزوّد الدفع لا يستجيب. يرجى المحاولة بعد قليل.") from exc
    with ctx.db.tx() as c:
        tx = c.update("transactions", tx["id"], {"status": "awaiting_payment", "provider": checkout.provider, "provider_ref": checkout.provider_ref, "updated_at": utcnow()})
    assert tx is not None
    return {"transaction": tx_out({**tx, "account_login": acc["login"]}), "redirect_url": checkout.redirect_url}


@api.post("/withdrawals", body=WithdrawIn, response=TransactionOut, status=201, summary="Request a withdrawal")
def create_withdrawal(ctx: Ctx) -> dict[str, Any]:
    b: WithdrawIn = ctx.body
    s = ctx.settings
    rate_limit(ctx, "withdraw", 10, 3600, key=str(ctx.me["id"]))
    if ctx.me["kyc_status"] != "approved":
        raise ApiError(403, "KYC_REQUIRED", "Withdrawals are available once your identity is verified.", "تتاح السحوبات بعد التحقق من هويتك.")
    if not any(m["id"] == b.method for m in withdrawal_methods(ctx.services)):
        raise ApiError(409, "METHOD_UNAVAILABLE", "This withdrawal method is not available.", "وسيلة السحب هذه غير متاحة.")
    destination: dict[str, str] = {}
    if b.method == "crypto":
        address = (b.destination.get("address") or "").strip()
        network = (b.destination.get("network") or "").strip().upper()
        if not _ADDRESS.match(address):
            raise ApiError(422, "VALIDATION_ERROR", "Please check the highlighted fields.", "يرجى مراجعة الحقول المحددة.",
                           {"address": ("Enter a valid wallet address.", "أدخل عنوان محفظة صحيحًا.")})
        if network not in CRYPTO_NETWORKS:
            raise ApiError(422, "VALIDATION_ERROR", "Please check the highlighted fields.", "يرجى مراجعة الحقول المحددة.",
                           {"network": ("Choose a supported network.", "اختر شبكة مدعومة.")})
        destination = {"address": address, "network": network}
    acc = live_account(ctx, b.account_id)
    cents = to_cents(b.amount)
    if cents < s.min_withdrawal * 100:
        raise ApiError(422, "BELOW_MINIMUM", f"The minimum withdrawal is USD {s.min_withdrawal:,.2f}.", f"الحد الأدنى للسحب {s.min_withdrawal:,.2f} دولار.",
                       {"amount": (f"The minimum is USD {s.min_withdrawal:,.2f}.", f"الحد الأدنى {s.min_withdrawal:,.2f} دولار.")})
    if ctx.services.mt5.enabled and acc["login"]:
        from ..services.domain import sync_account

        acc = sync_account(ctx.services, acc["id"]) or acc
    now = utcnow()
    with ctx.db.tx() as c:
        available = withdrawable_cents(c, acc)
        if available is not None and cents > available:
            raise ApiError(409, "INSUFFICIENT_FUNDS", "The amount exceeds the free margin on this account.", "المبلغ يتجاوز الهامش الحر في هذا الحساب.")
        tx = c.insert("transactions", {
            "user_id": ctx.me["id"], "account_id": acc["id"], "type": "withdrawal", "method": b.method, "amount_cents": cents,
            "currency": acc["currency"], "status": "pending", "destination": Json(destination), "created_at": now, "updated_at": now,
        })
        ctx.services.notify_staff(c, emails.staff_notice("New withdrawal request", [f"#{tx['id']}: {acc['currency']} {cents / 100:,.2f} via {b.method} from {ctx.me['email']}"],
                                                         ctx.services.admin_link(f"/transactions/{tx['id']}")))
        audit(c, ctx.me["id"], "withdrawal.requested", "transaction", tx["id"], {"amount_cents": cents, "method": b.method}, ctx.ip)
    return tx_out({**tx, "account_login": acc["login"]})


@api.post("/withdrawals/{id:int}/cancel", response=TransactionOut, summary="Cancel a pending withdrawal")
def cancel_withdrawal(ctx: Ctx) -> dict[str, Any]:
    tx_id = ctx.path_int("id")
    with ctx.db.tx() as c:
        tx = c.one("SELECT * FROM transactions WHERE id = :id AND user_id = :u AND type = 'withdrawal'" + c.for_update, id=tx_id, u=ctx.me["id"])
        if tx is None:
            raise ApiError(404, "NOT_FOUND", "Withdrawal not found.", "طلب السحب غير موجود.")
        if tx["status"] != "pending":
            raise ApiError(409, "INVALID_STATE", "This withdrawal can no longer be cancelled.", "لم يعد بالإمكان إلغاء طلب السحب هذا.")
        c.update("transactions", tx_id, {"status": "cancelled", "updated_at": utcnow()})
        audit(c, ctx.me["id"], "withdrawal.cancelled", "transaction", tx_id, None, ctx.ip)
    return tx_out(tx_with_login(ctx, tx_id))


@api.get("/transactions", response=TransactionPageOut, summary="Transaction history",
         query={"type": "string", "status": "string", "page": "integer", "page_size": "integer"})
def list_transactions(ctx: Ctx) -> dict[str, Any]:
    page = ctx.query_int("page", 1)
    size = ctx.query_int("page_size", 20, hi=100)
    where = ["t.user_id = :u"]
    params: dict[str, Any] = {"u": ctx.me["id"]}
    tx_type = ctx.query.get("type")
    if tx_type in ("deposit", "withdrawal", "ib_commission", "adjustment", "funded_fee"):
        where.append("t.type = :type")
        params["type"] = tx_type
    status = ctx.query.get("status")
    if status in ("pending", "awaiting_payment", "processing", "completed", "rejected", "failed", "cancelled"):
        where.append("t.status = :status")
        params["status"] = status
    clause = " AND ".join(where)
    with ctx.db.tx() as c:
        total = c.val(f"SELECT COUNT(*) AS n FROM transactions t WHERE {clause}", **params)
        rows = c.all(
            f"SELECT t.*, a.login AS account_login FROM transactions t LEFT JOIN trading_accounts a ON a.id = t.account_id "
            f"WHERE {clause} ORDER BY t.created_at DESC, t.id DESC LIMIT :lim OFFSET :off",
            **params, lim=size, off=(page - 1) * size,
        )
    return {"items": [tx_out(r) for r in rows], "total": int(total or 0), "page": page, "page_size": size}


@api.get("/transactions/{id:int}", response=TransactionOut, summary="One transaction")
def get_transaction(ctx: Ctx) -> dict[str, Any]:
    return tx_out(tx_with_login(ctx, ctx.path_int("id")))
