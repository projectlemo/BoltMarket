"""Public endpoints: site configuration, contact form, live prices, blog and health."""
from __future__ import annotations

import asyncio
import hmac
import json
from collections.abc import AsyncIterator
from typing import Any

from starlette.responses import StreamingResponse

from .. import __version__
from ..db import utcnow
from ..schemas import CmsPostListOut, CmsPostOut, ContactIn, OkOut, PublicConfigOut, QuotesIngestIn, QuotesOut
from ..serializers import post_out
from ..services import emails
from ..web import Api, ApiError, Ctx, rate_limit
from .money import payment_methods, withdrawal_methods

api = Api("/api/v1", tags=("public",))


@api.get("/public/config", auth="public", response=PublicConfigOut, summary="What the portal can offer right now")
def public_config(ctx: Ctx) -> dict[str, Any]:
    s = ctx.settings
    return {
        "registration_open": s.registration_open,
        "mt5_enabled": ctx.services.mt5.enabled,
        "mt5_server_live": s.mt5_server_live or None,
        "mt5_server_demo": s.mt5_server_demo or None,
        "kyc_provider": s.effective_kyc_provider,
        "require_kyc_for_deposit": s.require_kyc_for_deposit,
        "deposit_methods": payment_methods(ctx.services),
        "withdrawal_methods": withdrawal_methods(ctx.services),
        "leverage_options": s.leverage_options,
        "account_currencies": s.account_currencies,
        "demo_balance": s.demo_balance,
        "restricted_countries": s.restricted_countries,
    }


@api.post("/contact", auth="public", body=ContactIn, response=OkOut, status=202, summary="Contact form")
def contact(ctx: Ctx) -> dict[str, Any]:
    b: ContactIn = ctx.body
    if b.website:  # honeypot field: bots fill it, people never see it
        return {"ok": True}
    rate_limit(ctx, "contact", 5, 3600)
    with ctx.db.tx() as c:
        msg = c.insert("contact_messages", {
            "name": b.name, "email": b.email, "topic": b.topic, "subject": b.subject, "message": b.message, "language": b.language,
            "ip": ctx.ip, "user_agent": ctx.user_agent, "status": "new", "created_at": utcnow(),
        })
        ctx.services.notify_staff(c, emails.staff_notice(f"Contact form: {b.subject}", [f"From {b.name} <{b.email}> · topic: {b.topic} · language: {b.language}", b.message],
                                                         ctx.services.admin_link(f"/messages/{msg['id']}")))
    return {"ok": True}


# --- live prices -----------------------------------------------------------------------------------

@api.get("/quotes", auth="public", response=QuotesOut, summary="Latest prices")
def quotes(ctx: Ctx) -> dict[str, Any]:
    hub = ctx.services.quotes
    if not hub.enabled:
        return {"status": "disabled", "quotes": []}
    snap = hub.snapshot()
    return {"status": "simulated" if hub.simulated else ("live" if snap else "waiting"), "quotes": snap}


@api.get("/quotes/stream", auth="public", summary="Live prices (Server-Sent Events)")
async def quotes_stream(ctx: Ctx) -> StreamingResponse:
    hub = ctx.services.quotes
    if not hub.enabled:
        raise ApiError(503, "FEED_UNAVAILABLE", "Live prices are not available.", "الأسعار المباشرة غير متاحة.")
    queue = hub.open()
    if queue is None:
        raise ApiError(503, "FEED_BUSY", "Too many live connections. Please retry shortly.", "اتصالات مباشرة كثيرة. يرجى إعادة المحاولة بعد قليل.")

    async def events() -> AsyncIterator[str]:
        try:
            yield "retry: 3000\n\n"
            snapshot = hub.snapshot()
            if snapshot:
                yield f"data: {json.dumps(snapshot, separators=(',', ':'))}\n\n"
            while True:
                try:
                    batch = await asyncio.wait_for(queue.get(), timeout=15)
                except TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                pending = {q["s"]: q for q in batch}
                await asyncio.sleep(0.25)  # coalesce bursts into one frame
                while not queue.empty():
                    for q in queue.get_nowait():
                        pending[q["s"]] = q
                yield f"data: {json.dumps(list(pending.values()), separators=(',', ':'))}\n\n"
        finally:
            hub.close(queue)

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"})


@api.post("/quotes/ingest", auth="public", body=QuotesIngestIn, summary="Price bridge input (X-Bridge-Key)", max_body=256 * 1024)
async def quotes_ingest(ctx: Ctx) -> dict[str, Any]:
    s = ctx.settings
    key = ctx.request.headers.get("x-bridge-key", "")
    if s.quotes_mode != "bridge" or not s.quotes_bridge_key or not hmac.compare_digest(key, s.quotes_bridge_key):
        raise ApiError(401, "UNAUTHORIZED", "Invalid bridge key.", "مفتاح الربط غير صالح.")
    b: QuotesIngestIn = ctx.body
    accepted = ctx.services.quotes.publish(q.model_dump(exclude_none=True) for q in b.quotes)
    return {"accepted": accepted}


# --- blog ------------------------------------------------------------------------------------------------

@api.get("/blog/posts", auth="public", response=CmsPostListOut, summary="Published articles", query={"lang": "string", "limit": "integer", "category": "string"})
def list_posts(ctx: Ctx) -> dict[str, Any]:
    lang = "ar" if ctx.query.get("lang") == "ar" else "en"
    limit = ctx.query_int("limit", 20, hi=100)
    params: dict[str, Any] = {"lang": lang, "now": utcnow(), "lim": limit}
    extra = ""
    if ctx.query.get("category") in ("learn", "insights"):
        extra = " AND category = :cat"
        params["cat"] = ctx.query.get("category")
    with ctx.db.tx() as c:
        rows = c.all(
            "SELECT * FROM posts WHERE language = :lang AND status = 'published' AND published_at <= :now" + extra + " ORDER BY published_at DESC, id DESC LIMIT :lim",
            **params,
        )
    return {"items": [post_out(r, with_body=False) for r in rows]}


@api.get("/blog/posts/{slug}", auth="public", response=CmsPostOut, summary="One published article", query={"lang": "string"})
def get_post(ctx: Ctx) -> dict[str, Any]:
    lang = "ar" if ctx.query.get("lang") == "ar" else "en"
    with ctx.db.tx() as c:
        row = c.one(
            "SELECT * FROM posts WHERE slug = :slug AND language = :lang AND status = 'published' AND published_at <= :now",
            slug=str(ctx.request.path_params.get("slug", ""))[:120], lang=lang, now=utcnow(),
        )
    if row is None:
        raise ApiError(404, "NOT_FOUND", "Article not found.", "المقال غير موجود.")
    return post_out(row, with_body=True)


@api.get("/health", auth="public", summary="Health check")
def health(ctx: Ctx) -> dict[str, Any]:
    ok = ctx.db.ping()
    if not ok:
        raise ApiError(503, "DB_UNAVAILABLE", "Database unavailable.", "قاعدة البيانات غير متاحة.")
    return {"status": "ok", "version": __version__, "time": utcnow()}
