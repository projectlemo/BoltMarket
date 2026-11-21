"""Shared fixtures. Tests run against SQLite by default; set TEST_DATABASE_URL to a PostgreSQL URL
(as the CI workflow does) to run the same suite on PostgreSQL."""
from __future__ import annotations

import json
import os
import re
import time
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any

import pytest
from starlette.testclient import TestClient

from app.config import Settings
from app.db import Database, utcnow
from app.main import create_app
from app.security import hash_password, new_totp_secret, totp_at
from app.services.container import Services
from app.services.http import HttpResponse

PASSWORD = "Sunrise-2048x"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.7\n" + b"0" * 64

BASE_ENV = {
    "ENVIRONMENT": "test",
    "SECRET_KEY": "test-secret-key-0123456789abcdef0123456789",
    "DATA_KEY": "test-data-key-0123456789abcdef0123456789",
    "SCRYPT_N": "1024",
    "FRONTEND_URL": "https://example.github.io/bolt-markets",
    "ADMIN_URL": "https://example.github.io/bolt-markets/admin",
    "PUBLIC_API_URL": "https://api.example.com",
    "MT5_MODE": "mock",
    "MT5_SERVER_LIVE": "BoltMarkets-Live",
    "MT5_SERVER_DEMO": "BoltMarkets-Demo",
    "QUOTES_MODE": "bridge",
    "QUOTES_BRIDGE_KEY": "bridge-key-123",
    "STRIPE_SECRET_KEY": "sk_test_dummy",
    "STRIPE_WEBHOOK_SECRET": "whsec_test",
    "NOWPAYMENTS_API_KEY": "np-key",
    "NOWPAYMENTS_IPN_SECRET": "np-ipn-secret",
    "KYC_PROVIDER": "manual",
    "SUPPORT_INBOX": "support@example.com",
    "RATE_LIMITS": "false",
    "REGISTRATION_OPEN": "true",
    "AUTO_MIGRATE": "true",
    "VALIDATE_RESPONSES": "true",
}


class FakeHttp:
    """Records outbound calls and answers them from a list of (url fragment, response) rules."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.rules: list[tuple[str, HttpResponse]] = []

    def on(self, fragment: str, status: int = 200, payload: Any = None) -> None:
        self.rules.insert(0, (fragment, HttpResponse(status, json.dumps(payload or {}).encode())))

    def request(self, method: str, url: str, *, headers: dict[str, str] | None = None, body: bytes | None = None, timeout: float | None = None) -> HttpResponse:
        self.calls.append({"method": method, "url": url, "headers": headers or {}, "body": body or b""})
        for fragment, response in self.rules:
            if fragment in url:
                return response
        return HttpResponse(404, b'{"error":"no fake rule"}')

    def post_json(self, url: str, payload: Any, headers: dict[str, str] | None = None) -> HttpResponse:
        return self.request("POST", url, headers={"Content-Type": "application/json", **(headers or {})}, body=json.dumps(payload).encode())

    def last(self, fragment: str) -> dict[str, Any]:
        for call in reversed(self.calls):
            if fragment in call["url"]:
                return call
        raise AssertionError(f"no call to {fragment}")


def _reset_postgres(url: str) -> None:
    db = Database(url, pool_size=1)
    with db.tx() as c:
        c.exec("DROP SCHEMA public CASCADE")
        c.exec("CREATE SCHEMA public")
    db.close()


@dataclass
class World:
    client: TestClient
    services: Services
    http: FakeHttp
    env: dict[str, str] = field(default_factory=dict)

    # -- helpers ------------------------------------------------------------------------------
    @property
    def db(self) -> Database:
        return self.services.db

    def outbox(self, to: str | None = None) -> list[dict[str, Any]]:
        with self.db.tx() as c:
            rows = c.all("SELECT * FROM email_outbox ORDER BY id")
        return [r for r in rows if to is None or r["to_email"] == to]

    def token_from_email(self, to: str, kind: str) -> str:
        for row in reversed(self.outbox(to)):
            m = re.search(rf"/{kind}/\?token=([A-Za-z0-9_\-]+)", row["body_text"])
            if m:
                return m.group(1)
        raise AssertionError(f"no {kind} email for {to}")

    def register(self, email: str = "sara@example.com", name: str = "Sara Ahmed", country: str = "AE", **extra: Any) -> Any:
        body = {"full_name": name, "email": email, "password": PASSWORD, "country": country, "accept_terms": True, **extra}
        return self.client.post("/api/v1/auth/register", json=body)

    def client_user(self, email: str = "sara@example.com", *, kyc: bool = False, **extra: Any) -> dict[str, str]:
        """Registers, verifies and logs in a client. Returns auth headers."""
        r = self.register(email, **extra)
        assert r.status_code == 201, r.text
        token = self.token_from_email(email, "verify-email")
        assert self.client.post("/api/v1/auth/verify-email", json={"token": token}).status_code == 200
        if kyc:
            with self.db.tx() as c:
                c.exec("UPDATE users SET kyc_status = 'approved' WHERE email = :e", e=email)
        return self.login(email)

    def login(self, email: str, password: str = PASSWORD) -> dict[str, str]:
        r = self.client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert r.status_code == 200, r.text
        data = r.json()
        if data.get("mfa_required"):
            with self.db.tx() as c:  # test shortcut: allow the current code even if it was just used
                c.exec("UPDATE users SET totp_last_step = NULL WHERE email = :e", e=email)
            r = self.client.post("/api/v1/auth/login/2fa", json={"mfa_token": data["mfa_token"], "code": self.code(email)})
            assert r.status_code == 200, r.text
            data = r.json()
        return {"Authorization": f"Bearer {data['access_token']}"}

    totp_secrets: dict[str, str] = field(default_factory=dict)

    def code(self, email: str, offset: int = 0) -> str:
        return totp_at(self.totp_secrets[email], int(time.time() // 30) + offset)

    def staff(self, role: str = "admin", email: str | None = None, *, two_factor: bool = True) -> dict[str, str]:
        email = email or f"{role}@bolt.test"
        secret = new_totp_secret()
        now = utcnow()
        with self.db.tx() as c:
            c.insert("users", {
                "email": email, "password_hash": hash_password(PASSWORD, n=1024), "full_name": f"{role.title()} Staff", "country": "--", "language": "en",
                "role": role, "status": "active", "email_verified_at": now, "token_version": 0, "totp_enabled": two_factor,
                "totp_secret": self.services.vault.encrypt_text(secret) if two_factor else None, "kyc_status": "none",
                "referral_code": f"S{role[:3].upper()}{len(email):04d}{abs(hash(email)) % 1000:03d}", "terms_accepted_at": now, "failed_logins": 0,
                "created_at": now, "updated_at": now,
            })
        self.totp_secrets[email] = secret
        return self.login(email)

    def user_id(self, email: str) -> int:
        with self.db.tx() as c:
            return int(c.val("SELECT id FROM users WHERE email = :e", e=email))

    def mock_mt5(self) -> Any:
        return self.services.mt5


def build_world(monkeypatch: pytest.MonkeyPatch, tmp_path: Any, overrides: dict[str, str] | None = None) -> Iterator[World]:
    env = {**BASE_ENV, **(overrides or {})}
    pg = os.environ.get("TEST_DATABASE_URL", "")
    if "DATABASE_URL" not in (overrides or {}):
        env["DATABASE_URL"] = pg or f"sqlite:///{tmp_path}/bolt-test.db"
    if env["DATABASE_URL"].startswith("postgres"):
        _reset_postgres(env["DATABASE_URL"])
    prefixes = ("MT5_", "SMTP_", "SUMSUB_", "STRIPE_", "NOWPAYMENTS_", "BOOTSTRAP_", "FUNDED_", "QUOTE", "KYC_", "GITHUB_")
    for key in list(os.environ):
        if key.lower() in Settings.__dataclass_fields__ or key.startswith(prefixes) or key in ("CORS_ORIGINS", "AUTO_MIGRATE"):
            monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    settings = Settings()
    http = FakeHttp()
    services = Services.create(settings, http=http)  # type: ignore[arg-type]
    app = create_app(settings, services)
    with TestClient(app, base_url="https://api.example.com") as client:
        yield World(client=client, services=services, http=http, env=env)
    services.db.close()


@pytest.fixture
def world(monkeypatch: pytest.MonkeyPatch, tmp_path: Any) -> Iterator[World]:
    yield from build_world(monkeypatch, tmp_path)


@pytest.fixture
def make_world(monkeypatch: pytest.MonkeyPatch, tmp_path: Any) -> Any:
    """For tests that need different settings: ``w = make_world({"MT5_MODE": "disabled"})``."""
    worlds: list[Iterator[World]] = []

    def factory(overrides: dict[str, str]) -> World:
        gen = build_world(monkeypatch, tmp_path, overrides)
        worlds.append(gen)
        return next(gen)

    yield factory
    for gen in worlds:
        try:
            next(gen)
        except StopIteration:
            pass
