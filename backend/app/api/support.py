"""Support tickets and the partner (IB) overview."""
from __future__ import annotations

from typing import Any

from ..db import utcnow
from ..schemas import IbOverviewOut, TicketDetailOut, TicketIn, TicketListOut, TicketMessageOut, TicketOut, TicketReplyIn
from ..serializers import message_out, money, ticket_out
from ..services import emails
from ..services.container import audit
from ..web import Api, ApiError, Ctx, rate_limit

api = Api("/api/v1", tags=("support",))


def own_ticket(ctx: Ctx, ticket_id: int, *, lock: bool = False) -> dict[str, Any]:
    with ctx.db.tx() as c:
        t = c.one("SELECT * FROM tickets WHERE id = :id AND user_id = :u" + (c.for_update if lock else ""), id=ticket_id, u=ctx.me["id"])
    if t is None:
        raise ApiError(404, "NOT_FOUND", "Ticket not found.", "التذكرة غير موجودة.")
    return t


@api.get("/tickets", response=TicketListOut, summary="Your support tickets")
def list_tickets(ctx: Ctx) -> dict[str, Any]:
    with ctx.db.tx() as c:
        rows = c.all("SELECT * FROM tickets WHERE user_id = :u ORDER BY updated_at DESC, id DESC", u=ctx.me["id"])
    return {"items": [ticket_out(r) for r in rows]}


@api.post("/tickets", body=TicketIn, response=TicketOut, status=201, summary="Open a ticket")
def create_ticket(ctx: Ctx) -> dict[str, Any]:
    b: TicketIn = ctx.body
    rate_limit(ctx, "ticket", 10, 3600, key=str(ctx.me["id"]))
    now = utcnow()
    with ctx.db.tx() as c:
        open_count = c.val("SELECT COUNT(*) AS n FROM tickets WHERE user_id = :u AND status <> 'closed'", u=ctx.me["id"])
        if int(open_count or 0) >= 10:
            raise ApiError(409, "TOO_MANY_TICKETS", "Please close some of your open tickets first.", "يرجى إغلاق بعض تذاكرك المفتوحة أولًا.")
        ticket = c.insert("tickets", {"user_id": ctx.me["id"], "subject": b.subject, "category": b.category, "status": "open", "created_at": now, "updated_at": now})
        c.insert("ticket_messages", {"ticket_id": ticket["id"], "author_id": ctx.me["id"], "is_staff": False, "body": b.message, "created_at": now})
        ctx.services.notify_staff(c, emails.staff_notice(f"New ticket #{ticket['id']}: {b.subject}", [f"From {ctx.me['full_name']} ({ctx.me['email']})", b.message[:1000]],
                                                         ctx.services.admin_link(f"/tickets/{ticket['id']}")))
        audit(c, ctx.me["id"], "ticket.created", "ticket", ticket["id"], None, ctx.ip)
    return ticket_out(ticket)


@api.get("/tickets/{id:int}", response=TicketDetailOut, summary="A ticket with its messages")
def get_ticket(ctx: Ctx) -> dict[str, Any]:
    ticket = own_ticket(ctx, ctx.path_int("id"))
    with ctx.db.tx() as c:
        msgs = c.all(
            "SELECT m.*, u.full_name AS author_name FROM ticket_messages m LEFT JOIN users u ON u.id = m.author_id WHERE m.ticket_id = :t ORDER BY m.created_at, m.id",
            t=ticket["id"],
        )
    return {"ticket": ticket_out(ticket), "messages": [message_out(m) for m in msgs]}


@api.post("/tickets/{id:int}/messages", body=TicketReplyIn, response=TicketMessageOut, status=201, summary="Reply to a ticket")
def reply(ctx: Ctx) -> dict[str, Any]:
    b: TicketReplyIn = ctx.body
    rate_limit(ctx, "ticket-reply", 60, 3600, key=str(ctx.me["id"]))
    ticket = own_ticket(ctx, ctx.path_int("id"))
    if ticket["status"] == "closed":
        raise ApiError(409, "TICKET_CLOSED", "This ticket is closed. Open a new one if you need more help.", "هذه التذكرة مغلقة. افتح تذكرة جديدة إذا احتجت مساعدة إضافية.")
    now = utcnow()
    with ctx.db.tx() as c:
        msg = c.insert("ticket_messages", {"ticket_id": ticket["id"], "author_id": ctx.me["id"], "is_staff": False, "body": b.body, "created_at": now})
        c.update("tickets", ticket["id"], {"status": "open", "updated_at": now})
        ctx.services.notify_staff(c, emails.staff_notice(f"Client replied on ticket #{ticket['id']}", [b.body[:1000]], ctx.services.admin_link(f"/tickets/{ticket['id']}")))
    return message_out({**msg, "author_name": ctx.me["full_name"]})


@api.post("/tickets/{id:int}/close", response=TicketOut, summary="Close a ticket")
def close_ticket(ctx: Ctx) -> dict[str, Any]:
    ticket = own_ticket(ctx, ctx.path_int("id"))
    with ctx.db.tx() as c:
        updated = c.update("tickets", ticket["id"], {"status": "closed", "updated_at": utcnow()})
        audit(c, ctx.me["id"], "ticket.closed", "ticket", ticket["id"], None, ctx.ip)
    assert updated is not None
    return ticket_out(updated)


def _mask(full_name: str) -> str:
    parts = full_name.split()
    if not parts:
        return "—"
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0]}."


@api.get("/ib", response=IbOverviewOut, tags=("partners",), summary="Referral link, referred clients and commissions")
def ib_overview(ctx: Ctx) -> dict[str, Any]:
    with ctx.db.tx() as c:
        rows = c.all(
            "SELECT u.id, u.full_name, u.country, u.created_at, u.kyc_status, "
            "(SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id AND t.type = 'deposit' AND t.status = 'completed') AS deposits "
            "FROM users u WHERE u.referred_by = :me ORDER BY u.created_at DESC LIMIT 500",
            me=ctx.me["id"],
        )
        commissions = c.val(
            "SELECT COALESCE(SUM(amount_cents), 0) AS s FROM transactions WHERE user_id = :me AND type = 'ib_commission' AND status = 'completed'", me=ctx.me["id"]
        )
    referrals = []
    stats = {"registered": 0, "verified": 0, "funded": 0}
    for r in rows:
        status = "funded" if int(r["deposits"] or 0) > 0 else "verified" if r["kyc_status"] == "approved" else "registered"
        stats["registered"] += 1
        if status in ("verified", "funded"):
            stats["verified"] += 1
        if status == "funded":
            stats["funded"] += 1
        referrals.append({"id": r["id"], "name": _mask(r["full_name"]), "country": r["country"], "joined_at": r["created_at"], "status": status})
    return {"referral_code": ctx.me["referral_code"], "stats": stats, "commissions_total": money(int(commissions or 0)) or 0.0, "referrals": referrals}
