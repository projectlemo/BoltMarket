"""Pure-logic tests: crypto helpers, TOTP, signatures, SQL helpers."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

import pytest
from cryptography.exceptions import InvalidTag

from app.db import split_sql, to_pyformat
from app.schemas import to_cents
from app.security import (
    Vault,
    generate_trading_password,
    hash_password,
    new_recovery_codes,
    normalize_recovery_code,
    otpauth_url,
    password_problem,
    totp_at,
    verify_password,
    verify_totp,
)
from app.services.kyc import KycError, sniff_type, sumsub_verify
from app.services.payments import SignatureError, _canonical_js, nowpayments_sign, nowpayments_verify, stripe_sign, stripe_verify


def test_password_hash_roundtrip() -> None:
    stored = hash_password("correct horse 1", n=1024)
    assert stored.startswith("scrypt$1024$")
    assert verify_password("correct horse 1", stored)
    assert not verify_password("correct horse 2", stored)
    assert not verify_password("x", "garbage")


@pytest.mark.parametrize(
    ("password", "problem"),
    [("short1", "length"), ("onlyletterslong", "number"), ("1234567890123", "letter"), ("password123", "common"), ("Sunrise-2048x", None)],
)
def test_password_policy_matches_frontend(password: str, problem: str | None) -> None:
    assert password_problem(password) == problem


def test_totp_rfc6238_vector() -> None:
    # RFC 6238 appendix B, SHA-1 secret "12345678901234567890": T=59 -> 94287082 (last 6 digits 287082)
    secret = base64.b32encode(b"12345678901234567890").decode().rstrip("=")
    assert totp_at(secret, 59 // 30) == "287082"
    assert totp_at(secret, 1111111109 // 30) == "081804"


def test_totp_window_and_replay() -> None:
    secret = base64.b32encode(b"12345678901234567890").decode()
    now = 1_700_000_000.0
    step = int(now // 30)
    code = totp_at(secret, step)
    assert verify_totp(secret, code, now=now) == step
    assert verify_totp(secret, code[:3] + " " + code[3:], now=now) == step
    assert verify_totp(secret, totp_at(secret, step - 1), now=now) == step - 1
    assert verify_totp(secret, totp_at(secret, step - 2), now=now) is None
    assert verify_totp(secret, code, now=now, last_step=step) is None  # replay blocked
    assert verify_totp(secret, "abc", now=now) is None


def test_otpauth_url() -> None:
    url = otpauth_url("ABC", "a@b.com", "Bolt Markets")
    assert url.startswith("otpauth://totp/Bolt%20Markets%3Aa%40b.com?secret=ABC&issuer=Bolt%20Markets")


def test_recovery_codes() -> None:
    codes = new_recovery_codes()
    assert len(codes) == 10 and len(set(codes)) == 10
    assert all(len(c) == 9 and c[4] == "-" for c in codes)
    assert normalize_recovery_code(" abcd efgh ") == "ABCD-EFGH"


def test_trading_password_rules() -> None:
    for _ in range(50):
        p = generate_trading_password()
        assert len(p) == 12
        assert any(c.islower() for c in p) and any(c.isupper() for c in p) and any(c.isdigit() for c in p) and any(not c.isalnum() for c in p)


def test_vault_roundtrip_and_tamper() -> None:
    v = Vault("k" * 40)
    blob = v.encrypt(b"passport", b"aad")
    assert v.decrypt(blob, b"aad") == b"passport"
    with pytest.raises(InvalidTag):
        v.decrypt(blob, b"other-aad")
    tampered = blob[:-1] + bytes([blob[-1] ^ 1])
    with pytest.raises(InvalidTag):
        v.decrypt(tampered, b"aad")
    assert v.decrypt_text(v.encrypt_text("JBSWY3DPEHPK3PXP")) == "JBSWY3DPEHPK3PXP"
    with pytest.raises(InvalidTag):
        Vault("another key that differs").decrypt(blob, b"aad")


def test_to_pyformat() -> None:
    assert to_pyformat("SELECT * FROM t WHERE a = :a AND b = :b_2") == "SELECT * FROM t WHERE a = %(a)s AND b = %(b_2)s"
    assert to_pyformat("SELECT x::text FROM t WHERE y LIKE :q") == "SELECT x::text FROM t WHERE y LIKE %(q)s"
    assert to_pyformat("SELECT '50%' AS p, '12:30' AS t, 'http://x' AS u") == "SELECT '50%%' AS p, '12:30' AS t, 'http://x' AS u"


def test_split_sql() -> None:
    script = "-- comment\nCREATE TABLE a (\n  id INT\n);\n\nCREATE INDEX i ON a (id);\n"
    assert split_sql(script) == ["CREATE TABLE a (\n  id INT\n)", "CREATE INDEX i ON a (id)"]


def test_to_cents() -> None:
    assert to_cents(10) == 1000
    assert to_cents(10.5) == 1050
    assert to_cents("99.99") == 9999
    for bad in (0, -1, 1.234, "abc", 20_000_000):
        with pytest.raises(ValueError):
            to_cents(bad)


def test_sniff_type() -> None:
    assert sniff_type(b"\xff\xd8\xff\xe0rest") == "image/jpeg"
    assert sniff_type(b"\x89PNG\r\n\x1a\nrest") == "image/png"
    assert sniff_type(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image/webp"
    assert sniff_type(b"%PDF-1.4") == "application/pdf"
    assert sniff_type(b"<html>") is None


def test_stripe_signature() -> None:
    payload = b'{"id":"evt_1","type":"checkout.session.completed"}'
    header = stripe_sign("whsec_x", payload)
    assert stripe_verify("whsec_x", payload, header)["id"] == "evt_1"
    with pytest.raises(SignatureError):
        stripe_verify("whsec_other", payload, header)
    with pytest.raises(SignatureError):
        stripe_verify("whsec_x", payload, stripe_sign("whsec_x", payload, int(time.time()) - 3600))
    with pytest.raises(SignatureError):
        stripe_verify("whsec_x", payload, "")


def test_nowpayments_signature_matches_javascript_formatting() -> None:
    data = {"payment_status": "finished", "price_amount": 100.0, "order_id": "7", "fee": {"b": 1, "a": 0.5}, "pay_amount": 1e-7}
    assert _canonical_js(data) == '{"fee":{"a":0.5,"b":1},"order_id":"7","pay_amount":1e-7,"payment_status":"finished","price_amount":100}'
    raw = json.dumps(data).encode()
    assert nowpayments_verify("secret", raw, nowpayments_sign("secret", data))["order_id"] == "7"
    # Python-style canonical form is accepted too
    py = hmac.new(b"secret", json.dumps(data, sort_keys=True, separators=(",", ":")).encode(), hashlib.sha512).hexdigest()
    assert nowpayments_verify("secret", raw, py)
    with pytest.raises(SignatureError):
        nowpayments_verify("secret", raw, "00" * 64)


def test_sumsub_signature() -> None:
    body = b'{"type":"applicantReviewed"}'
    for alg, fn in (("HMAC_SHA256_HEX", hashlib.sha256), ("HMAC_SHA512_HEX", hashlib.sha512), ("HMAC_SHA1_HEX", hashlib.sha1)):
        digest = hmac.new(b"s3cret", body, fn).hexdigest()
        assert sumsub_verify("s3cret", body, digest, alg)["type"] == "applicantReviewed"
    with pytest.raises(KycError):
        sumsub_verify("s3cret", body, "bad", "HMAC_SHA256_HEX")
    with pytest.raises(KycError):
        sumsub_verify("s3cret", body, "x", "MD5")
