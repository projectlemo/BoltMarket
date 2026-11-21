"""Back-office endpoints for staff (role-based; two-factor authentication required by default)."""
from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, Literal

from pydantic import Field, field_validator
from starlette.responses import Response

from .. import __version__
from ..db import Conn, UniqueViolation, utcnow
from ..schemas import In, clean_email, strong_password, to_cents
from ..security import hash_password, new_referral_code
from ..serializers import account_out, kyc_doc_out, message_out, money, post_out, ticket_out, tx_out, user_out
from ..services import emails
from ..services.container import audit
from ..services.domain import (
    activate_challenge,
    approve_withdrawal,
    complete_withdrawal,
    credit_deposit,
    fmt_money,
    provision_account,
    reject_withdrawal,
    sync_account,
)
from ..services.kyc import read_document
from ..services.mt5 import Mt5Error
from ..web import Api, ApiError, Ctx, bi

api = Api("/api/v1/admin", tags=("back office",))


def staff(*perms: str) -> dict[str, Any]:
    return {"auth": "staff", "perms": perms}


def page_args(ctx: Ctx, default_size: int = 25) -> tuple[int, int]:
    return ctx.query_int("page", 1), ctx.query_int("page_size", default_size, hi=200)


def paged(c: Conn, select: str, from_where: str, order: str, params: dict[str, Any], page: int, size: int) -> dict[str, Any]:
    total = c.val(f"SELECT COUNT(*) AS n {from_where}", **params)
    rows = c.all(f"SELECT {select} {from_where} ORDER BY {order} LIMIT :lim OFFSET :off", **params, lim=size, off=(page - 1) * size)
    return {"items": rows, "total": int(total or 0), "page": page, "page_size": size}


def search_term(ctx: Ctx) -> str:
    return (ctx.query.get("q") or "").strip().lower()[:100]


def get_or_404(c: Conn, table: str, row_id: int, what: str = "Record", *, lock: bool = False) -> dict[str, Any]:
    row = c.get(table, row_id, lock=lock)
    if row is None:
        raise ApiError(404, "NOT_FOUND", f"{what} not found.", "غير موجود.")
    return row


def admin_user(u: dict[str, Any]) -> dict[str, Any]:
    return {
        **user_out(u),
        "status": u["status"],
        "kyc_rejection_reason": u["kyc_rejection_reason"],
        "kyc_submitted_at": u["kyc_submitted_at"],
        "kyc_reviewed_at": u["kyc_reviewed_at"],
        "referred_by": u["referred_by"],
        "last_login_at": u["last_login_at"],
        "locked_until": u["locked_until"],
        "updated_at": u["updated_at"],
    }


def admin_tx(t: dict[str, Any]) -> dict[str, Any]:
    return {
        **tx_out(t),
        "user_id": t["user_id"],
        "user_email": t.get("user_email"),
        "user_name": t.get("user_name"),
        "provider": t["provider"],
        "provider_ref": t["provider_ref"],
        "destination": t["destination"],
        "admin_note": t["admin_note"],
        "mt5_ticket": t["mt5_ticket"],
        "challenge_id": t["challenge_id"],
        "processed_by": t["processed_by"],
        "processed_at": t["processed_at"],
    }


def admin_account(a: dict[str, Any]) -> dict[str, Any]:
    return {**account_out(a), "user_id": a["user_id"], "user_email": a.get("user_email"), "user_name": a.get("user_name"),
            "group_name": a["group_name"], "last_error": a["last_error"], "updated_at": a["updated_at"]}


# --- overview ----------------------------------------------------------------------------------------

@api.get("/overview", **staff("users.read"), summary="Back-office dashboard figures")
def overview(ctx: Ctx) -> dict[str, Any]:
    now = utcnow()
    day = now - timedelta(days=1)
    week = now - timedelta(days=7)
    with ctx.db.tx() as c:
        q = lambda sql, **p: int(c.val(sql, **p) or 0)  # noqa: E731
        data: dict[str, Any] = {
            "clients": q("SELECT COUNT(*) AS n FROM users WHERE role = 'client'"),
            "new_clients_7d": q("SELECT COUNT(*) AS n FROM users WHERE role = 'client' AND created_at >= :w", w=week),
            "kyc_pending": q("SELECT COUNT(*) AS n FROM users WHERE kyc_status = 'pending'"),
            "withdrawals_pending": q("SELECT COUNT(*) AS n FROM transactions WHERE type = 'withdrawal' AND status = 'pending'"),
            "withdrawals_pending_amount": money(q("SELECT COALESCE(SUM(amount_cents), 0) AS n FROM transactions WHERE type = 'withdrawal' AND status = 'pending'")),
            "withdrawals_to_pay": q("SELECT COUNT(*) AS n FROM transactions WHERE type = 'withdrawal' AND status = 'processing'"),
            "deposits_to_review": q("SELECT COUNT(*) AS n FROM transactions WHERE type = 'deposit' AND status = 'processing'"),
            "deposits_24h_amount": money(q("SELECT COALESCE(SUM(amount_cents), 0) AS n FROM transactions WHERE type = 'deposit' AND status = 'completed' AND processed_at >= :d", d=day)),
            "deposits_7d_amount": money(q("SELECT COALESCE(SUM(amount_cents), 0) AS n FROM transactions WHERE type = 'deposit' AND status = 'completed' AND processed_at >= :w", w=week)),
            "accounts_pending": q("SELECT COUNT(*) AS n FROM trading_accounts WHERE status IN ('pending', 'failed')"),
            "tickets_open": q("SELECT COUNT(*) AS n FROM tickets WHERE status = 'open'"),
            "messages_new": q("SELECT COUNT(*) AS n FROM contact_messages WHERE status = 'new'"),
            "challenges_to_activate": q("SELECT COUNT(*) AS n FROM challenges WHERE status = 'pending_activation'"),
            "challenges_flagged": q("SELECT COUNT(*) AS n FROM challenges WHERE status IN ('phase1', 'phase2', 'funded') AND (breach IS NOT NULL OR note IS NOT NULL)"),
        }
        signups = c.all("SELECT created_at FROM users WHERE role = 'client' AND created_at >= :w", w=now - timedelta(days=14))
    by_day: dict[str, int] = {}
    for i in range(14):
        by_day[(now - timedelta(days=13 - i)).date().isoformat()] = 0
    for r in signups:
        key = r["created_at"].astimezone(UTC).date().isoformat()
        if key in by_day:
            by_day[key] += 1
    data["signups_14d"] = [{"date": k, "count": v} for k, v in by_day.items()]
    return data


# --- clients -----------------------------------------------------------------------------------------

@api.get("/users", **staff("users.read"), summary="Search clients and staff", query={"q": "string", "kyc": "string", "role": "string", "status": "string", "page": "integer"})
def list_users(ctx: Ctx) -> dict[str, Any]:
    page, size = page_args(ctx)
    where: list[str] = ["1 = 1"]
    params: dict[str, Any] = {}
    term = search_term(ctx)
    if term:
        where.append("(LOWER(email) LIKE :q OR LOWER(full_name) LIKE :q" + (" OR id = :qid" if term.isdigit() else "") + ")")
        params["q"] = f"%{term}%"
        if term.isdigit():
            params["qid"] = int(term)
    for key in ("kyc", "role", "status"):
        value = ctx.query.get(key)
        if value:
            column = "kyc_status" if key == "kyc" else key
            where.append(f"{column} = :{key}")
            params[key] = value[:20]
    with ctx.db.tx() as c:
        result = paged(c, "*", "FROM users WHERE " + " AND ".join(where), "created_at DESC, id DESC", params, page, size)
    result["items"] = [admin_user(u) for u in result["items"]]
    return result


class StaffCreateIn(In):
    email: str
    full_name: str = Field(min_length=3, max_length=120)
    role: Literal["support", "compliance", "finance", "admin"]
    password: str
    _email = field_validator("email")(classmethod(lambda cls, v: clean_email(v)))
    _password = field_validator("password")(classmethod(lambda cls, v: strong_password(v)))


@api.post("/users", **staff("users.role"), body=StaffCreateIn, status=201, summary="Create a staff login")
def create_staff(ctx: Ctx) -> dict[str, Any]:
    b: StaffCreateIn = ctx.body
    pw = hash_password(b.password, n=ctx.settings.scrypt_n)
    now = utcnow()
    try:
        with ctx.db.tx() as c:
            code = new_referral_code()
            while c.one("SELECT id FROM users WHERE referral_code = :r", r=code):
                code = new_referral_code()
            u = c.insert("users", {
                "email": b.email, "password_hash": pw, "full_name": b.full_name, "country": "--", "language": "en", "role": b.role,
                "status": "active", "email_verified_at": now, "token_version": 0, "totp_enabled": False, "kyc_status": "none",
                "referral_code": code, "terms_accepted_at": now, "failed_logins": 0, "created_at": now, "updated_at": now,
            })
            audit(c, ctx.me["id"], "staff.created", "user", u["id"], {"role": b.role}, ctx.ip)
    except UniqueViolation as exc:
        raise ApiError(409, "EMAIL_TAKEN", "A user with this email already exists.", "يوجد مستخدم بهذا البريد بالفعل.",
                       {"email": ("A user with this email already exists.", "يوجد مستخدم بهذا البريد بالفعل.")}) from exc
    return admin_user(u)


@api.get("/users/{id:int}", **staff("users.read"), summary="Client file")
def get_user(ctx: Ctx) -> dict[str, Any]:
    uid = ctx.path_int("id")
    with ctx.db.tx() as c:
        u = get_or_404(c, "users", uid, "User")
        accounts = c.all("SELECT * FROM trading_accounts WHERE user_id = :u ORDER BY id DESC", u=uid)
        txs = c.all("SELECT t.*, a.login AS account_login FROM transactions t LEFT JOIN trading_accounts a ON a.id = t.account_id WHERE t.user_id = :u "
                    "ORDER BY t.created_at DESC, t.id DESC LIMIT 50", u=uid)
        docs = c.all("SELECT id, user_id, doc_type, filename, content_type, size_bytes, status, rejection_reason, created_at FROM kyc_documents WHERE user_id = :u ORDER BY id", u=uid)
        notes = c.all("SELECT n.*, a.full_name AS author_name FROM user_notes n LEFT JOIN users a ON a.id = n.author_id WHERE n.user_id = :u ORDER BY n.created_at DESC", u=uid)
        tickets = c.all("SELECT * FROM tickets WHERE user_id = :u ORDER BY updated_at DESC LIMIT 20", u=uid)
        challenges = c.all("SELECT * FROM challenges WHERE user_id = :u ORDER BY id DESC", u=uid)
        referrer = c.one("SELECT id, full_name, email FROM users WHERE id = :r", r=u["referred_by"]) if u["referred_by"] else None
        referrals = int(c.val("SELECT COUNT(*) AS n FROM users WHERE referred_by = :u", u=uid) or 0)
    return {
        "user": admin_user(u),
        "accounts": [admin_account(a) for a in accounts],
        "transactions": [admin_tx(t) for t in txs],
        "documents": [{**kyc_doc_out(d), "content_type": d["content_type"], "size_bytes": d["size_bytes"]} for d in docs],
        "notes": [{"id": n["id"], "body": n["body"], "author_name": n["author_name"], "created_at": n["created_at"]} for n in notes],
        "tickets": [ticket_out(t) for t in tickets],
        "challenges": [{"id": ch["id"], "plan_size": ch["plan_size"], "status": ch["status"], "created_at": ch["created_at"]} for ch in challenges],
        "referrer": referrer,
        "referrals": referrals,
    }


class UserPatchIn(In):
    status: Literal["active", "suspended"] | None = None
    full_name: str | None = Field(default=None, min_length=3, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    country: str | None = Field(default=None, min_length=2, max_length=2)
    language: Literal["en", "ar"] | None = None
    role: Literal["client", "support", "compliance", "finance", "admin"] | None = None
    email_verified: bool | None = None


@api.patch("/users/{id:int}", **staff("users.write"), body=UserPatchIn, summary="Update a user (suspend, verify email, change role)")
def patch_user(ctx: Ctx) -> dict[str, Any]:
    b: UserPatchIn = ctx.body
    uid = ctx.path_int("id")
    fields = b.model_fields_set
    if "role" in fields and ctx.me["role"] != "admin":
        raise ApiError(403, "FORBIDDEN", "Only administrators can change roles.", "يستطيع المسؤولون فقط تغيير الأدوار.")
    if uid == ctx.me["id"] and ({"role", "status"} & fields):
        raise ApiError(409, "INVALID_STATE", "You cannot change your own role or status.", "لا يمكنك تغيير دورك أو حالتك بنفسك.")
    now = utcnow()
    with ctx.db.tx() as c:
        u = get_or_404(c, "users", uid, "User", lock=True)
        data: dict[str, Any] = {}
        for key in ("full_name", "phone", "language", "role", "status"):
            if key in fields and getattr(b, key) is not None:
                data[key] = getattr(b, key)
        if "country" in fields and b.country:
            data["country"] = b.country.upper()
        if b.email_verified is True and u["email_verified_at"] is None:
            data["email_verified_at"] = now
        if data.get("status") == "suspended" or ("role" in data and data["role"] != u["role"]):
            data["token_version"] = int(u["token_version"]) + 1
            c.exec("UPDATE refresh_tokens SET revoked_at = :now WHERE user_id = :u AND revoked_at IS NULL", now=now, u=uid)
        if data.get("status") == "active":
            data["failed_logins"], data["locked_until"] = 0, None
        u = c.update("users", uid, {**data, "updated_at": now})
        audit(c, ctx.me["id"], "user.updated", "user", uid, {k: v for k, v in data.items() if k != "token_version"}, ctx.ip)
    assert u is not None
    return admin_user(u)


@api.post("/users/{id:int}/reset-2fa", **staff("users.role"), summary="Turn off 2FA for a user who lost their device")
def reset_user_2fa(ctx: Ctx) -> dict[str, Any]:
    uid = ctx.path_int("id")
    with ctx.db.tx() as c:
        u = get_or_404(c, "users", uid, "User", lock=True)
        u = c.update("users", uid, {"totp_enabled": False, "totp_secret": None, "totp_last_step": None, "recovery_codes": None,
                                    "token_version": int(u["token_version"]) + 1, "updated_at": utcnow()})
        c.exec("UPDATE refresh_tokens SET revoked_at = :now WHERE user_id = :u AND revoked_at IS NULL", now=utcnow(), u=uid)
        audit(c, ctx.me["id"], "user.2fa_reset", "user", uid, None, ctx.ip)
    assert u is not None
    return admin_user(u)


class NoteIn(In):
    body: str = Field(min_length=2, max_length=4000)


@api.post("/users/{id:int}/notes", **staff("users.read"), body=NoteIn, status=201, summary="Add an internal note")
def add_note(ctx: Ctx) -> dict[str, Any]:
    uid = ctx.path_int("id")
    with ctx.db.tx() as c:
        get_or_404(c, "users", uid, "User")
        n = c.insert("user_notes", {"user_id": uid, "author_id": ctx.me["id"], "body": ctx.body.body.strip(), "created_at": utcnow()})
        audit(c, ctx.me["id"], "user.note_added", "user", uid, None, ctx.ip)
    return {"id": n["id"], "body": n["body"], "author_name": ctx.me["full_name"], "created_at": n["created_at"]}


# --- KYC review --------------------------------------------------------------------------------------------

@api.get("/kyc", **staff("kyc"), summary="Verification queue", query={"status": "string", "page": "integer"})
def kyc_queue(ctx: Ctx) -> dict[str, Any]:
    page, size = page_args(ctx)
    status = ctx.query.get("status") or "pending"
    with ctx.db.tx() as c:
        result = paged(
            c,
            "u.id, u.email, u.full_name, u.country, u.kyc_status, u.kyc_submitted_at, u.kyc_reviewed_at, u.created_at, "
            "(SELECT COUNT(*) FROM kyc_documents d WHERE d.user_id = u.id) AS documents",
            "FROM users u WHERE u.kyc_status = :s AND u.role = 'client'",
            "u.kyc_submitted_at ASC, u.id ASC" if status == "pending" else "u.updated_at DESC, u.id DESC",
            {"s": status[:20]}, page, size,
        )
    return result


@api.get("/kyc/{id:int}", **staff("kyc"), summary="One client's verification file")
def kyc_file(ctx: Ctx) -> dict[str, Any]:
    uid = ctx.path_int("id")
    with ctx.db.tx() as c:
        u = get_or_404(c, "users", uid, "User")
        docs = c.all("SELECT id, user_id, doc_type, filename, content_type, size_bytes, status, rejection_reason, created_at FROM kyc_documents WHERE user_id = :u ORDER BY id", u=uid)
    return {"user": admin_user(u), "provider": ctx.settings.effective_kyc_provider,
            "documents": [{**kyc_doc_out(d), "content_type": d["content_type"], "size_bytes": d["size_bytes"]} for d in docs]}


@api.get("/kyc/documents/{id:int}/file", **staff("kyc"), summary="Download a document (decrypted)")
def kyc_document_file(ctx: Ctx) -> Response:
    doc_id = ctx.path_int("id")
    with ctx.db.tx() as c:
        doc = get_or_404(c, "kyc_documents", doc_id, "Document")
        audit(c, ctx.me["id"], "kyc.document_viewed", "kyc_document", doc_id, {"user_id": doc["user_id"]}, ctx.ip)
    data = read_document(ctx.services.vault, doc)
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", doc["filename"])[:120] or "document"
    return Response(data, media_type=doc["content_type"], headers={
        "Content-Disposition": f'inline; filename="{safe}"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    })


class KycRejectIn(In):
    reason: str = Field(min_length=3, max_length=500)
    documents: dict[str, str] = Field(default_factory=dict)


@api.post("/kyc/{id:int}/approve", **staff("kyc"), summary="Approve verification")
def kyc_approve(ctx: Ctx) -> dict[str, Any]:
    uid = ctx.path_int("id")
    now = utcnow()
    with ctx.db.tx() as c:
        u = get_or_404(c, "users", uid, "User", lock=True)
        if u["kyc_status"] == "approved":
            raise ApiError(409, "INVALID_STATE", "This client is already verified.", "هذا العميل موثّق بالفعل.")
        u = c.update("users", uid, {"kyc_status": "approved", "kyc_rejection_reason": None, "kyc_reviewed_at": now, "kyc_reviewed_by": ctx.me["id"], "updated_at": now})
        assert u is not None
        c.exec("UPDATE kyc_documents SET status = 'accepted', rejection_reason = NULL, reviewed_by = :r, reviewed_at = :now WHERE user_id = :u",
               r=ctx.me["id"], now=now, u=uid)
        ctx.services.mailer.enqueue(c, u["email"], emails.kyc_result(u["language"], u["full_name"], True, None, ctx.services.portal_link("/portal", u["language"])))
        audit(c, ctx.me["id"], "kyc.approved", "user", uid, None, ctx.ip)
    return admin_user(u)


@api.post("/kyc/{id:int}/reject", **staff("kyc"), body=KycRejectIn, summary="Reject verification with a reason")
def kyc_reject(ctx: Ctx) -> dict[str, Any]:
    b: KycRejectIn = ctx.body
    uid = ctx.path_int("id")
    now = utcnow()
    with ctx.db.tx() as c:
        u = get_or_404(c, "users", uid, "User", lock=True)
        u = c.update("users", uid, {"kyc_status": "rejected", "kyc_rejection_reason": b.reason.strip(), "kyc_reviewed_at": now, "kyc_reviewed_by": ctx.me["id"], "updated_at": now})
        assert u is not None
        for doc_id, reason in b.documents.items():
            if str(doc_id).isdigit() and reason.strip():
                c.exec("UPDATE kyc_documents SET status = 'rejected', rejection_reason = :r, reviewed_by = :by, reviewed_at = :now WHERE id = :id AND user_id = :u",
                       r=reason.strip()[:300], by=ctx.me["id"], now=now, id=int(doc_id), u=uid)
        ctx.services.mailer.enqueue(c, u["email"], emails.kyc_result(u["language"], u["full_name"], False, b.reason.strip(),
                                                                       ctx.services.portal_link("/portal/verification", u["language"])))
        audit(c, ctx.me["id"], "kyc.rejected", "user", uid, {"reason": b.reason}, ctx.ip)
    return admin_user(u)


# --- money ---------------------------------------------------------------------------------------------------

TX_SELECT = "t.*, a.login AS account_login, u.email AS user_email, u.full_name AS user_name"
TX_FROM = "FROM transactions t LEFT JOIN trading_accounts a ON a.id = t.account_id JOIN users u ON u.id = t.user_id"


@api.get("/transactions", **staff("finance"), summary="Deposits, withdrawals and adjustments",
         query={"type": "string", "status": "string", "q": "string", "page": "integer"})
def list_transactions(ctx: Ctx) -> dict[str, Any]:
    page, size = page_args(ctx)
    where: list[str] = ["1 = 1"]
    params: dict[str, Any] = {}
    for key in ("type", "status"):
        value = ctx.query.get(key)
        if value:
            where.append(f"t.{key} = :{key}")
            params[key] = value[:20]
    term = search_term(ctx)
    if term:
        where.append("(LOWER(u.email) LIKE :q OR LOWER(u.full_name) LIKE :q OR a.login = :raw" + (" OR t.id = :qid" if term.isdigit() else "") + ")")
        params.update(q=f"%{term}%", raw=term)
        if term.isdigit():
            params["qid"] = int(term)
    with ctx.db.tx() as c:
        result = paged(c, TX_SELECT, f"{TX_FROM} WHERE " + " AND ".join(where), "t.created_at DESC, t.id DESC", params, page, size)
    result["items"] = [admin_tx(t) for t in result["items"]]
    return result


def load_tx(ctx: Ctx, tx_id: int) -> dict[str, Any]:
    with ctx.db.tx() as c:
        row = c.one(f"SELECT {TX_SELECT} {TX_FROM} WHERE t.id = :id", id=tx_id)
    if row is None:
        raise ApiError(404, "NOT_FOUND", "Transaction not found.", "المعاملة غير موجودة.")
    return admin_tx(row)


@api.get("/transactions/{id:int}", **staff("finance"), summary="One transaction")
def get_transaction(ctx: Ctx) -> dict[str, Any]:
    return load_tx(ctx, ctx.path_int("id"))


@api.post("/transactions/{id:int}/approve", **staff("finance"), summary="Approve a withdrawal (debits MT5 when connected)")
def approve_tx(ctx: Ctx) -> dict[str, Any]:
    approve_withdrawal(ctx.services, ctx.path_int("id"), ctx.me, ctx.ip)
    return load_tx(ctx, ctx.path_int("id"))


class CompleteIn(In):
    reference: str | None = Field(default=None, max_length=200)


@api.post("/transactions/{id:int}/complete", **staff("finance"), body=CompleteIn, summary="Mark a withdrawal paid, or a manually credited deposit completed")
def complete_tx(ctx: Ctx) -> dict[str, Any]:
    tx_id = ctx.path_int("id")
    b: CompleteIn = ctx.body
    with ctx.db.tx() as c:
        t = get_or_404(c, "transactions", tx_id, "Transaction")
    if t["type"] == "withdrawal":
        complete_withdrawal(ctx.services, tx_id, ctx.me, (b.reference or "").strip() or None, ctx.ip)
    elif t["type"] == "deposit":
        if t["status"] != "processing":
            raise ApiError(409, "INVALID_STATE", "Only deposits waiting for manual credit can be completed here.", "يمكن إكمال الإيداعات المنتظرة للإضافة اليدوية فقط.")
        with ctx.db.tx() as c:
            t = c.update("transactions", tx_id, {"status": "completed", "mt5_ticket": (b.reference or "").strip() or "manual", "processed_by": ctx.me["id"],
                                                  "processed_at": utcnow(), "admin_note": None, "updated_at": utcnow()})
            assert t is not None
            user = c.get("users", t["user_id"])
            acc = c.get("trading_accounts", t["account_id"]) if t["account_id"] else None
            assert user is not None
            ctx.services.mailer.enqueue(c, user["email"], emails.deposit_completed(user["language"], user["full_name"], fmt_money(t["amount_cents"], t["currency"]),
                                                                                     acc["login"] if acc else "—"))
            audit(c, ctx.me["id"], "deposit.completed_manually", "transaction", tx_id, {"reference": b.reference}, ctx.ip)
    else:
        raise ApiError(409, "INVALID_STATE", "This transaction cannot be completed here.", "لا يمكن إكمال هذه المعاملة من هنا.")
    return load_tx(ctx, tx_id)


@api.post("/transactions/{id:int}/retry-credit", **staff("finance"), summary="Retry crediting a paid deposit to MT5")
def retry_credit(ctx: Ctx) -> dict[str, Any]:
    tx_id = ctx.path_int("id")
    if not ctx.services.mt5.enabled:
        raise ApiError(409, "MT5_DISABLED", "MT5 is not connected. Credit the account manually and mark it completed.", "ميتاتريدر 5 غير متصل.")
    with ctx.db.tx() as c:
        t = get_or_404(c, "transactions", tx_id, "Transaction")
        if t["type"] != "deposit" or t["status"] != "processing":
            raise ApiError(409, "INVALID_STATE", "Only paid deposits waiting for credit can be retried.", "يمكن إعادة محاولة الإيداعات المدفوعة المنتظرة فقط.")
        c.update("transactions", tx_id, {"credit_started_at": None})
    credit_deposit(ctx.services, tx_id)
    return load_tx(ctx, tx_id)


class RejectIn(In):
    reason: str = Field(min_length=3, max_length=500)


@api.post("/transactions/{id:int}/reject", **staff("finance"), body=RejectIn, summary="Reject a withdrawal or a flagged deposit")
def reject_tx(ctx: Ctx) -> dict[str, Any]:
    tx_id = ctx.path_int("id")
    reason = ctx.body.reason.strip()
    with ctx.db.tx() as c:
        t = get_or_404(c, "transactions", tx_id, "Transaction")
    if t["type"] == "withdrawal":
        reject_withdrawal(ctx.services, tx_id, ctx.me, reason, ctx.ip)
    elif t["type"] in ("deposit", "funded_fee") and t["status"] in ("pending", "awaiting_payment", "processing"):
        with ctx.db.tx() as c:
            c.update("transactions", tx_id, {"status": "rejected", "note": reason, "processed_by": ctx.me["id"], "processed_at": utcnow(), "updated_at": utcnow()})
            audit(c, ctx.me["id"], f"{t['type']}.rejected", "transaction", tx_id, {"reason": reason}, ctx.ip)
    else:
        raise ApiError(409, "INVALID_STATE", "This transaction is already closed.", "هذه المعاملة مغلقة بالفعل.")
    return load_tx(ctx, tx_id)


class AdjustmentIn(In):
    account_id: int
    amount: float
    type: Literal["adjustment", "ib_commission"] = "adjustment"
    note: str = Field(min_length=3, max_length=300)

    @field_validator("amount")
    @classmethod
    def _amount(cls, v: float) -> float:
        to_cents(abs(v))
        return v


@api.post("/adjustments", **staff("finance"), body=AdjustmentIn, status=201, summary="Balance correction or IB commission payout")
def create_adjustment(ctx: Ctx) -> dict[str, Any]:
    b: AdjustmentIn = ctx.body
    cents = to_cents(abs(b.amount)) * (1 if b.amount > 0 else -1)
    if b.type == "ib_commission" and cents < 0:
        raise ApiError(422, "VALIDATION_ERROR", "Commissions must be positive.", "يجب أن تكون العمولات موجبة.", {"amount": bi("Must be positive.", "يجب أن يكون موجبًا.")})
    with ctx.db.tx() as c:
        acc = get_or_404(c, "trading_accounts", b.account_id, "Account")
    ticket = None
    if ctx.services.mt5.enabled and acc["login"] and acc["status"] == "active":
        try:
            ticket = ctx.services.mt5.balance(acc["login"], Decimal(cents) / 100, ("IB commission" if b.type == "ib_commission" else "Adjustment"))
        except Mt5Error as exc:
            raise ApiError(502, "MT5_ERROR", f"MT5 rejected the operation: {exc}", f"رفض ميتاتريدر 5 العملية: {exc}") from exc
    now = utcnow()
    with ctx.db.tx() as c:
        t = c.insert("transactions", {
            "user_id": acc["user_id"], "account_id": acc["id"], "type": b.type, "method": "internal", "amount_cents": cents, "currency": acc["currency"],
            "status": "completed", "note": b.note.strip(), "mt5_ticket": ticket or "manual", "processed_by": ctx.me["id"], "processed_at": now,
            "created_at": now, "updated_at": now,
        })
        audit(c, ctx.me["id"], f"{b.type}.created", "transaction", t["id"], {"amount_cents": cents, "mt5_ticket": ticket}, ctx.ip)
    sync_account(ctx.services, acc["id"])
    return load_tx(ctx, t["id"])


# --- trading accounts -----------------------------------------------------------------------------------------------

@api.get("/accounts", **staff("finance"), summary="MT5 accounts", query={"status": "string", "kind": "string", "q": "string", "page": "integer"})
def list_accounts(ctx: Ctx) -> dict[str, Any]:
    page, size = page_args(ctx)
    where: list[str] = ["1 = 1"]
    params: dict[str, Any] = {}
    for key in ("status", "kind"):
        value = ctx.query.get(key)
        if value:
            where.append(f"a.{key} = :{key}")
            params[key] = value[:20]
    term = search_term(ctx)
    if term:
        where.append("(LOWER(u.email) LIKE :q OR LOWER(u.full_name) LIKE :q OR a.login = :raw)")
        params.update(q=f"%{term}%", raw=term)
    with ctx.db.tx() as c:
        result = paged(c, "a.*, u.email AS user_email, u.full_name AS user_name", "FROM trading_accounts a JOIN users u ON u.id = a.user_id WHERE " + " AND ".join(where),
                       "a.created_at DESC, a.id DESC", params, page, size)
    result["items"] = [admin_account(a) for a in result["items"]]
    return result


def load_account(ctx: Ctx, account_id: int) -> dict[str, Any]:
    with ctx.db.tx() as c:
        row = c.one("SELECT a.*, u.email AS user_email, u.full_name AS user_name FROM trading_accounts a JOIN users u ON u.id = a.user_id WHERE a.id = :id", id=account_id)
    if row is None:
        raise ApiError(404, "NOT_FOUND", "Account not found.", "الحساب غير موجود.")
    return admin_account(row)


@api.post("/accounts/{id:int}/provision", **staff("finance"), summary="Create the MT5 account now (retry)")
def provision(ctx: Ctx) -> dict[str, Any]:
    account_id = ctx.path_int("id")
    if not ctx.services.mt5.enabled:
        raise ApiError(409, "MT5_DISABLED", "MT5 is not connected. Create the account in MT5 and link its login instead.", "ميتاتريدر 5 غير متصل.")
    try:
        provision_account(ctx.services, account_id)
    except Mt5Error as exc:
        raise ApiError(502, "MT5_ERROR", f"MT5 rejected the request: {exc}", f"رفض ميتاتريدر 5 الطلب: {exc}") from exc
    with ctx.db.tx() as c:
        audit(c, ctx.me["id"], "account.provision_retry", "trading_account", account_id, None, ctx.ip)
    return load_account(ctx, account_id)


class LinkIn(In):
    login: str = Field(min_length=3, max_length=20, pattern=r"^[0-9]+$")
    server: str | None = Field(default=None, max_length=100)


@api.post("/accounts/{id:int}/link", **staff("finance"), body=LinkIn, summary="Record an account created by hand in MT5")
def link_account(ctx: Ctx) -> dict[str, Any]:
    b: LinkIn = ctx.body
    account_id = ctx.path_int("id")
    now = utcnow()
    try:
        with ctx.db.tx() as c:
            acc = get_or_404(c, "trading_accounts", account_id, "Account", lock=True)
            if acc["status"] == "active" and acc["login"]:
                raise ApiError(409, "INVALID_STATE", "This account is already linked.", "هذا الحساب مرتبط بالفعل.")
            server = (b.server or "").strip() or (ctx.settings.mt5_server_live if acc["kind"] == "live" else ctx.settings.mt5_server_demo) or None
            acc = c.update("trading_accounts", account_id, {"login": b.login, "server": server, "status": "active", "last_error": None, "updated_at": now})
            assert acc is not None
            user = c.get("users", acc["user_id"])
            assert user is not None
            ctx.services.mailer.enqueue(c, user["email"], emails.account_ready(user["language"], user["full_name"], acc["kind"], b.login, server or "",
                                                                                 ctx.services.portal_link("/portal/accounts", user["language"])))
            audit(c, ctx.me["id"], "account.linked", "trading_account", account_id, {"login": b.login}, ctx.ip)
    except UniqueViolation as exc:
        raise ApiError(409, "LOGIN_TAKEN", "Another account already uses this login.", "يستخدم حساب آخر رقم الدخول هذا.") from exc
    return load_account(ctx, account_id)


class AccountStatusIn(In):
    status: Literal["active", "disabled"]


@api.post("/accounts/{id:int}/status", **staff("finance"), body=AccountStatusIn, summary="Enable or disable an account")
def account_status(ctx: Ctx) -> dict[str, Any]:
    account_id = ctx.path_int("id")
    target = ctx.body.status
    with ctx.db.tx() as c:
        acc = get_or_404(c, "trading_accounts", account_id, "Account")
    if not acc["login"]:
        raise ApiError(409, "INVALID_STATE", "Link or provision the account first.", "اربط الحساب أو أنشئه أولًا.")
    if ctx.services.mt5.enabled:
        try:
            ctx.services.mt5.set_enabled(acc["login"], target == "active")
        except Mt5Error as exc:
            raise ApiError(502, "MT5_ERROR", f"MT5 rejected the change: {exc}", f"رفض ميتاتريدر 5 التغيير: {exc}") from exc
    with ctx.db.tx() as c:
        c.update("trading_accounts", account_id, {"status": target, "updated_at": utcnow()})
        audit(c, ctx.me["id"], f"account.{target}", "trading_account", account_id, None, ctx.ip)
    return load_account(ctx, account_id)


@api.post("/accounts/{id:int}/sync", **staff("finance"), summary="Refresh balance from MT5")
def account_sync(ctx: Ctx) -> dict[str, Any]:
    account_id = ctx.path_int("id")
    sync_account(ctx.services, account_id)
    return load_account(ctx, account_id)


# --- Bolt Funded ---------------------------------------------------------------------------------------------------

def admin_challenge(ch: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": ch["id"], "user_id": ch["user_id"], "user_email": ch.get("user_email"), "user_name": ch.get("user_name"), "plan_size": ch["plan_size"],
        "fee": money(ch["fee_cents"]), "status": ch["status"], "account_id": ch["account_id"], "login": ch.get("login"),
        "equity": money(ch.get("equity_cents")), "note": ch["note"], "breach": ch["breach"], "created_at": ch["created_at"], "updated_at": ch["updated_at"],
    }


CH_SELECT = "ch.*, u.email AS user_email, u.full_name AS user_name, a.login AS login, a.equity_cents AS equity_cents"
CH_FROM = "FROM challenges ch JOIN users u ON u.id = ch.user_id LEFT JOIN trading_accounts a ON a.id = ch.account_id"


@api.get("/challenges", **staff("finance"), summary="Bolt Funded evaluations", query={"status": "string", "page": "integer"})
def list_challenges(ctx: Ctx) -> dict[str, Any]:
    page, size = page_args(ctx)
    where: list[str] = ["1 = 1"]
    params: dict[str, Any] = {}
    if ctx.query.get("status"):
        where.append("ch.status = :s")
        params["s"] = ctx.query.get("status", "")[:30]
    with ctx.db.tx() as c:
        result = paged(c, CH_SELECT, f"{CH_FROM} WHERE " + " AND ".join(where), "ch.updated_at DESC, ch.id DESC", params, page, size)
    result["items"] = [admin_challenge(ch) for ch in result["items"]]
    return result


def load_challenge(ctx: Ctx, ch_id: int) -> dict[str, Any]:
    with ctx.db.tx() as c:
        row = c.one(f"SELECT {CH_SELECT} {CH_FROM} WHERE ch.id = :id", id=ch_id)
    if row is None:
        raise ApiError(404, "NOT_FOUND", "Challenge not found.", "التحدي غير موجود.")
    return admin_challenge(row)


@api.get("/challenges/{id:int}", **staff("finance"), summary="One evaluation")
def get_challenge(ctx: Ctx) -> dict[str, Any]:
    return load_challenge(ctx, ctx.path_int("id"))


class ActivateIn(In):
    login: str | None = Field(default=None, max_length=20, pattern=r"^[0-9]*$")
    server: str | None = Field(default=None, max_length=100)


@api.post("/challenges/{id:int}/activate", **staff("finance"), body=ActivateIn, summary="Start Phase 1 (create or link the account)")
def activate(ctx: Ctx) -> dict[str, Any]:
    ch_id = ctx.path_int("id")
    b: ActivateIn = ctx.body
    with ctx.db.tx() as c:
        ch = get_or_404(c, "challenges", ch_id, "Challenge")
    if ch["status"] != "pending_activation":
        raise ApiError(409, "INVALID_STATE", "Only paid evaluations waiting for activation can be started.", "يمكن تفعيل التقييمات المدفوعة المنتظرة فقط.")
    if not b.login and not ctx.services.mt5.enabled:
        raise ApiError(422, "VALIDATION_ERROR", "Enter the MT5 login you created.", "أدخل رقم حساب ميتاتريدر 5 الذي أنشأته.", {"login": bi("Required while MT5 is not connected.", "مطلوب ما دام ميتاتريدر 5 غير متصل.")})
    try:
        activate_challenge(ctx.services, ch_id, login=b.login or None, server=b.server)
    except UniqueViolation as exc:
        raise ApiError(409, "LOGIN_TAKEN", "Another account already uses this login.", "يستخدم حساب آخر رقم الدخول هذا.") from exc
    with ctx.db.tx() as c:
        audit(c, ctx.me["id"], "challenge.activate", "challenge", ch_id, {"login": b.login}, ctx.ip)
    return load_challenge(ctx, ch_id)


class ChallengeStatusIn(In):
    status: Literal["phase2", "funded", "failed", "cancelled"]
    note: str | None = Field(default=None, max_length=300)


@api.post("/challenges/{id:int}/status", **staff("finance"), body=ChallengeStatusIn, summary="Move an evaluation to the next stage or end it")
def challenge_status(ctx: Ctx) -> dict[str, Any]:
    ch_id = ctx.path_int("id")
    b: ChallengeStatusIn = ctx.body
    allowed = {"phase2": ("phase1",), "funded": ("phase2",), "failed": ("phase1", "phase2", "funded"), "cancelled": ("awaiting_payment", "pending_activation", "phase1", "phase2")}
    with ctx.db.tx() as c:
        ch = get_or_404(c, "challenges", ch_id, "Challenge", lock=True)
        if ch["status"] not in allowed[b.status]:
            raise ApiError(409, "INVALID_STATE", f"Cannot move from {ch['status']} to {b.status}.", "لا يمكن الانتقال إلى هذه المرحلة.")
        ch = c.update("challenges", ch_id, {"status": b.status, "note": b.note, "breach": None if b.status in ("phase2", "funded") else ch["breach"], "updated_at": utcnow()})
        assert ch is not None
        user = c.get("users", ch["user_id"])
        assert user is not None
        ctx.services.mailer.enqueue(c, user["email"], emails.challenge_update(user["language"], user["full_name"], f"${ch['plan_size']:,}", b.status,
                                                                              ctx.services.portal_link("/portal/funded", user["language"])))
        audit(c, ctx.me["id"], f"challenge.{b.status}", "challenge", ch_id, {"note": b.note}, ctx.ip)
    return load_challenge(ctx, ch_id)


# --- support ----------------------------------------------------------------------------------------------------------

@api.get("/tickets", **staff("support"), summary="Support tickets", query={"status": "string", "q": "string", "page": "integer"})
def list_tickets(ctx: Ctx) -> dict[str, Any]:
    page, size = page_args(ctx)
    where: list[str] = ["1 = 1"]
    params: dict[str, Any] = {}
    if ctx.query.get("status"):
        where.append("t.status = :s")
        params["s"] = ctx.query.get("status", "")[:20]
    term = search_term(ctx)
    if term:
        where.append("(LOWER(t.subject) LIKE :q OR LOWER(u.email) LIKE :q" + (" OR t.id = :qid" if term.isdigit() else "") + ")")
        params["q"] = f"%{term}%"
        if term.isdigit():
            params["qid"] = int(term)
    with ctx.db.tx() as c:
        result = paged(c, "t.*, u.email AS user_email, u.full_name AS user_name", "FROM tickets t JOIN users u ON u.id = t.user_id WHERE " + " AND ".join(where),
                       "t.updated_at DESC, t.id DESC", params, page, size)
    result["items"] = [{**ticket_out(t), "user_id": t["user_id"], "user_email": t["user_email"], "user_name": t["user_name"]} for t in result["items"]]
    return result


@api.get("/tickets/{id:int}", **staff("support"), summary="Ticket thread")
def get_ticket(ctx: Ctx) -> dict[str, Any]:
    tid = ctx.path_int("id")
    with ctx.db.tx() as c:
        t = c.one("SELECT t.*, u.email AS user_email, u.full_name AS user_name, u.language AS user_language FROM tickets t JOIN users u ON u.id = t.user_id WHERE t.id = :id", id=tid)
        if t is None:
            raise ApiError(404, "NOT_FOUND", "Ticket not found.", "التذكرة غير موجودة.")
        msgs = c.all("SELECT m.*, u.full_name AS author_name FROM ticket_messages m LEFT JOIN users u ON u.id = m.author_id WHERE m.ticket_id = :t ORDER BY m.created_at, m.id", t=tid)
    return {
        "ticket": {**ticket_out(t), "user_id": t["user_id"], "user_email": t["user_email"], "user_name": t["user_name"], "user_language": t["user_language"]},
        "messages": [{**message_out(m, staff_name=m.get("author_name") or "Support"), "author_name": m.get("author_name") or ""} for m in msgs],
    }


class StaffReplyIn(In):
    body: str = Field(min_length=2, max_length=5000)


@api.post("/tickets/{id:int}/messages", **staff("support"), body=StaffReplyIn, status=201, summary="Reply as support")
def staff_reply(ctx: Ctx) -> dict[str, Any]:
    tid = ctx.path_int("id")
    now = utcnow()
    with ctx.db.tx() as c:
        t = get_or_404(c, "tickets", tid, "Ticket", lock=True)
        msg = c.insert("ticket_messages", {"ticket_id": tid, "author_id": ctx.me["id"], "is_staff": True, "body": ctx.body.body.strip(), "created_at": now})
        c.update("tickets", tid, {"status": "answered", "updated_at": now})
        user = c.get("users", t["user_id"])
        assert user is not None
        ctx.services.mailer.enqueue(c, user["email"], emails.ticket_reply(user["language"], user["full_name"], t["subject"],
                                                                            ctx.services.portal_link(f"/portal/support/{tid}", user["language"])))
        audit(c, ctx.me["id"], "ticket.replied", "ticket", tid, None, ctx.ip)
    return {**message_out(msg), "author_name": ctx.me["full_name"]}


class TicketStatusIn(In):
    status: Literal["open", "closed"]


@api.post("/tickets/{id:int}/status", **staff("support"), body=TicketStatusIn, summary="Close or reopen a ticket")
def ticket_status(ctx: Ctx) -> dict[str, Any]:
    tid = ctx.path_int("id")
    with ctx.db.tx() as c:
        get_or_404(c, "tickets", tid, "Ticket")
        t = c.update("tickets", tid, {"status": ctx.body.status, "updated_at": utcnow()})
        audit(c, ctx.me["id"], f"ticket.{ctx.body.status}", "ticket", tid, None, ctx.ip)
    assert t is not None
    return ticket_out(t)


@api.get("/messages", **staff("support"), summary="Contact form messages", query={"status": "string", "page": "integer"})
def list_messages(ctx: Ctx) -> dict[str, Any]:
    page, size = page_args(ctx)
    where: list[str] = ["1 = 1"]
    params: dict[str, Any] = {}
    if ctx.query.get("status"):
        where.append("status = :s")
        params["s"] = ctx.query.get("status", "")[:20]
    with ctx.db.tx() as c:
        result = paged(c, "id, name, email, topic, subject, message, language, status, handled_at, created_at", "FROM contact_messages WHERE " + " AND ".join(where),
                       "created_at DESC, id DESC", params, page, size)
    return result


MESSAGE_FIELDS = ("id", "name", "email", "topic", "subject", "message", "language", "status", "handled_at", "created_at")


@api.get("/messages/{id:int}", **staff("support"), summary="One contact message")
def get_message(ctx: Ctx) -> dict[str, Any]:
    with ctx.db.tx() as c:
        m = get_or_404(c, "contact_messages", ctx.path_int("id"), "Message")
    return {k: m[k] for k in MESSAGE_FIELDS}


class MessageStatusIn(In):
    status: Literal["new", "handled"]


@api.post("/messages/{id:int}/status", **staff("support"), body=MessageStatusIn, summary="Mark a message handled")
def message_status(ctx: Ctx) -> dict[str, Any]:
    mid = ctx.path_int("id")
    handled = ctx.body.status == "handled"
    with ctx.db.tx() as c:
        get_or_404(c, "contact_messages", mid, "Message")
        m = c.update("contact_messages", mid, {"status": ctx.body.status, "handled_by": ctx.me["id"] if handled else None, "handled_at": utcnow() if handled else None})
        audit(c, ctx.me["id"], f"contact.{ctx.body.status}", "contact_message", mid, None, ctx.ip)
    assert m is not None
    return {k: m[k] for k in MESSAGE_FIELDS}


# --- blog CMS ----------------------------------------------------------------------------------------------------------

SLUG = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class PostIn(In):
    slug: str = Field(min_length=3, max_length=120, pattern=SLUG)
    language: Literal["en", "ar"]
    category: Literal["learn", "insights"]
    title: str = Field(min_length=5, max_length=200)
    excerpt: str = Field(min_length=10, max_length=400)
    body_md: str = Field(min_length=50, max_length=100_000)
    status: Literal["draft", "published"] = "draft"
    published_at: datetime | None = None


class PostPatchIn(In):
    slug: str | None = Field(default=None, min_length=3, max_length=120, pattern=SLUG)
    category: Literal["learn", "insights"] | None = None
    title: str | None = Field(default=None, min_length=5, max_length=200)
    excerpt: str | None = Field(default=None, min_length=10, max_length=400)
    body_md: str | None = Field(default=None, min_length=50, max_length=100_000)
    status: Literal["draft", "published"] | None = None
    published_at: datetime | None = None


def admin_post(p: dict[str, Any], *, with_body: bool = True) -> dict[str, Any]:
    out = {**post_out({**p, "published_at": p["published_at"] or p["created_at"]}, with_body=with_body), "id": p["id"], "status": p["status"],
           "published_at": p["published_at"], "created_at": p["created_at"], "updated_at": p["updated_at"], "author_id": p["author_id"]}
    return out


def _aware(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


@api.get("/posts", **staff("content"), summary="Blog posts", query={"lang": "string", "status": "string", "q": "string", "page": "integer"})
def list_posts(ctx: Ctx) -> dict[str, Any]:
    page, size = page_args(ctx, 50)
    where: list[str] = ["1 = 1"]
    params: dict[str, Any] = {}
    if ctx.query.get("lang") in ("en", "ar"):
        where.append("language = :lang")
        params["lang"] = ctx.query.get("lang")
    if ctx.query.get("status") in ("draft", "published"):
        where.append("status = :s")
        params["s"] = ctx.query.get("status")
    term = search_term(ctx)
    if term:
        where.append("(LOWER(title) LIKE :q OR slug LIKE :q)")
        params["q"] = f"%{term}%"
    with ctx.db.tx() as c:
        result = paged(c, "*", "FROM posts WHERE " + " AND ".join(where), "updated_at DESC, id DESC", params, page, size)
    result["items"] = [admin_post(p, with_body=False) for p in result["items"]]
    return result


@api.get("/posts/{id:int}", **staff("content"), summary="One post")
def get_post(ctx: Ctx) -> dict[str, Any]:
    with ctx.db.tx() as c:
        return admin_post(get_or_404(c, "posts", ctx.path_int("id"), "Post"))


def _slug_taken() -> ApiError:
    return ApiError(409, "SLUG_TAKEN", "A post with this address already exists in this language.", "يوجد مقال بهذا العنوان في هذه اللغة.",
                    {"slug": ("Already used in this language.", "مستخدم بالفعل في هذه اللغة.")})


@api.post("/posts", **staff("content"), body=PostIn, status=201, summary="Create a post")
def create_post(ctx: Ctx) -> dict[str, Any]:
    b: PostIn = ctx.body
    now = utcnow()
    published_at = _aware(b.published_at) or (now if b.status == "published" else None)
    try:
        with ctx.db.tx() as c:
            p = c.insert("posts", {"slug": b.slug, "language": b.language, "category": b.category, "title": b.title.strip(), "excerpt": b.excerpt.strip(),
                                   "body_md": b.body_md, "status": b.status, "published_at": published_at, "author_id": ctx.me["id"], "created_at": now, "updated_at": now})
            audit(c, ctx.me["id"], "post.created", "post", p["id"], {"slug": b.slug, "status": b.status}, ctx.ip)
    except UniqueViolation as exc:
        raise _slug_taken() from exc
    if b.status == "published":
        ctx.services.trigger_site_rebuild(f"published {b.slug}")
    return admin_post(p)


@api.patch("/posts/{id:int}", **staff("content"), body=PostPatchIn, summary="Edit, publish or unpublish a post")
def update_post(ctx: Ctx) -> dict[str, Any]:
    b: PostPatchIn = ctx.body
    pid = ctx.path_int("id")
    data = {k: getattr(b, k) for k in b.model_fields_set if getattr(b, k) is not None}
    if "published_at" in data:
        data["published_at"] = _aware(data["published_at"])
    try:
        with ctx.db.tx() as c:
            before = get_or_404(c, "posts", pid, "Post", lock=True)
            if data.get("status") == "published" and not before["published_at"] and "published_at" not in data:
                data["published_at"] = utcnow()
            p = c.update("posts", pid, {**data, "updated_at": utcnow()})
            assert p is not None
            audit(c, ctx.me["id"], "post.updated", "post", pid, {"fields": sorted(data)}, ctx.ip)
    except UniqueViolation as exc:
        raise _slug_taken() from exc
    if before["status"] == "published" or p["status"] == "published":
        ctx.services.trigger_site_rebuild(f"updated {p['slug']}")
    return admin_post(p)


@api.delete("/posts/{id:int}", **staff("content"), summary="Delete a post")
def delete_post(ctx: Ctx) -> None:
    pid = ctx.path_int("id")
    with ctx.db.tx() as c:
        p = get_or_404(c, "posts", pid, "Post")
        c.exec("DELETE FROM posts WHERE id = :id", id=pid)
        audit(c, ctx.me["id"], "post.deleted", "post", pid, {"slug": p["slug"]}, ctx.ip)
    if p["status"] == "published":
        ctx.services.trigger_site_rebuild(f"deleted {p['slug']}")


# --- audit & system -------------------------------------------------------------------------------------------------------

@api.get("/audit", **staff("audit"), summary="Audit trail", query={"action": "string", "target_type": "string", "target_id": "string", "actor": "integer", "page": "integer"})
def audit_log(ctx: Ctx) -> dict[str, Any]:
    page, size = page_args(ctx, 50)
    where: list[str] = ["1 = 1"]
    params: dict[str, Any] = {}
    if ctx.query.get("action"):
        where.append("l.action LIKE :action")
        params["action"] = ctx.query.get("action", "")[:60] + "%"
    if ctx.query.get("target_type"):
        where.append("l.target_type = :tt")
        params["tt"] = ctx.query.get("target_type", "")[:40]
    if ctx.query.get("target_id"):
        where.append("l.target_id = :tid")
        params["tid"] = ctx.query.get("target_id", "")[:40]
    if (ctx.query.get("actor") or "").isdigit():
        where.append("l.actor_id = :actor")
        params["actor"] = int(ctx.query.get("actor", "0"))
    with ctx.db.tx() as c:
        result = paged(c, "l.*, u.email AS actor_email", "FROM audit_log l LEFT JOIN users u ON u.id = l.actor_id WHERE " + " AND ".join(where),
                       "l.created_at DESC, l.id DESC", params, page, size)
    return result


@api.get("/system", **staff("system"), summary="Integration status (no secrets)")
def system(ctx: Ctx) -> dict[str, Any]:
    s = ctx.settings
    sv = ctx.services
    with ctx.db.tx() as c:
        outbox = {r["status"]: int(r["n"]) for r in c.all("SELECT status, COUNT(*) AS n FROM email_outbox GROUP BY status")}
        migrations = [r["version"] for r in c.all("SELECT version FROM schema_migrations ORDER BY version")]
    return {
        "version": __version__,
        "environment": s.environment,
        "database": sv.db.dialect,
        "migrations": migrations,
        "registration_open": s.registration_open,
        "restricted_countries": s.restricted_countries,
        "mt5": {"mode": sv.mt5.name, "enabled": sv.mt5.enabled, "server_live": s.mt5_server_live or None, "server_demo": s.mt5_server_demo or None},
        "quotes": {"mode": s.quotes_mode, "symbols": len(sv.quotes.symbols), "live_symbols": len(sv.quotes.snapshot()), "clients": sv.quotes.clients,
                   "last_update": datetime.fromtimestamp(sv.quotes.last_update, UTC) if sv.quotes.last_update else None},
        "payments": {"card_stripe": s.stripe_enabled, "crypto_nowpayments": s.nowpayments_enabled, "nowpayments_sandbox": s.nowpayments_sandbox},
        "kyc": {"provider": s.effective_kyc_provider, "storage": s.kyc_storage, "require_for_deposit": s.require_kyc_for_deposit},
        "email": {"smtp": s.smtp_enabled, "support_inbox": bool(s.support_inbox), "outbox": outbox},
        "security": {"admin_require_2fa": s.admin_require_2fa, "api_docs": s.api_docs, "data_key_set": bool(s.data_key)},
        "site_rebuild": bool(s.github_dispatch_token and s.github_repository),
    }


@api.post("/system/outbox/retry", **staff("system"), summary="Retry failed emails")
def retry_outbox(ctx: Ctx) -> dict[str, Any]:
    with ctx.db.tx() as c:
        n = c.exec("UPDATE email_outbox SET status = 'pending', attempts = 0, next_attempt_at = NULL WHERE status IN ('failed', 'disabled')")
        audit(c, ctx.me["id"], "system.outbox_retry", None, None, {"count": n}, ctx.ip)
    ctx.services.mailer.kick()
    return {"requeued": n}
