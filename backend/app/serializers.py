"""Database rows -> API shapes (kept in one place so the frontend contract is easy to review)."""
from __future__ import annotations

from typing import Any

from .web import permissions_for


def money(cents: int | None) -> float | None:
    return None if cents is None else round(int(cents) / 100, 2)


def user_out(u: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": u["id"],
        "email": u["email"],
        "full_name": u["full_name"],
        "phone": u["phone"],
        "country": u["country"],
        "language": u["language"],
        "role": u["role"],
        "email_verified": u["email_verified_at"] is not None,
        "totp_enabled": bool(u["totp_enabled"]),
        "kyc_status": u["kyc_status"],
        "referral_code": u["referral_code"],
        "created_at": u["created_at"],
        "permissions": permissions_for(u["role"]) if u["role"] != "client" else [],
    }


def account_out(a: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": a["id"],
        "kind": a["kind"],
        "account_type": a["account_type"],
        "login": a["login"],
        "server": a["server"],
        "leverage": a["leverage"],
        "currency": a["currency"],
        "status": a["status"],
        "balance": money(a["balance_cents"]),
        "equity": money(a["equity_cents"]),
        "margin_free": money(a["margin_free_cents"]),
        "synced_at": a["synced_at"],
        "created_at": a["created_at"],
    }


def tx_out(t: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": t["id"],
        "type": t["type"],
        "method": t["method"],
        "amount": money(t["amount_cents"]),
        "currency": t["currency"],
        "status": t["status"],
        "account_id": t["account_id"],
        "account_login": t.get("account_login"),
        "reference": t["reference"],
        "note": t["note"],
        "created_at": t["created_at"],
        "updated_at": t["updated_at"],
    }


def kyc_doc_out(d: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": d["id"],
        "doc_type": d["doc_type"],
        "filename": d["filename"],
        "status": d["status"],
        "rejection_reason": d["rejection_reason"],
        "created_at": d["created_at"],
    }


def ticket_out(t: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": t["id"],
        "subject": t["subject"],
        "category": t["category"],
        "status": t["status"],
        "created_at": t["created_at"],
        "updated_at": t["updated_at"],
    }


def message_out(m: dict[str, Any], *, staff_name: str = "Bolt Markets Support") -> dict[str, Any]:
    return {
        "id": m["id"],
        "body": m["body"],
        "is_staff": bool(m["is_staff"]),
        "author_name": staff_name if m["is_staff"] else (m.get("author_name") or ""),
        "created_at": m["created_at"],
    }


def challenge_out(ch: dict[str, Any], account: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "id": ch["id"],
        "plan_size": ch["plan_size"],
        "fee": money(ch["fee_cents"]),
        "status": ch["status"],
        "account": account_out(account) if account else None,
        "created_at": ch["created_at"],
    }


def reading_minutes(md: str) -> int:
    return max(1, round(len(md.split()) / 220))


def post_out(p: dict[str, Any], *, with_body: bool) -> dict[str, Any]:
    out = {
        "slug": p["slug"],
        "language": p["language"],
        "category": p["category"],
        "title": p["title"],
        "excerpt": p["excerpt"],
        "published_at": p["published_at"],
        "reading_minutes": reading_minutes(p["body_md"]),
    }
    if with_body:
        out["body_md"] = p["body_md"]
    return out
