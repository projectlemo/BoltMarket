"""Passwords, tokens, TOTP two-factor codes and encryption at rest."""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote

import jwt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import Settings

# --- passwords ---------------------------------------------------------------------------

_SCRYPT_R = 8
_SCRYPT_P = 1
_COMMON_PASSWORDS = {
    "password", "password1", "12345678", "123456789", "qwerty123", "11111111", "abc12345",
    "iloveyou1", "bolt1234", "trading1", "1234567890", "password123", "qwertyuiop", "bolt12345678",
}


def hash_password(password: str, *, n: int = 2**15) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=n, r=_SCRYPT_R, p=_SCRYPT_P, dklen=32, maxmem=128 * 1024 * 1024)
    b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
    return f"scrypt${n}${_SCRYPT_R}${_SCRYPT_P}${b64(salt)}${b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest)
        actual = hashlib.scrypt(
            password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p), dklen=len(expected), maxmem=128 * 1024 * 1024
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


_DUMMY_HASHES: dict[int, str] = {}


def burn_password_check(password: str, n: int) -> None:
    """Spend the same time as a real check so unknown emails cannot be detected by timing."""
    if n not in _DUMMY_HASHES:
        _DUMMY_HASHES[n] = hash_password("not-a-real-password", n=n)
    verify_password(password, _DUMMY_HASHES[n])


def password_problem(password: str) -> str | None:
    """Mirrors frontend/src/lib/validate.ts: 10+ characters, a letter, a number, not common."""
    if len(password) < 10:
        return "length"
    if len(password) > 200:
        return "too_long"
    if not any(ch.isalpha() for ch in password):
        return "letter"
    if not any(ch.isdigit() for ch in password):
        return "number"
    if password.lower() in _COMMON_PASSWORDS:
        return "common"
    return None


# --- opaque tokens ------------------------------------------------------------------------

def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def random_code(length: int) -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))


def new_referral_code() -> str:
    return random_code(8)


def new_recovery_codes(count: int = 10) -> list[str]:
    return [f"{random_code(4)}-{random_code(4)}" for _ in range(count)]


def normalize_recovery_code(code: str) -> str:
    cleaned = "".join(ch for ch in code.upper() if ch.isalnum())
    return f"{cleaned[:4]}-{cleaned[4:]}" if len(cleaned) == 8 else cleaned


def generate_trading_password() -> str:
    """MT5-compatible: upper, lower, digit and symbol, 12 characters."""
    lower, upper, digits, symbols = "abcdefghjkmnpqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "#@!$%&*"
    chars = [secrets.choice(lower), secrets.choice(upper), secrets.choice(digits), secrets.choice(symbols)]
    pool = lower + upper + digits
    chars += [secrets.choice(pool) for _ in range(8)]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


# --- JWT -----------------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(UTC)


def create_access_token(settings: Settings, user: dict[str, Any], sid: str | None = None) -> str:
    now = _now()
    payload = {
        "sub": str(user["id"]),
        "role": user["role"],
        "tv": int(user["token_version"]),
        "sid": sid or "",
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_mfa_token(settings: Settings, user: dict[str, Any]) -> str:
    now = _now()
    payload = {
        "sub": str(user["id"]),
        "tv": int(user["token_version"]),
        "type": "mfa",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=5)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


class TokenInvalid(Exception):
    def __init__(self, expired: bool = False) -> None:
        super().__init__("expired" if expired else "invalid")
        self.expired = expired


def decode_token(settings: Settings, token: str, expected_type: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], options={"require": ["exp", "sub", "type"]})
    except jwt.ExpiredSignatureError as exc:
        raise TokenInvalid(expired=True) from exc
    except jwt.PyJWTError as exc:
        raise TokenInvalid() from exc
    if payload.get("type") != expected_type:
        raise TokenInvalid()
    return payload


# --- TOTP (RFC 6238) ---------------------------------------------------------------------------

def new_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def totp_at(secret: str, step: int, digits: int = 6) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    mac = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = mac[-1] & 0x0F
    value = struct.unpack(">I", mac[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % 10**digits).zfill(digits)


def verify_totp(secret: str, code: str, *, last_step: int | None = None, now: float | None = None, window: int = 1) -> int | None:
    """Returns the matched time step, or None. Codes at or before ``last_step`` are rejected (no replay)."""
    code = "".join(ch for ch in code if ch.isdigit())
    if len(code) != 6:
        return None
    current = int((now if now is not None else time.time()) // 30)
    for step in range(current - window, current + window + 1):
        if last_step is not None and step <= last_step:
            continue
        if hmac.compare_digest(totp_at(secret, step), code):
            return step
    return None


def otpauth_url(secret: str, email: str, issuer: str) -> str:
    label = quote(f"{issuer}:{email}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}&algorithm=SHA1&digits=6&period=30"


# --- encryption at rest ------------------------------------------------------------------------

class Vault:
    """AES-256-GCM with a key derived from DATA_KEY. Used for KYC files and 2FA secrets."""

    def __init__(self, key_material: str) -> None:
        self._aes = AESGCM(hashlib.sha256(("bolt-vault:" + key_material).encode()).digest())

    def encrypt(self, data: bytes, aad: bytes = b"") -> bytes:
        nonce = secrets.token_bytes(12)
        return b"v1" + nonce + self._aes.encrypt(nonce, data, aad)

    def decrypt(self, blob: bytes, aad: bytes = b"") -> bytes:
        if blob[:2] != b"v1":
            raise ValueError("unknown ciphertext version")
        return self._aes.decrypt(blob[2:14], blob[14:], aad)

    def encrypt_text(self, text: str) -> str:
        return "v1:" + base64.urlsafe_b64encode(self.encrypt(text.encode())).decode()

    def decrypt_text(self, value: str) -> str:
        if not value.startswith("v1:"):
            raise ValueError("unknown ciphertext version")
        return self.decrypt(base64.urlsafe_b64decode(value[3:])).decode()
