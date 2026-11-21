"""Business operations shared by client endpoints, staff endpoints, webhooks and the CLI.

External calls (MT5, payment providers) always happen outside database transactions; rows are
locked and re-checked before every state change so retries and duplicate webhooks are safe.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal
from typing import Any

from ..db import Conn, utcnow
from ..security import generate_trading_password, new_token, token_hash
from ..web import ApiError
from . import emails
from .container import Services, audit
from .mt5 import Mt5Error

log = logging.getLogger("bolt.domain")

OPEN_TX = ("pending", "awaiting_payment", "processing")


def fmt_money(cents: int, currency: str) -> str:
    return f"{currency} {cents / 100:,.2f}"


def issue_action_token(c: Conn, user_id: int, purpose: str, ttl: timedelta) -> str:
    now = utcnow()
    c.exec("UPDATE action_tokens SET used_at = :now WHERE user_id = :u AND purpose = :p AND used_at IS NULL", now=now, u=user_id, p=purpose)
    token = new_token()
    c.insert("action_tokens", {"user_id": user_id, "purpose": purpose, "token_hash": token_hash(token), "expires_at": now + ttl, "created_at": now})
    return token


def send_verification(services: Services, c: Conn, user: dict[str, Any], lang: str | None = None) -> None:
    language = lang or user["language"]
    token = issue_action_token(c, user["id"], "verify_email", timedelta(hours=48))
    link = services.portal_link(f"/verify-email?token={token}", language)
    services.mailer.enqueue(c, user["email"], emails.verify_email(language, user["full_name"], link))


# --- MT5 accounts --------------------------------------------------------------------------------

def mt5_group(services: Services, account: dict[str, Any]) -> str:
    groups = services.settings.mt5_groups
    if account["account_type"] == "funded":
        return groups["funded"]
    if account["kind"] == "demo":
        return groups["demo"]
    return groups[account["account_type"]]


def provision_account(services: Services, account_id: int, *, initial_balance_cents: int | None = None) -> tuple[dict[str, Any], str | None, str | None]:
    """Creates the MT5 account for a pending/failed row. Returns (row, password, investor_password)."""
    with services.db.tx() as c:
        acc = c.get("trading_accounts", account_id, lock=True)
        if acc is None:
            raise ApiError(404, "NOT_FOUND", "Account not found.", "الحساب غير موجود.")
        if acc["status"] == "active" and acc["login"]:
            return acc, None, None
        user = c.get("users", acc["user_id"])
        assert user is not None
    password, investor = generate_trading_password(), generate_trading_password()
    try:
        created = services.mt5.create_account(
            kind=acc["kind"], group=mt5_group(services, acc), name=user["full_name"], email=user["email"], country=user["country"],
            phone=user["phone"], leverage=acc["leverage"], password=password, investor_password=investor,
        )
    except Mt5Error as exc:
        log.warning("MT5 account creation failed for account %s: %s", account_id, exc)
        with services.db.tx() as c:
            c.update("trading_accounts", account_id, {"status": "failed", "last_error": str(exc)[:500], "updated_at": utcnow()})
            services.notify_staff(c, emails.staff_notice("MT5 account creation failed", [f"Account #{account_id} for {user['email']}", str(exc)[:300]],
                                                         services.admin_link("/accounts?status=failed")))
        raise
    now = utcnow()
    with services.db.tx() as c:
        acc = c.update("trading_accounts", account_id, {"login": created.login, "server": created.server, "group_name": mt5_group(services, acc),
                                                        "status": "active", "last_error": None, "updated_at": now})
        assert acc is not None
    if initial_balance_cents is None and acc["kind"] == "demo" and acc["account_type"] != "funded":
        initial_balance_cents = services.settings.demo_balance * 100
    if initial_balance_cents:
        try:
            services.mt5.balance(created.login, Decimal(initial_balance_cents) / 100, "Initial balance")
        except Mt5Error as exc:
            log.warning("initial balance for %s failed: %s", created.login, exc)
            with services.db.tx() as c:
                c.update("trading_accounts", account_id, {"last_error": f"initial balance failed: {exc}"[:500]})
    acc = sync_account(services, account_id) or acc
    with services.db.tx() as c:
        services.mailer.enqueue(c, user["email"], emails.account_ready(user["language"], user["full_name"], acc["kind"], created.login,
                                                                         created.server or "", services.portal_link("/portal/accounts", user["language"])))
        audit(c, None, "account.provisioned", "trading_account", account_id, {"login": created.login})
    return acc, password, investor


def sync_account(services: Services, account_id: int) -> dict[str, Any] | None:
    """Refreshes balance/equity from MT5 (best effort) and checks Bolt Funded limits."""
    with services.db.tx() as c:
        acc = c.get("trading_accounts", account_id)
    if acc is None or not acc["login"] or not services.mt5.enabled:
        return acc
    try:
        info = services.mt5.account_info(acc["login"])
    except Mt5Error as exc:
        log.info("sync of %s failed: %s", acc["login"], exc)
        return acc
    now = utcnow()
    today = now.date().isoformat()
    to_cents = lambda d: int((d * 100).to_integral_value())  # noqa: E731
    data: dict[str, Any] = {"balance_cents": to_cents(info.balance), "equity_cents": to_cents(info.equity),
                            "margin_free_cents": to_cents(info.margin_free), "synced_at": now, "updated_at": now}
    if acc["day_start_date"] != today:
        data["day_start_date"] = today
        data["day_start_equity_cents"] = data["equity_cents"]
    with services.db.tx() as c:
        acc = c.update("trading_accounts", account_id, data)
        assert acc is not None
        if acc["account_type"] == "funded":
            _check_challenge(services, c, acc)
    return acc


def _check_challenge(services: Services, c: Conn, acc: dict[str, Any]) -> None:
    ch = c.one("SELECT * FROM challenges WHERE account_id = :a AND status IN ('phase1', 'phase2', 'funded')", a=acc["id"])
    if ch is None or acc["equity_cents"] is None:
        return
    s = services.settings
    plan = ch["plan_size"] * 100
    equity = acc["equity_cents"]
    day_start = acc["day_start_equity_cents"] if acc["day_start_equity_cents"] is not None else plan
    breach = None
    if equity < plan * (100 - s.funded_max_overall_loss) // 100:
        breach = f"Maximum overall loss reached (equity {equity / 100:,.2f})"
    elif equity < day_start - plan * s.funded_max_daily_loss // 100:
        breach = f"Maximum daily loss reached (equity {equity / 100:,.2f}, day start {day_start / 100:,.2f})"
    note = ch["note"]
    target = {"phase1": s.funded_phase1_target, "phase2": s.funded_phase2_target}.get(ch["status"])
    if target is not None and equity >= plan * (100 + target) // 100:
        note = "Profit target reached – review trading days and move to the next stage."
    if breach != ch["breach"] or note != ch["note"]:
        c.update("challenges", ch["id"], {"breach": breach or ch["breach"], "note": note, "updated_at": utcnow()})


# --- money in ----------------------------------------------------------------------------------------

def credit_deposit(services: Services, tx_id: int) -> dict[str, Any] | None:
    """Payment confirmed: credit the MT5 account (or queue it for manual crediting)."""
    now = utcnow()
    with services.db.tx() as c:
        t = c.get("transactions", tx_id, lock=True)
        if t is None or t["type"] != "deposit" or t["status"] not in OPEN_TX or t["mt5_ticket"]:
            return t
        if t["credit_started_at"] and now - t["credit_started_at"] < timedelta(minutes=10):
            return t
        acc = c.get("trading_accounts", t["account_id"]) if t["account_id"] else None
        if not services.mt5.enabled or acc is None or acc["status"] != "active" or not acc["login"]:
            t = c.update("transactions", tx_id, {"status": "processing", "admin_note": "Payment received. Credit the MT5 account manually, then mark it completed.", "updated_at": now})
            assert t is not None
            services.notify_staff(c, emails.staff_notice("Deposit to credit manually", [f"Transaction #{tx_id}: {fmt_money(t['amount_cents'], t['currency'])}"],
                                                         services.admin_link(f"/transactions/{tx_id}")))
            return t
        c.update("transactions", tx_id, {"status": "processing", "credit_started_at": now, "updated_at": now})
    try:
        ticket = services.mt5.balance(acc["login"], Decimal(t["amount_cents"]) / 100, f"Deposit #{tx_id}")
    except Mt5Error as exc:
        with services.db.tx() as c:
            t = c.update("transactions", tx_id, {"credit_started_at": None, "admin_note": f"MT5 credit failed: {exc}"[:500], "updated_at": utcnow()})
            services.notify_staff(c, emails.staff_notice("Deposit credit failed", [f"Transaction #{tx_id}", str(exc)[:300]], services.admin_link(f"/transactions/{tx_id}")))
        return t
    with services.db.tx() as c:
        t = c.update("transactions", tx_id, {"status": "completed", "mt5_ticket": ticket or "ok", "processed_at": utcnow(), "admin_note": None, "updated_at": utcnow()})
        assert t is not None
        user = c.get("users", t["user_id"])
        assert user is not None
        services.mailer.enqueue(c, user["email"], emails.deposit_completed(user["language"], user["full_name"], fmt_money(t["amount_cents"], t["currency"]), acc["login"]))
        audit(c, None, "deposit.credited", "transaction", tx_id, {"ticket": ticket})
    sync_account(services, acc["id"])
    return t


def complete_challenge_payment(services: Services, tx_id: int) -> None:
    with services.db.tx() as c:
        t = c.get("transactions", tx_id, lock=True)
        if t is None or t["type"] != "funded_fee" or t["status"] not in OPEN_TX:
            return
        now = utcnow()
        c.update("transactions", tx_id, {"status": "completed", "processed_at": now, "updated_at": now})
        ch = c.get("challenges", t["challenge_id"], lock=True)
        if ch is None or ch["status"] != "awaiting_payment":
            return
        c.update("challenges", ch["id"], {"status": "pending_activation", "updated_at": now})
        audit(c, None, "challenge.paid", "challenge", ch["id"])
    activate_challenge(services, ch["id"])


def activate_challenge(services: Services, challenge_id: int, *, login: str | None = None, server: str | None = None) -> dict[str, Any] | None:
    """Creates (or records) the evaluation account and starts Phase 1."""
    with services.db.tx() as c:
        ch = c.get("challenges", challenge_id, lock=True)
        if ch is None or ch["status"] != "pending_activation":
            return ch
        user = c.get("users", ch["user_id"])
        assert user is not None
        now = utcnow()
        acc = c.get("trading_accounts", ch["account_id"]) if ch["account_id"] else None
        if acc is None:
            acc = c.insert("trading_accounts", {"user_id": user["id"], "kind": "demo", "account_type": "funded", "leverage": services.settings.funded_leverage,
                                                "currency": "USD", "status": "pending", "created_at": now, "updated_at": now})
            c.update("challenges", challenge_id, {"account_id": acc["id"], "updated_at": now})
        if login:
            acc = c.update("trading_accounts", acc["id"], {"login": login, "server": server or services.settings.mt5_server_demo or None,
                                                           "status": "active", "group_name": services.settings.mt5_groups["funded"], "updated_at": now})
        assert acc is not None
    if not login:
        if not services.mt5.enabled:
            with services.db.tx() as c:
                services.notify_staff(c, emails.staff_notice("Bolt Funded account to set up", [f"Challenge #{challenge_id} for {user['email']} ({ch['plan_size']:,} USD)"],
                                                             services.admin_link(f"/challenges/{challenge_id}")))
            return ch
        try:
            provision_account(services, acc["id"], initial_balance_cents=ch["plan_size"] * 100)
        except Mt5Error:
            return ch
    with services.db.tx() as c:
        ch = c.update("challenges", challenge_id, {"status": "phase1", "updated_at": utcnow()})
        assert ch is not None
        services.mailer.enqueue(c, user["email"], emails.challenge_update(user["language"], user["full_name"], f"${ch['plan_size']:,}", "phase1",
                                                                            services.portal_link("/portal/funded", user["language"])))
        audit(c, None, "challenge.activated", "challenge", challenge_id)
    return ch


def payment_failed(services: Services, tx_id: int, status: str, note: str | None = None) -> None:
    with services.db.tx() as c:
        t = c.get("transactions", tx_id, lock=True)
        if t is None or t["status"] not in ("pending", "awaiting_payment"):
            return
        c.update("transactions", tx_id, {"status": status, "note": note, "updated_at": utcnow()})
        if t["challenge_id"]:
            c.exec("UPDATE challenges SET status = 'cancelled', updated_at = :now WHERE id = :id AND status = 'awaiting_payment'", now=utcnow(), id=t["challenge_id"])


def payment_succeeded(services: Services, tx_id: int) -> None:
    with services.db.tx() as c:
        t = c.get("transactions", tx_id)
    if t is None:
        return
    if t["type"] == "deposit":
        credit_deposit(services, tx_id)
    elif t["type"] == "funded_fee":
        complete_challenge_payment(services, tx_id)


# --- money out ----------------------------------------------------------------------------------------

def withdrawable_cents(c: Conn, account: dict[str, Any]) -> int | None:
    """Free margin minus withdrawals already waiting for approval (None when the balance is unknown)."""
    base = account["margin_free_cents"] if account["margin_free_cents"] is not None else account["balance_cents"]
    if base is None:
        return None
    pending = c.val("SELECT COALESCE(SUM(amount_cents), 0) AS s FROM transactions WHERE account_id = :a AND type = 'withdrawal' AND status = 'pending'", a=account["id"])
    return int(base) - int(pending or 0)


def _withdrawal_email(services: Services, c: Conn, t: dict[str, Any]) -> None:
    user = c.get("users", t["user_id"])
    assert user is not None
    services.mailer.enqueue(c, user["email"], emails.withdrawal_update(user["language"], user["full_name"], fmt_money(t["amount_cents"], t["currency"]), t["status"], t["note"]))


def approve_withdrawal(services: Services, tx_id: int, actor: dict[str, Any], ip: str) -> dict[str, Any]:
    with services.db.tx() as c:
        t = c.get("transactions", tx_id, lock=True)
        if t is None or t["type"] != "withdrawal":
            raise ApiError(404, "NOT_FOUND", "Withdrawal not found.", "طلب السحب غير موجود.")
        if t["status"] != "pending":
            raise ApiError(409, "INVALID_STATE", "Only pending withdrawals can be approved.", "يمكن اعتماد طلبات السحب المعلّقة فقط.")
        acc = c.get("trading_accounts", t["account_id"]) if t["account_id"] else None
        c.update("transactions", tx_id, {"credit_started_at": utcnow()})
    ticket = None
    if services.mt5.enabled and acc and acc["login"] and acc["status"] == "active":
        try:
            ticket = services.mt5.balance(acc["login"], -Decimal(t["amount_cents"]) / 100, f"Withdrawal #{tx_id}")
        except Mt5Error as exc:
            with services.db.tx() as c:
                c.update("transactions", tx_id, {"credit_started_at": None, "admin_note": f"MT5 debit failed: {exc}"[:500], "updated_at": utcnow()})
            raise ApiError(409, "INSUFFICIENT_FUNDS", f"MT5 refused the debit: {exc}", f"رفض ميتاتريدر 5 الخصم: {exc}") from exc
    with services.db.tx() as c:
        t = c.update("transactions", tx_id, {"status": "processing", "mt5_ticket": ticket, "processed_by": actor["id"], "processed_at": utcnow(),
                                              "admin_note": None if ticket else "Debit the MT5 account manually before sending the payout.", "updated_at": utcnow()})
        assert t is not None
        _withdrawal_email(services, c, t)
        audit(c, actor["id"], "withdrawal.approved", "transaction", tx_id, {"mt5_ticket": ticket}, ip)
    if acc:
        sync_account(services, acc["id"])
    return t


def complete_withdrawal(services: Services, tx_id: int, actor: dict[str, Any], reference: str | None, ip: str) -> dict[str, Any]:
    with services.db.tx() as c:
        t = c.get("transactions", tx_id, lock=True)
        if t is None or t["type"] != "withdrawal":
            raise ApiError(404, "NOT_FOUND", "Withdrawal not found.", "طلب السحب غير موجود.")
        if t["status"] != "processing":
            raise ApiError(409, "INVALID_STATE", "Approve the withdrawal before marking it paid.", "اعتمد طلب السحب قبل تأكيد الدفع.")
        t = c.update("transactions", tx_id, {"status": "completed", "reference": reference or t["reference"], "processed_by": actor["id"], "processed_at": utcnow(), "updated_at": utcnow()})
        assert t is not None
        _withdrawal_email(services, c, t)
        audit(c, actor["id"], "withdrawal.completed", "transaction", tx_id, {"reference": reference}, ip)
    return t


def reject_withdrawal(services: Services, tx_id: int, actor: dict[str, Any], reason: str, ip: str) -> dict[str, Any]:
    """Pending -> rejected. Processing (already debited) -> refunded to MT5 and marked failed."""
    with services.db.tx() as c:
        t = c.get("transactions", tx_id, lock=True)
        if t is None or t["type"] != "withdrawal":
            raise ApiError(404, "NOT_FOUND", "Withdrawal not found.", "طلب السحب غير موجود.")
        if t["status"] not in ("pending", "processing"):
            raise ApiError(409, "INVALID_STATE", "This withdrawal is already closed.", "طلب السحب هذا مغلق بالفعل.")
        acc = c.get("trading_accounts", t["account_id"]) if t["account_id"] else None
    refund_ticket = None
    if t["status"] == "processing" and t["mt5_ticket"] and acc and acc["login"]:
        try:
            refund_ticket = services.mt5.balance(acc["login"], Decimal(t["amount_cents"]) / 100, f"Refund withdrawal #{tx_id}")
        except Mt5Error as exc:
            raise ApiError(502, "MT5_ERROR", f"Could not return the funds to MT5: {exc}", f"تعذّر إعادة الأموال إلى ميتاتريدر 5: {exc}") from exc
    with services.db.tx() as c:
        new_status = "rejected" if t["status"] == "pending" else "failed"
        t = c.update("transactions", tx_id, {"status": new_status, "note": reason, "processed_by": actor["id"], "processed_at": utcnow(), "updated_at": utcnow()})
        assert t is not None
        _withdrawal_email(services, c, t)
        audit(c, actor["id"], f"withdrawal.{new_status}", "transaction", tx_id, {"reason": reason, "refund_ticket": refund_ticket}, ip)
    if acc:
        sync_account(services, acc["id"])
    return t
