"""The signed-in user's profile, password and two-factor settings."""
from __future__ import annotations

from typing import Any

from ..db import utcnow
from ..schemas import ChangePasswordIn, CodeIn, Disable2faIn, RecoveryCodesOut, TotpSetupOut, UpdateProfileIn, UserOut
from ..security import hash_password, new_recovery_codes, new_totp_secret, otpauth_url, token_hash, verify_password, verify_totp
from ..serializers import user_out
from ..services import emails
from ..services.container import audit
from ..web import Api, ApiError, Ctx, rate_limit
from .auth import check_second_factor

api = Api("/api/v1", tags=("profile",))


@api.get("/me", response=UserOut, summary="Current user")
def me(ctx: Ctx) -> dict[str, Any]:
    return user_out(ctx.me)


@api.patch("/me", body=UpdateProfileIn, response=UserOut, summary="Update name, phone or language")
def update_me(ctx: Ctx) -> dict[str, Any]:
    b: UpdateProfileIn = ctx.body
    data = {k: getattr(b, k) for k in b.model_fields_set if k in ("full_name", "phone", "language")}
    if "full_name" in data and data["full_name"] is None:
        del data["full_name"]
    if "language" in data and data["language"] is None:
        del data["language"]
    with ctx.db.tx() as c:
        user = c.update("users", ctx.me["id"], {**data, "updated_at": utcnow()})
        audit(c, ctx.me["id"], "user.profile_updated", "user", ctx.me["id"], {"fields": sorted(data)}, ctx.ip)
    assert user is not None
    return user_out(user)


@api.post("/me/password", body=ChangePasswordIn, summary="Change password (other sessions are signed out)")
def change_password(ctx: Ctx) -> None:
    b: ChangePasswordIn = ctx.body
    rate_limit(ctx, "change-password", 10, 3600, key=str(ctx.me["id"]))
    if not verify_password(b.current_password, ctx.me["password_hash"]):
        raise ApiError(400, "INVALID_CREDENTIALS", "Your current password is incorrect.", "كلمة المرور الحالية غير صحيحة.",
                       {"current_password": ("Your current password is incorrect.", "كلمة المرور الحالية غير صحيحة.")})
    if b.new_password == b.current_password:
        raise ApiError(422, "VALIDATION_ERROR", "Please check the highlighted fields.", "يرجى مراجعة الحقول المحددة.",
                       {"new_password": ("Choose a password you have not used here before.", "اختر كلمة مرور مختلفة عن الحالية.")})
    new_hash = hash_password(b.new_password, n=ctx.settings.scrypt_n)
    now = utcnow()
    with ctx.db.tx() as c:
        c.update("users", ctx.me["id"], {"password_hash": new_hash, "token_version": int(ctx.me["token_version"]) + 1, "updated_at": now})
        # Keep this browser signed in (its refresh token family survives); sign out everything else.
        c.exec("UPDATE refresh_tokens SET revoked_at = :now WHERE user_id = :u AND family_id <> :f AND revoked_at IS NULL",
               now=now, u=ctx.me["id"], f=ctx.me.get("_sid") or "")
        ctx.services.mailer.enqueue(c, ctx.me["email"], emails.password_changed(ctx.me["language"], ctx.me["full_name"]))
        audit(c, ctx.me["id"], "user.password_changed", "user", ctx.me["id"], None, ctx.ip)


@api.post("/me/2fa/setup", response=TotpSetupOut, summary="Start two-factor setup")
def setup_2fa(ctx: Ctx) -> dict[str, Any]:
    if ctx.me["totp_enabled"]:
        raise ApiError(409, "TWO_FACTOR_ALREADY_ON", "Two-factor authentication is already on.", "المصادقة الثنائية مفعّلة بالفعل.")
    secret = new_totp_secret()
    with ctx.db.tx() as c:
        c.update("users", ctx.me["id"], {"totp_secret": ctx.services.vault.encrypt_text(secret), "totp_last_step": None, "updated_at": utcnow()})
    return {"secret": secret, "otpauth_url": otpauth_url(secret, ctx.me["email"], ctx.settings.brand)}


@api.post("/me/2fa/enable", body=CodeIn, response=RecoveryCodesOut, summary="Confirm the first code and turn 2FA on")
def enable_2fa(ctx: Ctx) -> dict[str, Any]:
    rate_limit(ctx, "2fa-enable", 10, 300, key=str(ctx.me["id"]))
    if ctx.me["totp_enabled"]:
        raise ApiError(409, "TWO_FACTOR_ALREADY_ON", "Two-factor authentication is already on.", "المصادقة الثنائية مفعّلة بالفعل.")
    if not ctx.me["totp_secret"]:
        raise ApiError(409, "TWO_FACTOR_NOT_STARTED", "Start the setup first.", "ابدأ الإعداد أولًا.")
    step = verify_totp(ctx.services.vault.decrypt_text(ctx.me["totp_secret"]), ctx.body.code)
    if step is None:
        raise ApiError(400, "INVALID_CODE", "That code is not valid.", "الرمز غير صحيح.", {"code": ("That code is not valid.", "الرمز غير صحيح.")})
    codes = new_recovery_codes()
    with ctx.db.tx() as c:
        c.update("users", ctx.me["id"], {"totp_enabled": True, "totp_last_step": step, "recovery_codes": [token_hash(x) for x in codes], "updated_at": utcnow()})
        audit(c, ctx.me["id"], "user.2fa_enabled", "user", ctx.me["id"], None, ctx.ip)
    return {"recovery_codes": codes}


@api.post("/me/2fa/disable", body=Disable2faIn, summary="Turn two-factor authentication off")
def disable_2fa(ctx: Ctx) -> None:
    b: Disable2faIn = ctx.body
    rate_limit(ctx, "2fa-disable", 10, 300, key=str(ctx.me["id"]))
    if not ctx.me["totp_enabled"]:
        return None
    if not verify_password(b.password, ctx.me["password_hash"]):
        raise ApiError(400, "INVALID_CREDENTIALS", "Your password is incorrect.", "كلمة المرور غير صحيحة.",
                       {"password": ("Your password is incorrect.", "كلمة المرور غير صحيحة.")})
    with ctx.db.tx() as c:
        user = c.get("users", ctx.me["id"], lock=True)
        assert user is not None
        if not check_second_factor(ctx.services, c, user, b.code):
            ok = False
        else:
            ok = True
            c.update("users", user["id"], {"totp_enabled": False, "totp_secret": None, "totp_last_step": None, "recovery_codes": None, "updated_at": utcnow()})
            audit(c, user["id"], "user.2fa_disabled", "user", user["id"], None, ctx.ip)
    if not ok:
        raise ApiError(400, "INVALID_CODE", "That code is not valid.", "الرمز غير صحيح.", {"code": ("That code is not valid.", "الرمز غير صحيح.")})
    return None
