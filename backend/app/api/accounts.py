"""MetaTrader 5 trading accounts."""
from __future__ import annotations

from typing import Any

from ..db import utcnow
from ..schemas import AccountListOut, OpenAccountIn, OpenAccountOut, PasswordOut, TradingAccountOut
from ..security import generate_trading_password
from ..serializers import account_out
from ..services.container import audit
from ..services.domain import provision_account, sync_account
from ..services.mt5 import Mt5Error
from ..web import Api, ApiError, Ctx, rate_limit

api = Api("/api/v1", tags=("accounts",))


def own_account(ctx: Ctx, account_id: int) -> dict[str, Any]:
    with ctx.db.tx() as c:
        acc = c.one("SELECT * FROM trading_accounts WHERE id = :id AND user_id = :u", id=account_id, u=ctx.me["id"])
    if acc is None:
        raise ApiError(404, "NOT_FOUND", "Account not found.", "الحساب غير موجود.")
    return acc


def mt5_off() -> ApiError:
    return ApiError(409, "MT5_DISABLED", "This action is not available yet. Please contact support.", "هذا الإجراء غير متاح بعد. يرجى التواصل مع الدعم.")


@api.get("/accounts", response=AccountListOut, summary="List trading accounts")
def list_accounts(ctx: Ctx) -> dict[str, Any]:
    with ctx.db.tx() as c:
        rows = c.all("SELECT * FROM trading_accounts WHERE user_id = :u ORDER BY created_at DESC, id DESC", u=ctx.me["id"])
    return {"items": [account_out(r) for r in rows]}


@api.post("/accounts", body=OpenAccountIn, response=OpenAccountOut, status=201, summary="Open a live or demo MT5 account")
def open_account(ctx: Ctx) -> dict[str, Any]:
    b: OpenAccountIn = ctx.body
    s = ctx.settings
    rate_limit(ctx, "open-account", 10, 3600, key=str(ctx.me["id"]))
    if ctx.me["email_verified_at"] is None:
        raise ApiError(403, "EMAIL_NOT_VERIFIED", "Confirm your email before opening accounts.", "أكّد بريدك الإلكتروني قبل فتح الحسابات.")
    if b.leverage not in s.leverage_options:
        raise ApiError(422, "VALIDATION_ERROR", "Please check the highlighted fields.", "يرجى مراجعة الحقول المحددة.",
                       {"leverage": ("Choose one of the available leverage options.", "اختر إحدى خيارات الرافعة المتاحة.")})
    currency = b.currency.upper()
    if currency not in s.account_currencies:
        raise ApiError(422, "VALIDATION_ERROR", "Please check the highlighted fields.", "يرجى مراجعة الحقول المحددة.",
                       {"currency": ("This currency is not available.", "هذه العملة غير متاحة.")})
    now = utcnow()
    with ctx.db.tx() as c:
        count = c.val("SELECT COUNT(*) AS n FROM trading_accounts WHERE user_id = :u AND status <> 'failed'", u=ctx.me["id"])
        if int(count or 0) >= s.max_accounts_per_user:
            raise ApiError(409, "ACCOUNT_LIMIT", "You have reached the maximum number of accounts.", "بلغت الحد الأقصى لعدد الحسابات.")
        acc = c.insert("trading_accounts", {
            "user_id": ctx.me["id"], "kind": b.kind, "account_type": b.account_type, "leverage": b.leverage, "currency": currency,
            "status": "pending", "created_at": now, "updated_at": now,
        })
        audit(c, ctx.me["id"], "account.requested", "trading_account", acc["id"], {"kind": b.kind, "type": b.account_type}, ctx.ip)
    if not ctx.services.mt5.enabled:
        return {"account": account_out(acc), "password": None, "investor_password": None}
    try:
        acc, password, investor = provision_account(ctx.services, acc["id"])
    except Mt5Error as exc:
        raise ApiError(502, "MT5_UNAVAILABLE", "We could not create the account right now. Our team has been notified.",
                       "تعذّر إنشاء الحساب الآن. تم إبلاغ فريقنا.") from exc
    return {"account": account_out(acc), "password": password, "investor_password": investor}


@api.post("/accounts/{id:int}/reset-password", response=PasswordOut, summary="Set a new MT5 master password")
def reset_trading_password(ctx: Ctx) -> dict[str, Any]:
    acc = own_account(ctx, ctx.path_int("id"))
    rate_limit(ctx, "mt5-password", 5, 3600, key=str(ctx.me["id"]))
    if not ctx.services.mt5.enabled:
        raise mt5_off()
    if acc["status"] != "active" or not acc["login"]:
        raise ApiError(409, "INVALID_STATE", "This account is not active.", "هذا الحساب غير نشط.")
    password = generate_trading_password()
    try:
        ctx.services.mt5.set_password(acc["login"], password)
    except Mt5Error as exc:
        raise ApiError(502, "MT5_UNAVAILABLE", "MetaTrader 5 did not accept the change. Please try again later.", "لم يقبل ميتاتريدر 5 التغيير. يرجى المحاولة لاحقًا.") from exc
    with ctx.db.tx() as c:
        audit(c, ctx.me["id"], "account.password_reset", "trading_account", acc["id"], None, ctx.ip)
    return {"password": password}


@api.post("/accounts/{id:int}/sync", response=TradingAccountOut, summary="Refresh balance and equity from MT5")
def sync(ctx: Ctx) -> dict[str, Any]:
    acc = own_account(ctx, ctx.path_int("id"))
    rate_limit(ctx, "mt5-sync", 30, 300, key=str(ctx.me["id"]))
    if not ctx.services.mt5.enabled:
        raise mt5_off()
    if acc["status"] != "active" or not acc["login"]:
        return account_out(acc)
    updated = sync_account(ctx.services, acc["id"]) or acc
    return account_out(updated)
