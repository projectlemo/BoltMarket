"""Bolt Funded evaluation purchases."""
from __future__ import annotations

from typing import Any

from ..db import utcnow
from ..schemas import BuyChallengeIn, BuyChallengeOut, ChallengeListOut
from ..serializers import challenge_out
from ..services.container import audit
from ..services.payments import PaymentError
from ..web import Api, ApiError, Ctx, rate_limit
from .money import payment_methods, start_checkout

api = Api("/api/v1", tags=("funded",))


@api.get("/funded/challenges", response=ChallengeListOut, summary="Your evaluations")
def list_challenges(ctx: Ctx) -> dict[str, Any]:
    with ctx.db.tx() as c:
        rows = c.all("SELECT * FROM challenges WHERE user_id = :u ORDER BY created_at DESC, id DESC", u=ctx.me["id"])
        accounts = {a["id"]: a for a in c.all("SELECT * FROM trading_accounts WHERE user_id = :u AND account_type = 'funded'", u=ctx.me["id"])}
    return {"items": [challenge_out(r, accounts.get(r["account_id"])) for r in rows]}


@api.post("/funded/challenges", body=BuyChallengeIn, response=BuyChallengeOut, status=201, summary="Buy an evaluation")
def buy_challenge(ctx: Ctx) -> dict[str, Any]:
    b: BuyChallengeIn = ctx.body
    rate_limit(ctx, "challenge", 10, 3600, key=str(ctx.me["id"]))
    fee = ctx.settings.funded_fee(b.plan_size)
    if fee is None:
        raise ApiError(422, "VALIDATION_ERROR", "Please check the highlighted fields.", "يرجى مراجعة الحقول المحددة.",
                       {"plan_size": ("Choose one of the available plans.", "اختر إحدى الخطط المتاحة.")})
    if not any(m["id"] == b.method for m in payment_methods(ctx.services)):
        raise ApiError(409, "METHOD_UNAVAILABLE", "This payment method is not available.", "وسيلة الدفع هذه غير متاحة.")
    now = utcnow()
    with ctx.db.tx() as c:
        waiting = c.val("SELECT COUNT(*) AS n FROM challenges WHERE user_id = :u AND status = 'awaiting_payment'", u=ctx.me["id"])
        if int(waiting or 0) >= 3:
            c.exec("UPDATE challenges SET status = 'cancelled', updated_at = :now WHERE user_id = :u AND status = 'awaiting_payment'", now=now, u=ctx.me["id"])
            c.exec("UPDATE transactions SET status = 'cancelled', updated_at = :now WHERE user_id = :u AND type = 'funded_fee' AND status IN ('pending', 'awaiting_payment')",
                   now=now, u=ctx.me["id"])
        ch = c.insert("challenges", {"user_id": ctx.me["id"], "plan_size": b.plan_size, "fee_cents": fee * 100, "status": "awaiting_payment", "created_at": now, "updated_at": now})
        tx = c.insert("transactions", {"user_id": ctx.me["id"], "challenge_id": ch["id"], "type": "funded_fee", "method": b.method, "amount_cents": fee * 100,
                                       "currency": "USD", "status": "pending", "created_at": now, "updated_at": now})
        audit(c, ctx.me["id"], "challenge.created", "challenge", ch["id"], {"plan_size": b.plan_size}, ctx.ip)
    try:
        checkout = start_checkout(
            ctx.services, method=b.method, amount_cents=fee * 100, currency="USD", description=f"Bolt Funded evaluation ${b.plan_size:,}",
            tx_id=tx["id"], email=ctx.me["email"],
            success_url=ctx.services.portal_link(f"/portal/funded?challenge={ch['id']}", ctx.lang),
            cancel_url=ctx.services.portal_link(f"/portal/funded?challenge={ch['id']}&status=cancelled", ctx.lang),
        )
    except PaymentError as exc:
        with ctx.db.tx() as c:
            c.update("transactions", tx["id"], {"status": "failed", "admin_note": str(exc)[:500], "updated_at": utcnow()})
            c.update("challenges", ch["id"], {"status": "cancelled", "updated_at": utcnow()})
        raise ApiError(502, "PAYMENT_PROVIDER_ERROR", "The payment provider is not responding. Please try again shortly.",
                       "مزوّد الدفع لا يستجيب. يرجى المحاولة بعد قليل.") from exc
    with ctx.db.tx() as c:
        c.update("transactions", tx["id"], {"status": "awaiting_payment", "provider": checkout.provider, "provider_ref": checkout.provider_ref, "updated_at": utcnow()})
    return {"challenge": challenge_out(ch, None), "redirect_url": checkout.redirect_url}
