"""MT5 accounts, deposits (Stripe / NOWPayments), withdrawals and the staff money desk."""
from __future__ import annotations

import json
from decimal import Decimal
from urllib.parse import parse_qs

from app.services.payments import nowpayments_sign, stripe_sign
from tests.conftest import World


def open_account(world: World, headers: dict[str, str], kind: str = "live", account_type: str = "standard", leverage: int = 500) -> dict:
    r = world.client.post("/api/v1/accounts", json={"kind": kind, "account_type": account_type, "leverage": leverage, "currency": "USD"}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def stripe_event(world: World, event_type: str, session: dict, event_id: str = "evt_1") -> object:
    payload = json.dumps({"id": event_id, "type": event_type, "data": {"object": session}}).encode()
    return world.client.post("/api/v1/webhooks/stripe", content=payload, headers={"Stripe-Signature": stripe_sign("whsec_test", payload), "Content-Type": "application/json"})


def test_open_demo_and_live_accounts(world: World) -> None:
    headers = world.client_user()
    demo = open_account(world, headers, "demo", "pro", 200)
    assert demo["account"]["status"] == "active" and demo["account"]["login"].startswith("51")
    assert demo["account"]["server"] == "BoltMarkets-Demo" and demo["account"]["balance"] == 10000.0
    assert len(demo["password"]) == 12 and demo["investor_password"] and demo["password"] != demo["investor_password"]
    mt5 = world.mock_mt5()
    assert mt5.accounts[demo["account"]["login"]]["group"] == "demo\\standard"

    live = open_account(world, headers, "live", "institutional", 100)
    assert live["account"]["login"].startswith("71") and live["account"]["balance"] == 0.0
    assert mt5.accounts[live["account"]["login"]]["group"] == "real\\institutional"
    assert "Your MT5 live account is ready" in [m["subject"] for m in world.outbox("sara@example.com")]
    assert all(demo["password"] not in m["body_text"] for m in world.outbox())  # passwords are never emailed

    items = world.client.get("/api/v1/accounts", headers=headers).json()["items"]
    assert [a["kind"] for a in items] == ["live", "demo"]

    r = world.client.post("/api/v1/accounts", json={"kind": "live", "account_type": "standard", "leverage": 1000, "currency": "USD"}, headers=headers)
    assert r.status_code == 422 and "leverage" in r.json()["error"]["fields"]
    r = world.client.post("/api/v1/accounts", json={"kind": "live", "account_type": "standard", "leverage": 100, "currency": "EUR"}, headers=headers)
    assert "currency" in r.json()["error"]["fields"]

    acc_id = live["account"]["id"]
    new_pw = world.client.post(f"/api/v1/accounts/{acc_id}/reset-password", headers=headers).json()["password"]
    assert mt5.accounts[live["account"]["login"]]["password"] == new_pw
    mt5.accounts[live["account"]["login"]]["balance"] = Decimal("123.45")
    assert world.client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers).json()["balance"] == 123.45

    other = world.client_user("other@example.com", name="Omar Khaled")
    assert world.client.post(f"/api/v1/accounts/{acc_id}/sync", headers=other).status_code == 404


def test_account_creation_failure_is_reported(world: World) -> None:
    headers = world.client_user()
    world.mock_mt5().fail_next = "server busy"
    r = world.client.post("/api/v1/accounts", json={"kind": "live", "account_type": "standard", "leverage": 100, "currency": "USD"}, headers=headers)
    assert r.status_code == 502 and r.json()["error"]["code"] == "MT5_UNAVAILABLE"
    items = world.client.get("/api/v1/accounts", headers=headers).json()["items"]
    assert items[0]["status"] == "failed"
    assert any("MT5 account creation failed" in m["subject"] for m in world.outbox("support@example.com"))


def test_accounts_without_mt5_wait_for_staff(make_world) -> None:
    w = make_world({"MT5_MODE": "disabled"})
    headers = w.client_user()
    r = open_account(w, headers, "live", "standard", 100)
    assert r["account"]["status"] == "pending" and r["password"] is None
    assert w.client.post(f"/api/v1/accounts/{r['account']['id']}/sync", headers=headers).json()["error"]["code"] == "MT5_DISABLED"
    assert w.client.get("/api/v1/public/config").json()["mt5_enabled"] is False
    # finance links the account created by hand in MT5
    staff = w.staff("finance")
    linked = w.client.post(f"/api/v1/admin/accounts/{r['account']['id']}/link", json={"login": "880011"}, headers=staff).json()
    assert linked["status"] == "active" and linked["login"] == "880011" and linked["server"] == "BoltMarkets-Live"
    assert w.client.post(f"/api/v1/admin/accounts/{r['account']['id']}/link", json={"login": "880012"}, headers=staff).status_code == 409


def test_card_deposit_via_stripe(world: World) -> None:
    headers = world.client_user(kyc=False)
    acc = open_account(world, headers, "live", "pro", 200)["account"]
    r = world.client.post("/api/v1/deposits", json={"account_id": acc["id"], "amount": 1500, "method": "card"}, headers=headers)
    assert r.status_code == 403 and r.json()["error"]["code"] == "KYC_REQUIRED"
    with world.db.tx() as c:
        c.exec("UPDATE users SET kyc_status = 'approved'")

    r = world.client.post("/api/v1/deposits", json={"account_id": acc["id"], "amount": 500, "method": "card"}, headers=headers)
    assert r.status_code == 422 and r.json()["error"]["code"] == "BELOW_MINIMUM"  # Pro first deposit is 1,000

    world.http.on("api.stripe.com/v1/checkout/sessions", 200, {"id": "cs_test_1", "url": "https://checkout.stripe.com/c/pay/cs_test_1"})
    r = world.client.post("/api/v1/deposits", json={"account_id": acc["id"], "amount": 1500.5, "method": "card"}, headers={**headers, "Accept-Language": "ar"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["redirect_url"] == "https://checkout.stripe.com/c/pay/cs_test_1"
    tx = body["transaction"]
    assert tx["status"] == "awaiting_payment" and tx["amount"] == 1500.5 and tx["account_login"] == acc["login"]
    sent = parse_qs(world.http.last("checkout/sessions")["body"].decode())
    assert sent["line_items[0][price_data][unit_amount]"] == ["150050"] and sent["metadata[transaction_id]"] == [str(tx["id"])]
    assert sent["success_url"] == [f"https://example.github.io/bolt-markets/ar/portal/deposit/?tx={tx['id']}"]
    assert world.http.last("checkout/sessions")["headers"]["Idempotency-Key"] == f"bolt-tx-{tx['id']}"

    bad = world.client.post("/api/v1/webhooks/stripe", content=b"{}", headers={"Stripe-Signature": "t=1,v1=00"})
    assert bad.status_code == 400

    session = {"id": "cs_test_1", "payment_status": "paid", "amount_total": 150050, "currency": "usd", "metadata": {"transaction_id": str(tx["id"])}}
    assert stripe_event(world, "checkout.session.completed", session).status_code == 200
    done = world.client.get(f"/api/v1/transactions/{tx['id']}", headers=headers).json()
    assert done["status"] == "completed"
    assert world.mock_mt5().accounts[acc["login"]]["balance"] == Decimal("1500.50")
    assert any("credited" in m["subject"].lower() for m in world.outbox("sara@example.com"))
    # duplicate delivery is ignored (no double credit)
    assert stripe_event(world, "checkout.session.completed", session).json()["duplicate"] is True
    assert stripe_event(world, "checkout.session.completed", session, event_id="evt_2").status_code == 200
    assert world.mock_mt5().accounts[acc["login"]]["balance"] == Decimal("1500.50")
    assert world.client.get("/api/v1/accounts", headers=headers).json()["items"][0]["balance"] == 1500.5

    # second deposit only needs the general minimum; amount mismatch is flagged instead of credited
    world.http.on("api.stripe.com/v1/checkout/sessions", 200, {"id": "cs_test_2", "url": "https://checkout.stripe.com/c/pay/cs_test_2"})
    tx2 = world.client.post("/api/v1/deposits", json={"account_id": acc["id"], "amount": 20, "method": "card"}, headers=headers).json()["transaction"]
    stripe_event(world, "checkout.session.completed", {"id": "cs_test_2", "payment_status": "paid", "amount_total": 100, "currency": "usd"}, "evt_3")
    flagged = world.client.get(f"/api/v1/transactions/{tx2['id']}", headers=headers).json()
    assert flagged["status"] == "processing" and world.mock_mt5().accounts[acc["login"]]["balance"] == Decimal("1500.50")

    world.http.on("api.stripe.com/v1/checkout/sessions", 200, {"id": "cs_test_3", "url": "https://checkout.stripe.com/x"})
    tx3 = world.client.post("/api/v1/deposits", json={"account_id": acc["id"], "amount": 20, "method": "card"}, headers=headers).json()["transaction"]
    stripe_event(world, "checkout.session.expired", {"id": "cs_test_3"}, "evt_4")
    assert world.client.get(f"/api/v1/transactions/{tx3['id']}", headers=headers).json()["status"] == "cancelled"

    page = world.client.get("/api/v1/transactions?type=deposit&page_size=2", headers=headers).json()
    assert page["total"] == 3 and len(page["items"]) == 2 and page["page"] == 1


def test_provider_outage_marks_deposit_failed(world: World) -> None:
    headers = world.client_user(kyc=True)
    acc = open_account(world, headers)["account"]
    world.http.on("api.stripe.com", 500, {"error": {"message": "boom"}})
    r = world.client.post("/api/v1/deposits", json={"account_id": acc["id"], "amount": 50, "method": "card"}, headers=headers)
    assert r.status_code == 502 and r.json()["error"]["code"] == "PAYMENT_PROVIDER_ERROR"
    assert world.client.get("/api/v1/transactions", headers=headers).json()["items"][0]["status"] == "failed"


def test_crypto_deposit_via_nowpayments(world: World) -> None:
    headers = world.client_user(kyc=True)
    acc = open_account(world, headers)["account"]
    world.http.on("nowpayments.io/v1/invoice", 200, {"id": "inv_9", "invoice_url": "https://nowpayments.io/payment/?iid=inv_9"})
    r = world.client.post("/api/v1/deposits", json={"account_id": acc["id"], "amount": 250, "method": "crypto"}, headers=headers)
    assert r.status_code == 201 and r.json()["redirect_url"].endswith("iid=inv_9")
    tx = r.json()["transaction"]
    sent = json.loads(world.http.last("invoice")["body"])
    assert sent["ipn_callback_url"] == "https://api.example.com/api/v1/webhooks/nowpayments" and sent["price_amount"] == 250.0

    def ipn(status: str, **extra: object) -> object:
        data = {"payment_id": 555, "invoice_id": "inv_9", "order_id": str(tx["id"]), "payment_status": status, "price_amount": 250, "price_currency": "usd", **extra}
        return world.client.post("/api/v1/webhooks/nowpayments", content=json.dumps(data).encode(), headers={"x-nowpayments-sig": nowpayments_sign("np-ipn-secret", data)})

    assert world.client.post("/api/v1/webhooks/nowpayments", content=b'{"a":1}', headers={"x-nowpayments-sig": "bad"}).status_code == 400
    assert ipn("confirming").status_code == 200
    assert world.client.get(f"/api/v1/transactions/{tx['id']}", headers=headers).json()["status"] == "processing"
    assert ipn("finished", actually_paid=0.0042, pay_currency="btc").status_code == 200
    assert world.client.get(f"/api/v1/transactions/{tx['id']}", headers=headers).json()["status"] == "completed"
    assert world.mock_mt5().accounts[acc["login"]]["balance"] == Decimal("250")
    assert ipn("finished").json()["duplicate"] is True


def test_withdrawals_and_finance_desk(world: World) -> None:
    headers = world.client_user(kyc=True)
    acc = open_account(world, headers)["account"]
    world.mock_mt5().accounts[acc["login"]]["balance"] = Decimal("300")
    dest = {"address": "TQ2xKq7c4Yk8m3RgP9sVw1nB5jH6dF0aZx", "network": "trc20"}

    r = world.client.post("/api/v1/withdrawals", json={"account_id": acc["id"], "amount": 500, "method": "crypto", "destination": dest}, headers=headers)
    assert r.status_code == 409 and r.json()["error"]["code"] == "INSUFFICIENT_FUNDS"
    r = world.client.post("/api/v1/withdrawals", json={"account_id": acc["id"], "amount": 100, "method": "crypto", "destination": {"address": "x", "network": "TRC20"}}, headers=headers)
    assert r.status_code == 422 and "address" in r.json()["error"]["fields"]

    w1 = world.client.post("/api/v1/withdrawals", json={"account_id": acc["id"], "amount": 200, "method": "crypto", "destination": dest}, headers=headers).json()
    assert w1["status"] == "pending" and w1["amount"] == 200
    # pending withdrawals reduce what can still be requested
    r = world.client.post("/api/v1/withdrawals", json={"account_id": acc["id"], "amount": 150, "method": "crypto", "destination": dest}, headers=headers)
    assert r.json()["error"]["code"] == "INSUFFICIENT_FUNDS"
    w2 = world.client.post("/api/v1/withdrawals", json={"account_id": acc["id"], "amount": 50, "method": "card"}, headers=headers).json()
    assert world.client.post(f"/api/v1/withdrawals/{w2['id']}/cancel", headers=headers).json()["status"] == "cancelled"
    assert world.client.post(f"/api/v1/withdrawals/{w2['id']}/cancel", headers=headers).status_code == 409

    finance = world.staff("finance")
    queue = world.client.get("/api/v1/admin/transactions?type=withdrawal&status=pending", headers=finance).json()
    assert queue["total"] == 1 and queue["items"][0]["destination"] == {"address": dest["address"], "network": "TRC20"}
    approved = world.client.post(f"/api/v1/admin/transactions/{w1['id']}/approve", headers=finance).json()
    assert approved["status"] == "processing" and approved["mt5_ticket"]
    assert world.mock_mt5().accounts[acc["login"]]["balance"] == Decimal("100")
    assert world.client.post(f"/api/v1/admin/transactions/{w1['id']}/approve", headers=finance).status_code == 409
    paid = world.client.post(f"/api/v1/admin/transactions/{w1['id']}/complete", json={"reference": "0xabc123"}, headers=finance).json()
    assert paid["status"] == "completed" and paid["reference"] == "0xabc123"
    subjects = [m["subject"] for m in world.outbox("sara@example.com")]
    assert subjects.count("Update on your withdrawal") == 2

    # rejected after approval -> funds go back to MT5
    w3 = world.client.post("/api/v1/withdrawals", json={"account_id": acc["id"], "amount": 60, "method": "crypto", "destination": dest}, headers=headers).json()
    world.client.post(f"/api/v1/admin/transactions/{w3['id']}/approve", headers=finance)
    assert world.mock_mt5().accounts[acc["login"]]["balance"] == Decimal("40")
    failed = world.client.post(f"/api/v1/admin/transactions/{w3['id']}/reject", json={"reason": "Wallet address rejected by exchange"}, headers=finance).json()
    assert failed["status"] == "failed" and failed["note"] == "Wallet address rejected by exchange"
    assert world.mock_mt5().accounts[acc["login"]]["balance"] == Decimal("100")

    w4 = world.client.post("/api/v1/withdrawals", json={"account_id": acc["id"], "amount": 10, "method": "card"}, headers=headers).json()
    assert world.client.post(f"/api/v1/admin/transactions/{w4['id']}/reject", json={"reason": "Use the card you deposited with"}, headers=finance).json()["status"] == "rejected"

    # support staff cannot touch money
    support = world.staff("support")
    assert world.client.get("/api/v1/admin/transactions", headers=support).json()["error"]["code"] == "FORBIDDEN"


def test_withdrawal_requires_kyc(world: World) -> None:
    headers = world.client_user()
    acc = open_account(world, headers)["account"]
    r = world.client.post("/api/v1/withdrawals", json={"account_id": acc["id"], "amount": 20, "method": "card"}, headers=headers)
    assert r.status_code == 403 and r.json()["error"]["code"] == "KYC_REQUIRED"


def test_manual_credit_when_mt5_is_off(make_world) -> None:
    w = make_world({"MT5_MODE": "disabled"})
    headers = w.client_user(kyc=True)
    acc = open_account(w, headers)["account"]
    finance = w.staff("finance")
    w.client.post(f"/api/v1/admin/accounts/{acc['id']}/link", json={"login": "900100", "server": "Bolt-Live"}, headers=finance)
    w.http.on("api.stripe.com/v1/checkout/sessions", 200, {"id": "cs_m", "url": "https://checkout.stripe.com/m"})
    tx = w.client.post("/api/v1/deposits", json={"account_id": acc["id"], "amount": 100, "method": "card"}, headers=headers).json()["transaction"]
    stripe_event(w, "checkout.session.completed", {"id": "cs_m", "payment_status": "paid", "amount_total": 10000, "currency": "usd"})
    t = w.client.get(f"/api/v1/admin/transactions/{tx['id']}", headers=finance).json()
    assert t["status"] == "processing" and "manually" in t["admin_note"]
    done = w.client.post(f"/api/v1/admin/transactions/{tx['id']}/complete", json={"reference": "MT5 deal 4411"}, headers=finance).json()
    assert done["status"] == "completed"


def test_adjustment_and_ib_commission(world: World) -> None:
    ib = world.client_user("ib@example.com", kyc=True)
    acc = open_account(world, ib)["account"]
    finance = world.staff("finance")
    r = world.client.post("/api/v1/admin/adjustments", json={"account_id": acc["id"], "amount": 42.5, "type": "ib_commission", "note": "October commissions"}, headers=finance)
    assert r.status_code == 201 and r.json()["status"] == "completed"
    assert world.mock_mt5().accounts[acc["login"]]["balance"] == Decimal("42.5")
    assert world.client.get("/api/v1/ib", headers=ib).json()["commissions_total"] == 42.5
    r = world.client.post("/api/v1/admin/adjustments", json={"account_id": acc["id"], "amount": -2.5, "note": "Fee correction"}, headers=finance)
    assert r.json()["amount"] == -2.5 and world.mock_mt5().accounts[acc["login"]]["balance"] == Decimal("40.0")
