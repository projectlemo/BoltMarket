"""Registration, login (with optional 2FA), session refresh and password recovery."""
from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

from ..db import Conn, UniqueViolation, utcnow
from ..schemas import (
    EmailIn,
    Login2faIn,
    LoginIn,
    MfaRequiredOut,
    OkOut,
    RefreshIn,
    RegisterIn,
    ResetPasswordIn,
    TokenIn,
    TokenPairOut,
)
from ..security import (
    TokenInvalid,
    burn_password_check,
    create_access_token,
    create_mfa_token,
    decode_token,
    hash_password,
    new_referral_code,
    new_token,
    normalize_recovery_code,
    token_hash,
    verify_password,
    verify_totp,
)
from ..services import emails
from ..services.container import Services, audit
from ..services.domain import issue_action_token, send_verification
from ..web import Api, ApiError, Ctx, rate_limit

api = Api("/api/v1", tags=("auth",))

MAX_FAILED_LOGINS = 10
LOCK_MINUTES = 15


def invalid_credentials() -> ApiError:
    return ApiError(401, "INVALID_CREDENTIALS", "The email or password is incorrect.", "البريد الإلكتروني أو كلمة المرور غير صحيحة.")


def issue_session(services: Services, c: Conn, user: dict[str, Any], ip: str, user_agent: str, family: str | None = None) -> dict[str, Any]:
    now = utcnow()
    family = family or uuid.uuid4().hex
    refresh = new_token()
    c.insert("refresh_tokens", {
        "user_id": user["id"], "family_id": family, "token_hash": token_hash(refresh),
        "expires_at": now + timedelta(days=services.settings.refresh_token_days), "ip": ip, "user_agent": user_agent, "created_at": now,
    })
    return {
        "access_token": create_access_token(services.settings, user, family),
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": services.settings.access_token_minutes * 60,
    }


def check_second_factor(services: Services, c: Conn, user: dict[str, Any], code: str) -> bool:
    """Accepts a current TOTP code or an unused recovery code (which is then consumed)."""
    if user["totp_secret"]:
        secret = services.vault.decrypt_text(user["totp_secret"])
        step = verify_totp(secret, code, last_step=user["totp_last_step"])
        if step is not None:
            c.update("users", user["id"], {"totp_last_step": step})
            return True
    hashes = list(user["recovery_codes"] or [])
    candidate = token_hash(normalize_recovery_code(code))
    if candidate in hashes:
        hashes.remove(candidate)
        c.update("users", user["id"], {"recovery_codes": hashes, "updated_at": utcnow()})
        audit(c, user["id"], "auth.recovery_code_used", "user", user["id"])
        return True
    return False


@api.post("/auth/register", auth="public", body=RegisterIn, response=OkOut, status=201, summary="Create a client account")
def register(ctx: Ctx) -> dict[str, Any]:
    s = ctx.settings
    rate_limit(ctx, "register", 10, 3600)
    if not s.registration_open:
        raise ApiError(403, "REGISTRATION_CLOSED", "Account opening is not available at the moment.", "فتح الحسابات غير متاح في الوقت الحالي.")
    b: RegisterIn = ctx.body
    if b.country in s.restricted_countries:
        raise ApiError(403, "COUNTRY_RESTRICTED", "We cannot offer accounts to residents of this country.", "لا يمكننا تقديم حسابات للمقيمين في هذه الدولة.",
                       {"country": ("We cannot offer accounts to residents of this country.", "لا يمكننا تقديم حسابات للمقيمين في هذه الدولة.")})
    password_hash = hash_password(b.password, n=s.scrypt_n)
    taken = ApiError(409, "EMAIL_TAKEN", "An account with this email already exists.", "يوجد حساب بهذا البريد الإلكتروني بالفعل.",
                     {"email": ("An account with this email already exists. Try logging in.", "يوجد حساب بهذا البريد بالفعل. جرّب تسجيل الدخول.")})
    try:
        with ctx.db.tx() as c:
            if c.one("SELECT id FROM users WHERE email = :e", e=b.email):
                raise taken
            referrer = None
            if b.referral_code:
                referrer = c.one("SELECT id FROM users WHERE referral_code = :r", r=b.referral_code)
                if referrer is None:
                    raise ApiError(422, "VALIDATION_ERROR", "Please check the highlighted fields.", "يرجى مراجعة الحقول المحددة.",
                                   {"referral_code": ("We could not find this referral code.", "لم نعثر على رمز الإحالة هذا.")})
            code = new_referral_code()
            while c.one("SELECT id FROM users WHERE referral_code = :r", r=code):
                code = new_referral_code()
            now = utcnow()
            user = c.insert("users", {
                "email": b.email, "password_hash": password_hash, "full_name": b.full_name, "country": b.country, "language": b.language,
                "role": "client", "status": "active", "token_version": 0, "totp_enabled": False, "kyc_status": "none",
                "referral_code": code, "referred_by": referrer["id"] if referrer else None, "terms_accepted_at": now,
                "failed_logins": 0, "created_at": now, "updated_at": now,
            })
            send_verification(ctx.services, c, user, b.language)
            audit(c, user["id"], "user.registered", "user", user["id"], {"country": b.country, "referred_by": user["referred_by"]}, ctx.ip)
    except UniqueViolation as exc:
        raise taken from exc
    return {"ok": True}


@api.post("/auth/login", auth="public", body=LoginIn, response=TokenPairOut | MfaRequiredOut, summary="Log in with email and password")
def login(ctx: Ctx) -> dict[str, Any]:
    b: LoginIn = ctx.body
    rate_limit(ctx, "login", 30, 300)
    rate_limit(ctx, "login-email", 10, 300, key=b.email)
    s = ctx.settings
    with ctx.db.tx() as c:
        user = c.one("SELECT * FROM users WHERE email = :e", e=b.email)
    if user is None:
        burn_password_check(b.password, s.scrypt_n)
        raise invalid_credentials()
    now = utcnow()
    if user["locked_until"] and user["locked_until"] > now:
        raise ApiError(429, "ACCOUNT_LOCKED", "Too many failed attempts. Try again in 15 minutes or reset your password.",
                       "محاولات فاشلة كثيرة. حاول مجددًا بعد 15 دقيقة أو أعد تعيين كلمة المرور.")
    if not verify_password(b.password, user["password_hash"]):
        with ctx.db.tx() as c:
            failed = int(user["failed_logins"]) + 1
            data: dict[str, Any] = {"failed_logins": failed}
            if failed >= MAX_FAILED_LOGINS:
                data = {"failed_logins": 0, "locked_until": now + timedelta(minutes=LOCK_MINUTES)}
                audit(c, user["id"], "auth.locked", "user", user["id"], None, ctx.ip)
            c.update("users", user["id"], data)
        raise invalid_credentials()
    if user["status"] != "active":
        raise ApiError(403, "ACCOUNT_SUSPENDED", "This account is suspended. Please contact support.", "هذا الحساب موقوف. يرجى التواصل مع الدعم.")
    if user["email_verified_at"] is None:
        raise ApiError(403, "EMAIL_NOT_VERIFIED", "Please confirm your email address first.", "يرجى تأكيد بريدك الإلكتروني أولًا.")
    with ctx.db.tx() as c:
        c.update("users", user["id"], {"failed_logins": 0, "locked_until": None})
        if user["totp_enabled"]:
            return {"mfa_required": True, "mfa_token": create_mfa_token(s, user)}
        c.update("users", user["id"], {"last_login_at": now})
        audit(c, user["id"], "auth.login", "user", user["id"], None, ctx.ip)
        return issue_session(ctx.services, c, user, ctx.ip, ctx.user_agent)


@api.post("/auth/login/2fa", auth="public", body=Login2faIn, response=TokenPairOut, summary="Finish logging in with a 2FA code")
def login_2fa(ctx: Ctx) -> dict[str, Any]:
    b: Login2faIn = ctx.body
    expired = ApiError(401, "MFA_EXPIRED", "The login request expired. Please log in again.", "انتهت صلاحية طلب الدخول. يرجى تسجيل الدخول مجددًا.")
    try:
        payload = decode_token(ctx.settings, b.mfa_token, "mfa")
    except TokenInvalid as exc:
        raise expired from exc
    rate_limit(ctx, "login-2fa", 10, 300, key=str(payload["sub"]))
    with ctx.db.tx() as c:
        user = c.get("users", int(payload["sub"]), lock=True)
        if user is None or int(payload.get("tv", -1)) != user["token_version"] or not user["totp_enabled"]:
            raise expired
        if user["status"] != "active":
            raise ApiError(403, "ACCOUNT_SUSPENDED", "This account is suspended. Please contact support.", "هذا الحساب موقوف. يرجى التواصل مع الدعم.")
        if not check_second_factor(ctx.services, c, user, b.code):
            audit(c, user["id"], "auth.2fa_failed", "user", user["id"], None, ctx.ip)
            ok = False
        else:
            ok = True
            c.update("users", user["id"], {"last_login_at": utcnow()})
            audit(c, user["id"], "auth.login", "user", user["id"], {"mfa": True}, ctx.ip)
            pair = issue_session(ctx.services, c, user, ctx.ip, ctx.user_agent)
    if not ok:
        raise ApiError(401, "INVALID_CODE", "That code is not valid.", "الرمز غير صحيح.")
    return pair


@api.post("/auth/refresh", auth="public", body=RefreshIn, response=TokenPairOut, summary="Rotate the refresh token")
def refresh(ctx: Ctx) -> dict[str, Any]:
    b: RefreshIn = ctx.body
    invalid = ApiError(401, "INVALID_REFRESH", "Please log in again.", "يرجى تسجيل الدخول مجددًا.")
    now = utcnow()
    with ctx.db.tx() as c:
        row = c.one("SELECT * FROM refresh_tokens WHERE token_hash = :h" + c.for_update, h=token_hash(b.refresh_token))
        if row is None or row["revoked_at"] is not None or row["expires_at"] <= now:
            raise invalid
        if row["used_at"] is not None:
            if now - row["used_at"] < timedelta(seconds=30):
                # Another tab refreshed a moment ago: keep the session, let the caller pick up the new token.
                raise ApiError(409, "REFRESH_IN_PROGRESS", "Please retry.", "يرجى إعادة المحاولة.")
            c.exec("UPDATE refresh_tokens SET revoked_at = :now WHERE family_id = :f AND revoked_at IS NULL", now=now, f=row["family_id"])
            audit(c, row["user_id"], "auth.refresh_reuse", "user", row["user_id"], {"family": row["family_id"]}, ctx.ip)
            reuse = True
        else:
            reuse = False
            user = c.get("users", row["user_id"])
            if user is None or user["status"] != "active":
                raise invalid
            c.update("refresh_tokens", row["id"], {"used_at": now})
            pair = issue_session(ctx.services, c, user, ctx.ip, ctx.user_agent, family=row["family_id"])
    if reuse:
        raise invalid
    return pair


@api.post("/auth/logout", auth="public", body=RefreshIn, summary="End the session")
def logout(ctx: Ctx) -> None:
    b: RefreshIn = ctx.body
    with ctx.db.tx() as c:
        row = c.one("SELECT family_id FROM refresh_tokens WHERE token_hash = :h", h=token_hash(b.refresh_token))
        if row:
            c.exec("UPDATE refresh_tokens SET revoked_at = :now WHERE family_id = :f AND revoked_at IS NULL", now=utcnow(), f=row["family_id"])


def _use_action_token(c: Conn, token: str, purpose: str) -> dict[str, Any]:
    row = c.one("SELECT * FROM action_tokens WHERE token_hash = :h AND purpose = :p" + c.for_update, h=token_hash(token), p=purpose)
    if row is None or row["used_at"] is not None:
        raise ApiError(400, "INVALID_TOKEN", "This link is not valid any more.", "هذا الرابط لم يعد صالحًا.")
    if row["expires_at"] <= utcnow():
        raise ApiError(400, "TOKEN_EXPIRED", "This link has expired. Request a new one.", "انتهت صلاحية هذا الرابط. اطلب رابطًا جديدًا.")
    c.update("action_tokens", row["id"], {"used_at": utcnow()})
    return row


@api.post("/auth/verify-email", auth="public", body=TokenIn, response=OkOut, summary="Confirm an email address")
def verify_email(ctx: Ctx) -> dict[str, Any]:
    rate_limit(ctx, "verify", 30, 3600)
    with ctx.db.tx() as c:
        row = _use_action_token(c, ctx.body.token, "verify_email")
        user = c.get("users", row["user_id"])
        if user and user["email_verified_at"] is None:
            c.update("users", user["id"], {"email_verified_at": utcnow(), "updated_at": utcnow()})
            audit(c, user["id"], "user.email_verified", "user", user["id"], None, ctx.ip)
    return {"ok": True}


@api.post("/auth/resend-verification", auth="public", body=EmailIn, response=OkOut, summary="Send the confirmation email again")
def resend_verification(ctx: Ctx) -> dict[str, Any]:
    b: EmailIn = ctx.body
    rate_limit(ctx, "resend", 10, 3600)
    rate_limit(ctx, "resend-email", 3, 3600, key=b.email)
    with ctx.db.tx() as c:
        user = c.one("SELECT * FROM users WHERE email = :e", e=b.email)
        if user and user["email_verified_at"] is None and user["status"] == "active":
            send_verification(ctx.services, c, user, b.language)
    return {"ok": True}


@api.post("/auth/forgot-password", auth="public", body=EmailIn, response=OkOut, summary="Email a password reset link")
def forgot_password(ctx: Ctx) -> dict[str, Any]:
    b: EmailIn = ctx.body
    rate_limit(ctx, "forgot", 10, 3600)
    rate_limit(ctx, "forgot-email", 3, 3600, key=b.email)
    with ctx.db.tx() as c:
        user = c.one("SELECT * FROM users WHERE email = :e", e=b.email)
        if user and user["status"] == "active":
            lang = b.language or user["language"]
            token = issue_action_token(c, user["id"], "reset_password", timedelta(hours=1))
            link = ctx.services.portal_link(f"/reset-password?token={token}", lang)
            ctx.services.mailer.enqueue(c, user["email"], emails.reset_password(lang, user["full_name"], link))
            audit(c, user["id"], "auth.reset_requested", "user", user["id"], None, ctx.ip)
    return {"ok": True}


@api.post("/auth/reset-password", auth="public", body=ResetPasswordIn, response=OkOut, summary="Set a new password from a reset link")
def reset_password(ctx: Ctx) -> dict[str, Any]:
    b: ResetPasswordIn = ctx.body
    rate_limit(ctx, "reset", 20, 3600)
    password_hash = hash_password(b.password, n=ctx.settings.scrypt_n)
    with ctx.db.tx() as c:
        row = _use_action_token(c, b.token, "reset_password")
        user = c.get("users", row["user_id"], lock=True)
        if user is None:
            raise ApiError(400, "INVALID_TOKEN", "This link is not valid any more.", "هذا الرابط لم يعد صالحًا.")
        now = utcnow()
        c.update("users", user["id"], {
            "password_hash": password_hash, "token_version": int(user["token_version"]) + 1, "failed_logins": 0, "locked_until": None,
            "email_verified_at": user["email_verified_at"] or now, "updated_at": now,
        })
        c.exec("UPDATE refresh_tokens SET revoked_at = :now WHERE user_id = :u AND revoked_at IS NULL", now=now, u=user["id"])
        ctx.services.mailer.enqueue(c, user["email"], emails.password_changed(user["language"], user["full_name"]))
        audit(c, user["id"], "auth.password_reset", "user", user["id"], None, ctx.ip)
    return {"ok": True}
