"""KYC, support, partners, Bolt Funded, blog CMS, live prices and back-office access rules."""
from __future__ import annotations

import hashlib
import hmac
import json
from decimal import Decimal
from pathlib import Path

from app.cli import DEFAULT_BLOG_DIR, seed_blog
from app.services.payments import stripe_sign
from tests.conftest import PDF, PNG, World


def upload(world: World, headers: dict[str, str], doc_type: str, data: bytes = PNG, name: str = "scan.png") -> object:
    return world.client.post("/api/v1/kyc/documents", data={"doc_type": doc_type}, files={"file": (name, data, "image/png")}, headers=headers)


def test_manual_kyc_flow(world: World) -> None:
    headers = world.client_user()
    state = world.client.get("/api/v1/kyc", headers=headers).json()
    assert state == {"status": "none", "provider": "manual", "rejection_reason": None, "required": ["id_front", "id_back", "proof_of_address"], "documents": []}

    r = upload(world, headers, "id_front", b"<html>not an image</html>", "x.png")
    assert r.status_code == 415 and r.json()["error"]["code"] == "UNSUPPORTED_FILE"
    r = upload(world, headers, "passport")
    assert r.status_code == 422 and "doc_type" in r.json()["error"]["fields"]
    r = upload(world, headers, "id_front", PNG + b"\x00" * (10 * 1024 * 1024 + 1))
    assert r.status_code == 413

    assert upload(world, headers, "id_front").status_code == 201
    first_back = upload(world, headers, "id_back").json()
    replaced = upload(world, headers, "id_back", PDF, "back.pdf").json()
    assert replaced["id"] != first_back["id"]
    r = world.client.post("/api/v1/kyc/submit", headers=headers)
    assert r.status_code == 422 and r.json()["error"]["fields"] == {"proof_of_address": "This document is required."}
    upload(world, headers, "proof_of_address", PDF, "bill.pdf")
    state = world.client.post("/api/v1/kyc/submit", headers=headers).json()
    assert state["status"] == "pending" and len(state["documents"]) == 3
    assert upload(world, headers, "selfie").json()["error"]["code"] == "KYC_LOCKED"
    assert any("Verification ready" in m["subject"] for m in world.outbox("support@example.com"))

    compliance = world.staff("compliance")
    queue = world.client.get("/api/v1/admin/kyc", headers=compliance).json()
    uid = world.user_id("sara@example.com")
    assert queue["total"] == 1 and queue["items"][0]["id"] == uid and queue["items"][0]["documents"] == 3
    file = world.client.get(f"/api/v1/admin/kyc/{uid}", headers=compliance).json()
    doc = next(d for d in file["documents"] if d["doc_type"] == "id_back")
    raw = world.client.get(f"/api/v1/admin/kyc/documents/{doc['id']}/file", headers=compliance)
    assert raw.status_code == 200 and raw.content == PDF and raw.headers["content-type"] == "application/pdf" and raw.headers["cache-control"] == "no-store"
    with world.db.tx() as c:  # stored encrypted, never in clear text
        stored = bytes(c.val("SELECT data FROM kyc_documents WHERE id = :id", id=doc["id"]))
    assert PDF not in stored and stored.startswith(b"v1")

    r = world.client.post(f"/api/v1/admin/kyc/{uid}/reject", json={"reason": "The ID photo is blurry", "documents": {str(doc["id"]): "Blurry"}}, headers=compliance)
    assert r.json()["kyc_status"] == "rejected"
    state = world.client.get("/api/v1/kyc", headers=headers).json()
    assert state["status"] == "rejected" and state["rejection_reason"] == "The ID photo is blurry"
    assert next(d for d in state["documents"] if d["id"] == doc["id"])["status"] == "rejected"
    upload(world, headers, "id_back", PNG)
    assert world.client.post("/api/v1/kyc/submit", headers=headers).json()["status"] == "pending"
    assert world.client.post(f"/api/v1/admin/kyc/{uid}/approve", headers=compliance).json()["kyc_status"] == "approved"
    assert world.client.get("/api/v1/me", headers=headers).json()["kyc_status"] == "approved"
    assert [m["subject"] for m in world.outbox("sara@example.com")][-2:] == ["We need more documents", "Your identity is verified"]

    # finance staff cannot open identity documents
    finance = world.staff("finance")
    assert world.client.get(f"/api/v1/admin/kyc/documents/{doc['id']}/file", headers=finance).status_code == 403


def test_delete_document(world: World) -> None:
    headers = world.client_user()
    doc = upload(world, headers, "selfie").json()
    assert world.client.delete(f"/api/v1/kyc/documents/{doc['id']}", headers=headers).status_code == 204
    assert world.client.get("/api/v1/kyc", headers=headers).json()["documents"] == []


def test_sumsub_flow(make_world) -> None:
    w = make_world({"KYC_PROVIDER": "sumsub", "SUMSUB_APP_TOKEN": "sbx:app", "SUMSUB_SECRET_KEY": "sumsub-secret", "SUMSUB_WEBHOOK_SECRET": "hook-secret"})
    headers = w.client_user()
    uid = w.user_id("sara@example.com")
    w.http.on("api.sumsub.com/resources/accessTokens", 200, {"token": "_act-sbx-123", "userId": f"bolt-{uid}"})
    r = w.client.post("/api/v1/kyc/sumsub/token", headers=headers)
    assert r.status_code == 200 and r.json() == {"token": "_act-sbx-123"}
    call = w.http.last("accessTokens")
    assert f"userId=bolt-{uid}" in call["url"] and call["headers"]["X-App-Token"] == "sbx:app" and len(call["headers"]["X-App-Access-Sig"]) == 64

    def hook(payload: dict) -> object:
        body = json.dumps(payload).encode()
        sig = hmac.new(b"hook-secret", body, hashlib.sha256).hexdigest()
        return w.client.post("/api/v1/webhooks/sumsub", content=body, headers={"X-Payload-Digest": sig, "X-Payload-Digest-Alg": "HMAC_SHA256_HEX"})

    assert hook({"type": "applicantPending", "applicantId": "ap1", "externalUserId": f"bolt-{uid}", "createdAtMs": "1"}).status_code == 200
    assert w.client.get("/api/v1/kyc", headers=headers).json()["status"] == "pending"
    hook({"type": "applicantReviewed", "applicantId": "ap1", "externalUserId": f"bolt-{uid}", "createdAtMs": "2",
          "reviewResult": {"reviewAnswer": "RED", "reviewRejectType": "RETRY", "clientComment": "Document expired"}})
    state = w.client.get("/api/v1/kyc", headers=headers).json()
    assert state["status"] == "rejected" and state["rejection_reason"] == "Document expired" and state["provider"] == "sumsub"
    hook({"type": "applicantReviewed", "applicantId": "ap1", "externalUserId": f"bolt-{uid}", "createdAtMs": "3", "reviewResult": {"reviewAnswer": "GREEN"}})
    assert w.client.get("/api/v1/kyc", headers=headers).json()["status"] == "approved"
    assert w.client.post("/api/v1/webhooks/sumsub", content=b"{}", headers={"X-Payload-Digest": "bad"}).status_code == 400


def test_tickets_and_staff_replies(world: World) -> None:
    headers = world.client_user()
    r = world.client.post("/api/v1/tickets", json={"subject": "Withdrawal timing", "category": "payments", "message": "When will my withdrawal arrive?"}, headers=headers)
    assert r.status_code == 201
    ticket = r.json()
    assert world.client.post("/api/v1/tickets", json={"subject": "x", "category": "payments", "message": "short"}, headers=headers).status_code == 422
    world.client.post(f"/api/v1/tickets/{ticket['id']}/messages", json={"body": "Account 7100001, thanks"}, headers=headers)

    support = world.staff("support")
    listing = world.client.get("/api/v1/admin/tickets?status=open", headers=support).json()
    assert listing["total"] == 1 and listing["items"][0]["user_email"] == "sara@example.com"
    r = world.client.post(f"/api/v1/admin/tickets/{ticket['id']}/messages", json={"body": "Withdrawals are processed within one business day."}, headers=support)
    assert r.status_code == 201
    detail = world.client.get(f"/api/v1/tickets/{ticket['id']}", headers=headers).json()
    assert detail["ticket"]["status"] == "answered" and [m["is_staff"] for m in detail["messages"]] == [False, False, True]
    assert detail["messages"][2]["author_name"] == "Bolt Markets Support" and detail["messages"][0]["author_name"] == "Sara Ahmed"
    assert any("New reply to your ticket" in m["subject"] for m in world.outbox("sara@example.com"))

    assert world.client.post(f"/api/v1/tickets/{ticket['id']}/close", headers=headers).json()["status"] == "closed"
    assert world.client.post(f"/api/v1/tickets/{ticket['id']}/messages", json={"body": "one more"}, headers=headers).json()["error"]["code"] == "TICKET_CLOSED"
    other = world.client_user("omar@example.com", name="Omar Khaled")
    assert world.client.get(f"/api/v1/tickets/{ticket['id']}", headers=other).status_code == 404


def test_contact_form(world: World) -> None:
    body = {"name": "Lina", "email": "lina@example.com", "topic": "partnerships", "subject": "Partnership", "message": "We would like to discuss an IB partnership.", "language": "en"}
    assert world.client.post("/api/v1/contact", json={**body, "website": "http://spam"}).status_code == 202
    assert world.client.post("/api/v1/contact", json=body).status_code == 202
    r = world.client.post("/api/v1/contact", json={**body, "message": "too short"})
    assert r.status_code == 422 and "message" in r.json()["error"]["fields"]
    support = world.staff("support")
    msgs = world.client.get("/api/v1/admin/messages", headers=support).json()
    assert msgs["total"] == 1 and msgs["items"][0]["email"] == "lina@example.com"
    assert world.client.post(f"/api/v1/admin/messages/{msgs['items'][0]['id']}/status", json={"status": "handled"}, headers=support).json()["status"] == "handled"
    assert world.client.get(f"/api/v1/admin/messages/{msgs['items'][0]['id']}", headers=support).json()["subject"] == "Partnership"
    assert world.client.get("/api/v1/admin/messages/999", headers=support).status_code == 404
    assert any(m["subject"] == "Contact form: Partnership" for m in world.outbox("support@example.com"))


def test_ib_overview(world: World) -> None:
    ib = world.client_user("ib@example.com", name="Nour Hassan")
    code = world.client.get("/api/v1/me", headers=ib).json()["referral_code"]
    world.client_user("a@example.com", name="Ahmed Ali Salem", referral_code=code)
    world.client_user("b@example.com", name="Mona Fathy", referral_code=code, kyc=True)
    overview = world.client.get("/api/v1/ib", headers=ib).json()
    assert overview["referral_code"] == code and overview["stats"] == {"registered": 2, "verified": 1, "funded": 0}
    assert sorted(r["name"] for r in overview["referrals"]) == ["Ahmed S.", "Mona F."]


def test_funded_challenge_purchase_and_review(world: World) -> None:
    headers = world.client_user()
    r = world.client.post("/api/v1/funded/challenges", json={"plan_size": 12345, "method": "card"}, headers=headers)
    assert r.status_code == 422
    world.http.on("checkout/sessions", 200, {"id": "cs_f1", "url": "https://checkout.stripe.com/f1"})
    r = world.client.post("/api/v1/funded/challenges", json={"plan_size": 25000, "method": "card"}, headers=headers)
    assert r.status_code == 201 and r.json()["challenge"]["status"] == "awaiting_payment" and r.json()["challenge"]["fee"] == 199.0
    ch = r.json()["challenge"]
    sent = world.http.last("checkout/sessions")["body"].decode()
    assert "unit_amount%5D=19900" in sent and "portal%2Ffunded%2F%3Fchallenge%3D" in sent

    payload = json.dumps({"id": "evt_f1", "type": "checkout.session.completed", "data": {"object": {"id": "cs_f1", "payment_status": "paid", "amount_total": 19900, "currency": "usd"}}}).encode()
    assert world.client.post("/api/v1/webhooks/stripe", content=payload, headers={"Stripe-Signature": stripe_sign("whsec_test", payload)}).status_code == 200
    items = world.client.get("/api/v1/funded/challenges", headers=headers).json()["items"]
    assert items[0]["status"] == "phase1" and items[0]["account"]["balance"] == 25000.0 and items[0]["account"]["account_type"] == "funded"
    login = items[0]["account"]["login"]
    assert world.mock_mt5().accounts[login]["group"] == "demo\\funded"

    # equity drops below the overall limit -> flagged for review on the next sync
    world.mock_mt5().accounts[login]["balance"] = Decimal("22400")
    world.client.post(f"/api/v1/accounts/{items[0]['account']['id']}/sync", headers=headers)
    finance = world.staff("finance")
    listing = world.client.get("/api/v1/admin/challenges", headers=finance).json()["items"]
    assert "overall loss" in listing[0]["breach"]
    assert world.client.get(f"/api/v1/admin/challenges/{ch['id']}", headers=finance).json()["login"] == login
    assert world.client.post(f"/api/v1/admin/challenges/{ch['id']}/status", json={"status": "funded"}, headers=finance).status_code == 409
    assert world.client.post(f"/api/v1/admin/challenges/{ch['id']}/status", json={"status": "failed", "note": "Overall loss limit"}, headers=finance).json()["status"] == "failed"


def test_funded_activation_without_mt5(make_world) -> None:
    w = make_world({"MT5_MODE": "disabled"})
    headers = w.client_user()
    w.http.on("checkout/sessions", 200, {"id": "cs_f2", "url": "https://checkout.stripe.com/f2"})
    ch = w.client.post("/api/v1/funded/challenges", json={"plan_size": 10000, "method": "card"}, headers=headers).json()["challenge"]
    payload = json.dumps({"id": "evt_f2", "type": "checkout.session.completed", "data": {"object": {"id": "cs_f2", "payment_status": "paid", "amount_total": 9900, "currency": "usd"}}}).encode()
    w.client.post("/api/v1/webhooks/stripe", content=payload, headers={"Stripe-Signature": stripe_sign("whsec_test", payload)})
    assert w.client.get("/api/v1/funded/challenges", headers=headers).json()["items"][0]["status"] == "pending_activation"
    finance = w.staff("finance")
    assert w.client.post(f"/api/v1/admin/challenges/{ch['id']}/activate", json={}, headers=finance).status_code == 422
    done = w.client.post(f"/api/v1/admin/challenges/{ch['id']}/activate", json={"login": "500777"}, headers=finance).json()
    assert done["status"] == "phase1" and done["login"] == "500777"
    assert w.client.post(f"/api/v1/admin/challenges/{ch['id']}/status", json={"status": "phase2"}, headers=finance).json()["status"] == "phase2"


def test_back_office_access_rules(world: World) -> None:
    client = world.client_user()
    assert world.client.get("/api/v1/admin/overview", headers=client).json()["error"]["code"] == "FORBIDDEN"
    no2fa = world.staff("admin", "new-admin@bolt.test", two_factor=False)
    r = world.client.get("/api/v1/admin/overview", headers=no2fa)
    assert r.status_code == 403 and r.json()["error"]["code"] == "TWO_FACTOR_REQUIRED"
    assert world.client.get("/api/v1/me", headers=no2fa).json()["permissions"]  # can still reach /me to set up 2FA

    admin = world.staff("admin")
    overview = world.client.get("/api/v1/admin/overview", headers=admin).json()
    assert overview["clients"] == 1 and len(overview["signups_14d"]) == 14 and overview["signups_14d"][-1]["count"] == 1

    users = world.client.get("/api/v1/admin/users?q=sara", headers=admin).json()
    assert users["total"] == 1 and users["items"][0]["email"] == "sara@example.com"
    uid = users["items"][0]["id"]
    file = world.client.get(f"/api/v1/admin/users/{uid}", headers=admin).json()
    assert file["user"]["status"] == "active" and file["accounts"] == [] and file["referrals"] == 0
    world.client.post(f"/api/v1/admin/users/{uid}/notes", json={"body": "Called about deposit options"}, headers=admin)
    assert world.client.get(f"/api/v1/admin/users/{uid}", headers=admin).json()["notes"][0]["author_name"] == "Admin Staff"

    r = world.client.patch(f"/api/v1/admin/users/{uid}", json={"status": "suspended"}, headers=admin)
    assert r.json()["status"] == "suspended"
    assert world.client.get("/api/v1/me", headers=client).status_code == 401
    world.client.patch(f"/api/v1/admin/users/{uid}", json={"status": "active"}, headers=admin)

    compliance = world.staff("compliance")
    assert world.client.patch(f"/api/v1/admin/users/{uid}", json={"role": "admin"}, headers=compliance).json()["error"]["code"] == "FORBIDDEN"
    me_id = world.user_id("admin@bolt.test")
    assert world.client.patch(f"/api/v1/admin/users/{me_id}", json={"status": "suspended"}, headers=admin).status_code == 409

    staff = world.client.post("/api/v1/admin/users", json={"email": "desk@bolt.test", "full_name": "Desk Person", "role": "finance", "password": "Desk-pass-2026"}, headers=admin)
    assert staff.status_code == 201 and staff.json()["role"] == "finance" and staff.json()["email_verified"] is True
    assert world.client.post("/api/v1/admin/users", json={"email": "desk@bolt.test", "full_name": "Desk Person", "role": "finance", "password": "Desk-pass-2026"}, headers=admin).status_code == 409
    assert world.client.post("/api/v1/admin/users", json={"email": "x@bolt.test", "full_name": "X Person", "role": "finance", "password": "Desk-pass-2026"}, headers=compliance).status_code == 403

    audit = world.client.get("/api/v1/admin/audit?action=user.", headers=admin).json()
    assert audit["total"] >= 3 and all(i["action"].startswith("user.") for i in audit["items"])
    system = world.client.get("/api/v1/admin/system", headers=admin).json()
    assert system["mt5"] == {"mode": "mock", "enabled": True, "server_live": "BoltMarkets-Live", "server_demo": "BoltMarkets-Demo"}
    assert system["payments"]["card_stripe"] is True and system["email"]["smtp"] is False and "0001_initial" in system["migrations"]
    assert world.client.get("/api/v1/admin/system", headers=compliance).status_code == 403


def test_blog_cms(world: World) -> None:
    editor = world.staff("support")
    post = {"slug": "weekly-outlook", "language": "en", "category": "insights", "title": "Weekly outlook: what to watch",
            "excerpt": "Central bank meetings and inflation data lead the week.", "body_md": "## The week ahead\n\n" + "Markets will focus on inflation data. " * 10}
    r = world.client.post("/api/v1/admin/posts", json=post, headers=editor)
    assert r.status_code == 201 and r.json()["status"] == "draft" and r.json()["published_at"] is None
    pid = r.json()["id"]
    assert world.client.get("/api/v1/blog/posts/weekly-outlook").status_code == 404
    assert world.client.post("/api/v1/admin/posts", json=post, headers=editor).json()["error"]["code"] == "SLUG_TAKEN"
    assert world.client.post("/api/v1/admin/posts", json={**post, "slug": "Bad Slug"}, headers=editor).status_code == 422

    published = world.client.patch(f"/api/v1/admin/posts/{pid}", json={"status": "published"}, headers=editor).json()
    assert published["status"] == "published" and published["published_at"]
    listing = world.client.get("/api/v1/blog/posts?lang=en").json()["items"]
    assert [p["slug"] for p in listing] == ["weekly-outlook"] and "body_md" not in listing[0] and listing[0]["reading_minutes"] >= 1
    full = world.client.get("/api/v1/blog/posts/weekly-outlook?lang=en").json()
    assert full["body_md"].startswith("## The week ahead")
    assert world.client.get("/api/v1/blog/posts?lang=ar").json()["items"] == []
    assert world.client.delete(f"/api/v1/admin/posts/{pid}", headers=editor).status_code == 204
    assert world.client.get("/api/v1/blog/posts").json()["items"] == []
    finance = world.staff("finance")
    assert world.client.get("/api/v1/admin/posts", headers=finance).status_code == 403


def test_seed_blog_imports_starter_articles(world: World) -> None:
    directory = Path(DEFAULT_BLOG_DIR)
    if not (directory / "posts.json").exists():  # backend checked out on its own
        return
    assert seed_blog(world.services, directory) == 20
    assert seed_blog(world.services, directory) == 0
    en = world.client.get("/api/v1/blog/posts?lang=en&limit=50").json()["items"]
    ar = world.client.get("/api/v1/blog/posts?lang=ar&limit=50").json()["items"]
    assert len(en) == 10 and len(ar) == 10
    assert world.client.get(f"/api/v1/blog/posts/{en[0]['slug']}?lang=ar").json()["language"] == "ar"


def test_quotes_ingest_and_snapshot(world: World) -> None:
    assert world.client.get("/api/v1/quotes").json() == {"status": "waiting", "quotes": []}
    body = {"quotes": [{"s": "eurusd", "b": 1.0851, "a": 1.0852, "o": 1.0801}, {"s": "XAUUSD", "b": 2350.1, "a": 2350.4},
                       {"s": "NOPE", "b": 1, "a": 2}, {"s": "GBPUSD", "b": 1.3, "a": 1.2}]}
    assert world.client.post("/api/v1/quotes/ingest", json=body).status_code == 401
    r = world.client.post("/api/v1/quotes/ingest", json=body, headers={"X-Bridge-Key": "bridge-key-123"})
    assert r.json() == {"accepted": 2}
    snap = {q["s"]: q for q in world.client.get("/api/v1/quotes").json()["quotes"]}
    assert set(snap) == {"EURUSD", "XAUUSD"} and snap["EURUSD"]["o"] == 1.0801


def test_quotes_disabled(make_world) -> None:
    w = make_world({"QUOTES_MODE": "disabled"})
    assert w.client.get("/api/v1/quotes").json()["status"] == "disabled"
    r = w.client.get("/api/v1/quotes/stream")
    assert r.status_code == 503 and r.json()["error"]["code"] == "FEED_UNAVAILABLE"


def test_openapi_and_docs(world: World) -> None:
    spec = world.client.get("/openapi.json").json()
    assert spec["info"]["title"] == "Bolt Markets API"
    assert "/api/v1/accounts/{id}/sync" in spec["paths"] and "/api/v1/webhooks/stripe" not in spec["paths"]
    assert spec["paths"]["/api/v1/auth/register"]["post"]["requestBody"]["content"]["application/json"]["schema"] == {"$ref": "#/components/schemas/RegisterIn"}
    assert "UserOut" in spec["components"]["schemas"]
    assert "swagger-ui" in world.client.get("/docs").text
    assert world.client.get("/api/v1/health").json()["status"] == "ok"
    r = world.client.get("/api/v1/me", headers={"Origin": "https://example.github.io"})
    assert r.headers["access-control-allow-origin"] == "https://example.github.io"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "access-control-allow-origin" not in world.client.get("/api/v1/health", headers={"Origin": "https://evil.example"}).headers
    assert world.client.delete("/api/v1/health").status_code == 405
