"""Registration, email verification, login, sessions, password recovery and 2FA."""
from __future__ import annotations

from datetime import timedelta

from app.db import utcnow
from app.security import token_hash, totp_at
from tests.conftest import PASSWORD, World


def test_register_verify_login_and_me(world: World) -> None:
    r = world.register("sara@example.com", referral_code=None)
    assert r.status_code == 201 and r.json() == {"ok": True}
    mail = world.outbox("sara@example.com")
    assert len(mail) == 1 and "Confirm your email" in mail[0]["subject"]
    assert "https://example.github.io/bolt-markets/verify-email/?token=" in mail[0]["body_text"]

    r = world.client.post("/api/v1/auth/login", json={"email": "sara@example.com", "password": PASSWORD})
    assert r.status_code == 403 and r.json()["error"]["code"] == "EMAIL_NOT_VERIFIED"

    token = world.token_from_email("sara@example.com", "verify-email")
    assert world.client.post("/api/v1/auth/verify-email", json={"token": token}).status_code == 200
    r = world.client.post("/api/v1/auth/verify-email", json={"token": token})
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_TOKEN"

    headers = world.login("SARA@example.com ")
    me = world.client.get("/api/v1/me", headers=headers).json()
    assert me["email"] == "sara@example.com" and me["email_verified"] is True and me["role"] == "client"
    assert me["kyc_status"] == "none" and len(me["referral_code"]) == 8 and me["permissions"] == []


def test_register_validation_and_conflicts(world: World) -> None:
    r = world.client.post("/api/v1/auth/register", json={"full_name": "Sara", "email": "nope", "password": "short", "country": "UAE", "accept_terms": False})
    err = r.json()["error"]
    assert r.status_code == 422 and err["code"] == "VALIDATION_ERROR"
    assert set(err["fields"]) == {"full_name", "email", "password", "country", "accept_terms"}

    assert world.register("dup@example.com").status_code == 201
    r = world.register("DUP@example.com")
    assert r.status_code == 409 and r.json()["error"]["code"] == "EMAIL_TAKEN" and "email" in r.json()["error"]["fields"]

    r = world.register("ref@example.com", referral_code="NOPE1234")
    assert r.status_code == 422 and "referral_code" in r.json()["error"]["fields"]

    r = world.client.post("/api/v1/auth/register", content=b"{not json", headers={"Content-Type": "application/json"})
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_JSON"


def test_arabic_error_messages(world: World) -> None:
    r = world.client.post("/api/v1/auth/login", json={"email": "x@example.com", "password": "whatever123"}, headers={"Accept-Language": "ar-EG,ar;q=0.9"})
    assert r.status_code == 401
    assert r.json()["error"]["message"] == "البريد الإلكتروني أو كلمة المرور غير صحيحة."


def test_referral_is_recorded(world: World) -> None:
    world.client_user("ib@example.com")
    with world.db.tx() as c:
        code = c.val("SELECT referral_code FROM users WHERE email = 'ib@example.com'")
    assert world.register("friend@example.com", name="Omar Khaled", referral_code=code.lower()).status_code == 201
    ib_id = world.user_id("ib@example.com")
    with world.db.tx() as c:
        assert c.val("SELECT referred_by FROM users WHERE email = 'friend@example.com'") == ib_id


def test_registration_closed_and_restricted_country(make_world) -> None:
    w = make_world({"REGISTRATION_OPEN": "false"})
    r = w.register("a@example.com")
    assert r.status_code == 403 and r.json()["error"]["code"] == "REGISTRATION_CLOSED"


def test_restricted_country(make_world) -> None:
    w = make_world({"RESTRICTED_COUNTRIES": "US, kp"})
    r = w.register("a@example.com", country="US")
    assert r.status_code == 403 and r.json()["error"]["code"] == "COUNTRY_RESTRICTED"
    assert w.client.get("/api/v1/public/config").json()["restricted_countries"] == ["US", "KP"]


def test_refresh_rotation_reuse_and_logout(world: World) -> None:
    world.client_user("sara@example.com")
    r = world.client.post("/api/v1/auth/login", json={"email": "sara@example.com", "password": PASSWORD})
    first = r.json()
    r = world.client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert r.status_code == 200
    second = r.json()
    assert second["refresh_token"] != first["refresh_token"]

    # Re-using the old token right away (another tab) does not end the session...
    r = world.client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert r.status_code == 409 and r.json()["error"]["code"] == "REFRESH_IN_PROGRESS"
    # ...but re-use later is treated as theft: the whole family is revoked.
    with world.db.tx() as c:
        c.exec("UPDATE refresh_tokens SET used_at = :t WHERE token_hash = :h", t=utcnow() - timedelta(minutes=5), h=token_hash(first["refresh_token"]))
    assert world.client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}).status_code == 401
    assert world.client.post("/api/v1/auth/refresh", json={"refresh_token": second["refresh_token"]}).status_code == 401

    third = world.client.post("/api/v1/auth/login", json={"email": "sara@example.com", "password": PASSWORD}).json()
    assert world.client.post("/api/v1/auth/logout", json={"refresh_token": third["refresh_token"]}).status_code == 204
    assert world.client.post("/api/v1/auth/refresh", json={"refresh_token": third["refresh_token"]}).status_code == 401


def test_bad_tokens(world: World) -> None:
    assert world.client.get("/api/v1/me").json()["error"]["code"] == "NOT_AUTHENTICATED"
    r = world.client.get("/api/v1/me", headers={"Authorization": "Bearer nonsense"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "TOKEN_INVALID"


def test_lockout_after_failed_logins(world: World) -> None:
    world.client_user("sara@example.com")
    for _ in range(10):
        assert world.client.post("/api/v1/auth/login", json={"email": "sara@example.com", "password": "Wrong-password-1"}).status_code == 401
    r = world.client.post("/api/v1/auth/login", json={"email": "sara@example.com", "password": PASSWORD})
    assert r.status_code == 429 and r.json()["error"]["code"] == "ACCOUNT_LOCKED"


def test_forgot_and_reset_password(world: World) -> None:
    headers = world.client_user("sara@example.com")
    assert world.client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"}).status_code == 200
    assert world.client.post("/api/v1/auth/forgot-password", json={"email": "sara@example.com", "language": "ar"}).status_code == 200
    mail = world.outbox("sara@example.com")[-1]
    assert mail["subject"] == "إعادة تعيين كلمة المرور" and "/bolt-markets/ar/reset-password/?token=" in mail["body_text"]
    token = world.token_from_email("sara@example.com", "reset-password")

    r = world.client.post("/api/v1/auth/reset-password", json={"token": token, "password": "short"})
    assert r.status_code == 422
    assert world.client.post("/api/v1/auth/reset-password", json={"token": token, "password": "Brand-new-pass-9"}).status_code == 200
    # old access token no longer works; new password does
    assert world.client.get("/api/v1/me", headers=headers).json()["error"]["code"] == "TOKEN_REVOKED"
    assert world.client.post("/api/v1/auth/login", json={"email": "sara@example.com", "password": PASSWORD}).status_code == 401
    world.login("sara@example.com", "Brand-new-pass-9")
    assert world.client.post("/api/v1/auth/reset-password", json={"token": token, "password": "Another-pass-77"}).json()["error"]["code"] == "INVALID_TOKEN"


def test_resend_verification(world: World) -> None:
    world.register("sara@example.com")
    assert world.client.post("/api/v1/auth/resend-verification", json={"email": "sara@example.com"}).status_code == 200
    assert len(world.outbox("sara@example.com")) == 2
    first, _second = world.outbox("sara@example.com")
    import re

    old = re.search(r"token=([\w-]+)", first["body_text"]).group(1)  # type: ignore[union-attr]
    assert world.client.post("/api/v1/auth/verify-email", json={"token": old}).status_code == 400  # superseded


def test_profile_update_and_password_change(world: World) -> None:
    headers = world.client_user("sara@example.com")
    r = world.client.patch("/api/v1/me", json={"full_name": "Sara  M. Ahmed", "phone": "+971 50 123 4567", "language": "ar"}, headers=headers)
    assert r.status_code == 200 and r.json()["full_name"] == "Sara M. Ahmed" and r.json()["language"] == "ar"
    assert world.client.patch("/api/v1/me", json={"phone": "call me"}, headers=headers).status_code == 422

    other = world.client.post("/api/v1/auth/login", json={"email": "sara@example.com", "password": PASSWORD}).json()
    this = world.client.post("/api/v1/auth/login", json={"email": "sara@example.com", "password": PASSWORD}).json()
    h = {"Authorization": f"Bearer {this['access_token']}"}
    r = world.client.post("/api/v1/me/password", json={"current_password": "wrong-pass-123", "new_password": "Brand-new-pass-9"}, headers=h)
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert world.client.post("/api/v1/me/password", json={"current_password": PASSWORD, "new_password": "Brand-new-pass-9"}, headers=h).status_code == 204
    # this browser keeps its session (refresh works), the other one is signed out
    assert world.client.post("/api/v1/auth/refresh", json={"refresh_token": this["refresh_token"]}).status_code == 200
    assert world.client.post("/api/v1/auth/refresh", json={"refresh_token": other["refresh_token"]}).status_code == 401


def test_two_factor_lifecycle(world: World) -> None:
    headers = world.client_user("sara@example.com")
    setup = world.client.post("/api/v1/me/2fa/setup", headers=headers).json()
    secret = setup["secret"]
    world.totp_secrets["sara@example.com"] = secret
    assert setup["otpauth_url"].startswith("otpauth://totp/Bolt%20Markets%3Asara%40example.com?secret=" + secret)
    assert world.client.post("/api/v1/me/2fa/enable", json={"code": "000000"}, headers=headers).json()["error"]["code"] == "INVALID_CODE"
    r = world.client.post("/api/v1/me/2fa/enable", json={"code": world.code("sara@example.com", -1)}, headers=headers)
    codes = r.json()["recovery_codes"]
    assert r.status_code == 200 and len(codes) == 10
    assert world.client.get("/api/v1/me", headers=headers).json()["totp_enabled"] is True

    def password_step() -> str:
        data = world.client.post("/api/v1/auth/login", json={"email": "sara@example.com", "password": PASSWORD}).json()
        assert data["mfa_required"] is True
        return str(data["mfa_token"])

    mfa = password_step()
    r = world.client.post("/api/v1/auth/login/2fa", json={"mfa_token": mfa, "code": "123456"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "INVALID_CODE"
    r = world.client.post("/api/v1/auth/login/2fa", json={"mfa_token": mfa, "code": codes[0].lower().replace("-", " ")})
    assert r.status_code == 200 and "access_token" in r.json()
    # a recovery code works once
    mfa = password_step()
    assert world.client.post("/api/v1/auth/login/2fa", json={"mfa_token": mfa, "code": codes[0]}).status_code == 401
    code = world.code("sara@example.com")
    r = world.client.post("/api/v1/auth/login/2fa", json={"mfa_token": mfa, "code": code})
    assert r.status_code == 200
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    # the same TOTP code cannot be replayed
    assert world.client.post("/api/v1/auth/login/2fa", json={"mfa_token": password_step(), "code": code}).status_code == 401
    assert world.client.post("/api/v1/auth/login/2fa", json={"mfa_token": "garbage", "code": code}).json()["error"]["code"] == "MFA_EXPIRED"

    r = world.client.post("/api/v1/me/2fa/disable", json={"password": "wrong-pass-1", "code": "000000"}, headers=headers)
    assert r.json()["error"]["code"] == "INVALID_CREDENTIALS"
    r = world.client.post("/api/v1/me/2fa/disable", json={"password": PASSWORD, "code": world.code("sara@example.com", 1)}, headers=headers)
    assert r.status_code == 204
    assert world.client.get("/api/v1/me", headers=headers).json()["totp_enabled"] is False
    assert totp_at(secret, 1)  # secret format stays valid base32


def test_rate_limit(make_world) -> None:
    w = make_world({"RATE_LIMITS": "true"})
    codes = [w.client.post("/api/v1/auth/forgot-password", json={"email": "x@example.com"}).status_code for _ in range(5)]
    assert codes[:3] == [200, 200, 200] and codes[3] == 429
    r = w.client.post("/api/v1/auth/forgot-password", json={"email": "x@example.com"})
    assert r.json()["error"]["code"] == "RATE_LIMITED" and r.headers["retry-after"] == "3600"
