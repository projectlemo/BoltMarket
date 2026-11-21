"""MT5 gateways, email delivery, live price streaming, CLI and start-up checks."""
from __future__ import annotations

import hashlib
import io
import json
import socket
import ssl
import threading
import time
import urllib.error
import urllib.request
from contextlib import redirect_stdout
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

from app import cli
from app.config import Settings, get_settings
from app.db import Database
from app.main import create_app
from app.services import mailer as mailer_module
from app.services.emails import verify_email
from app.services.http import HttpResponse
from app.services.mt5 import BridgeGateway, Mt5Error, WebApiGateway, make_gateway
from tests.conftest import BASE_ENV, FakeHttp


def settings_with(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, **env: str) -> Settings:
    for key, value in {**BASE_ENV, "DATABASE_URL": f"sqlite:///{tmp_path}/x.db", **env}.items():
        monkeypatch.setenv(key, value)
    return Settings()


# --- MT5 Web API ----------------------------------------------------------------------------------

MANAGER_PASSWORD = "Manager#Pass1"


class FakeMt5Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    log: list[tuple[str, dict[str, str]]] = []
    connections = 0

    def setup(self) -> None:
        super().setup()
        type(self).connections += 1
        self.srv_rand = b""
        self.authed = False

    def log_message(self, *args: Any) -> None:  # silence
        pass

    def reply(self, data: dict[str, Any]) -> None:
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        url = urlsplit(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        type(self).log.append((url.path, q))
        secret = hashlib.md5(hashlib.md5(MANAGER_PASSWORD.encode("utf-16-le")).digest() + b"WebAPI").digest()  # noqa: S324
        if url.path == "/api/auth/start":
            self.srv_rand = b"\x01" * 16
            return self.reply({"retcode": "0 Done", "srv_rand": self.srv_rand.hex()})
        if url.path == "/api/auth/answer":
            if q.get("srv_rand_answer") != hashlib.md5(secret + self.srv_rand).hexdigest():  # noqa: S324
                return self.reply({"retcode": "3006 Invalid account or password"})
            self.authed = True
            return self.reply({"retcode": "0 Done", "cli_rand_answer": hashlib.md5(secret + bytes.fromhex(q["cli_rand"])).hexdigest()})  # noqa: S324
        if not self.authed:
            return self.reply({"retcode": "8 Not authorized"})
        answers = {
            "/api/user/add": {"Login": "300001"},
            "/api/user/account/get": {"Login": q.get("login"), "Balance": "100.00", "Equity": "95.50", "MarginFree": "90.25"},
            "/api/trade/balance": {"ticket": "777"},
            "/api/user/get": {"Rights": "483"},
        }
        if url.path in answers:
            return self.reply({"retcode": "0 Done", "answer": answers[url.path]})
        if url.path in ("/api/user/change_password", "/api/user/update"):
            return self.reply({"retcode": "0 Done"})
        return self.reply({"retcode": "1 Common error"})


@pytest.fixture
def fake_mt5_server(tmp_path: Path) -> Any:
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    now = datetime.now(UTC)
    cert = x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number()) \
        .not_valid_before(now - timedelta(days=1)).not_valid_after(now + timedelta(days=1)).sign(key, hashes.SHA256())
    (tmp_path / "cert.pem").write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    (tmp_path / "key.pem").write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(tmp_path / "cert.pem", tmp_path / "key.pem")
    FakeMt5Handler.log, FakeMt5Handler.connections = [], 0
    server = ThreadingHTTPServer(("127.0.0.1", 0), FakeMt5Handler)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"https://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


def test_webapi_gateway_protocol(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, fake_mt5_server: str) -> None:
    s = settings_with(monkeypatch, tmp_path, MT5_MODE="webapi", MT5_WEBAPI_URL=fake_mt5_server, MT5_MANAGER_LOGIN="1000",
                      MT5_MANAGER_PASSWORD=MANAGER_PASSWORD, MT5_WEBAPI_VERIFY_TLS="false")
    gw = make_gateway(s, FakeHttp())  # type: ignore[arg-type]
    assert isinstance(gw, WebApiGateway) and gw.enabled
    created = gw.create_account(kind="live", group="real\\pro", name="Sara Ahmed", email="s@example.com", country="AE", phone=None,
                                leverage=200, password="Aa1#aaaaaaaa", investor_password="Bb2#bbbbbbbb")
    assert created.login == "300001" and created.server == "BoltMarkets-Live"
    info = gw.account_info("300001")
    assert (info.balance, info.equity, info.margin_free) == (Decimal("100.00"), Decimal("95.50"), Decimal("90.25"))
    assert gw.balance("300001", Decimal("-25"), "Withdrawal #9") == "777"
    gw.set_password("300001", "Cc3#cccccccc")
    gw.set_enabled("300001", False)
    calls = dict(FakeMt5Handler.log)
    assert calls["/api/user/add"]["group"] == "real\\pro" and calls["/api/user/add"]["leverage"] == "200" and "phone" not in calls["/api/user/add"]
    assert calls["/api/trade/balance"] == {"login": "300001", "type": "2", "balance": "-25.00", "comment": "Withdrawal #9", "check_margin": "1"}
    assert calls["/api/user/update"]["rights"] == str(483 & ~1)
    assert [p for p, _ in FakeMt5Handler.log].count("/api/auth/start") == 1 and FakeMt5Handler.connections == 1  # one kept-alive session


def test_webapi_gateway_rejects_wrong_password(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, fake_mt5_server: str) -> None:
    s = settings_with(monkeypatch, tmp_path, MT5_MODE="webapi", MT5_WEBAPI_URL=fake_mt5_server, MT5_MANAGER_LOGIN="1000",
                      MT5_MANAGER_PASSWORD="wrong", MT5_WEBAPI_VERIFY_TLS="false")
    with pytest.raises(Mt5Error, match="3006"):
        WebApiGateway(s).account_info("1")


def test_bridge_gateway(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    s = settings_with(monkeypatch, tmp_path, MT5_MODE="bridge", MT5_BRIDGE_URL="https://bridge.example.com", MT5_BRIDGE_KEY="k1")
    http = FakeHttp()
    gw = make_gateway(s, http)  # type: ignore[arg-type]
    assert isinstance(gw, BridgeGateway)
    http.on("/accounts", 200, {"login": "400100"})
    assert gw.create_account(kind="demo", group="demo\\standard", name="A B", email="a@b.co", country="AE", phone="+971",
                             leverage=100, password="p", investor_password="i").login == "400100"
    assert json.loads(http.last("/accounts")["body"])["password"] == "p" and http.last("/accounts")["headers"]["X-Bridge-Key"] == "k1"
    http.on("/accounts/400100", 200, {"balance": "10", "equity": "9.5", "margin_free": "9"})
    assert gw.account_info("400100").equity == Decimal("9.5")
    http.on("/accounts/400100/balance", 400, {"error": "not enough money"})
    with pytest.raises(Mt5Error, match="not enough money"):
        gw.balance("400100", Decimal("-50"), "x")


def test_mt5_settings_fallbacks(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    s = settings_with(monkeypatch, tmp_path, MT5_MODE="webapi")  # no URL/credentials -> stays off
    assert make_gateway(s, FakeHttp()).enabled is False  # type: ignore[arg-type]


# --- email ------------------------------------------------------------------------------------------------

class FakeSMTP:
    instances: list[FakeSMTP] = []
    fail = False

    def __init__(self, host: str, port: int, timeout: float = 0, context: Any = None) -> None:
        self.host, self.port, self.calls = host, port, []
        FakeSMTP.instances.append(self)

    def __enter__(self) -> FakeSMTP:
        return self

    def __exit__(self, *exc: Any) -> None:
        self.calls.append("quit")

    def starttls(self, context: Any = None) -> None:
        self.calls.append("starttls")

    def login(self, user: str, password: str) -> None:
        self.calls.append(f"login:{user}")

    def send_message(self, msg: Any) -> None:
        if FakeSMTP.fail:
            import smtplib

            raise smtplib.SMTPServerDisconnected("gone")
        self.calls.append(msg)


def test_mailer_smtp_delivery_and_retries(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    s = settings_with(monkeypatch, tmp_path, SMTP_HOST="smtp.example.com", SMTP_PORT="587", SMTP_USER="mailer", SMTP_PASSWORD="pw",
                      SMTP_FROM="Bolt Markets <no-reply@boltmarkets.example>")
    monkeypatch.setattr(mailer_module.smtplib, "SMTP", FakeSMTP)
    FakeSMTP.instances, FakeSMTP.fail = [], False
    db = Database(s.database_url)
    db.migrate()
    m = mailer_module.Mailer(s, db)
    with db.tx() as c:
        m.enqueue(c, "sara@example.com", verify_email("ar", "Sara Ahmed", "https://x/verify"))
    assert m.flush() == 1
    smtp = FakeSMTP.instances[0]
    assert smtp.host == "smtp.example.com" and smtp.calls[:2] == ["starttls", "login:mailer"]
    msg = smtp.calls[2]
    assert msg["To"] == "sara@example.com" and "no-reply@boltmarkets.example" in msg["From"] and msg.is_multipart()
    assert 'dir="rtl"' in msg.get_body(("html",)).get_content()
    with db.tx() as c:
        assert c.val("SELECT status FROM email_outbox") == "sent"
        m.enqueue(c, "x@example.com", verify_email("en", "X Y", "https://x"))
    FakeSMTP.fail = True
    for _ in range(5):
        m.flush()
        with db.tx() as c:
            c.exec("UPDATE email_outbox SET next_attempt_at = NULL")
    with db.tx() as c:
        row = c.one("SELECT status, attempts, last_error FROM email_outbox WHERE to_email = 'x@example.com'")
    assert row == {"status": "failed", "attempts": 5, "last_error": "gone"}
    db.close()


# --- live prices over a real server ----------------------------------------------------------------------------

def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def test_sse_stream_over_uvicorn(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    import uvicorn

    s = settings_with(monkeypatch, tmp_path)
    app = create_app(s)
    port = _free_port()
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", lifespan="on"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    for _ in range(100):
        if server.started:
            break
        time.sleep(0.05)
    base = f"http://127.0.0.1:{port}/api/v1"

    def ingest(price: float) -> None:
        body = json.dumps({"quotes": [{"s": "EURUSD", "b": price, "a": price + 0.0001}]}).encode()
        req = urllib.request.Request(f"{base}/quotes/ingest", data=body, method="POST", headers={"Content-Type": "application/json", "X-Bridge-Key": "bridge-key-123"})
        assert json.load(urllib.request.urlopen(req, timeout=5)) == {"accepted": 1}

    try:
        ingest(1.0850)
        stream = urllib.request.urlopen(f"{base}/quotes/stream", timeout=10)
        assert stream.headers["content-type"].startswith("text/event-stream")
        frames: list[list[dict[str, Any]]] = []
        threading.Timer(0.5, ingest, args=(1.0860,)).start()
        deadline = time.time() + 8
        while len(frames) < 2 and time.time() < deadline:
            line = stream.readline().decode().strip()
            if line.startswith("data: "):
                frames.append(json.loads(line[6:]))
        stream.close()
        assert frames[0][0]["b"] == 1.085 and frames[1][0]["b"] == 1.086
    finally:
        server.should_exit = True
        thread.join(timeout=10)


# --- CLI and start-up -------------------------------------------------------------------------------------------

def run_cli(*argv: str) -> str:
    get_settings.cache_clear()
    out = io.StringIO()
    with redirect_stdout(out):
        cli.main(list(argv))
    return out.getvalue()


def test_cli_commands(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    settings_with(monkeypatch, tmp_path)
    assert "applied: 0001_initial" in run_cli("migrate")
    assert "up to date" in run_cli("migrate")
    assert "card payments (Stripe)" in run_cli("check")
    assert "created administrator boss@bolt.test" in run_cli("create-admin", "--email", "boss@bolt.test", "--password", "Boss-pass-2026")
    assert "updated boss@bolt.test" in run_cli("create-admin", "--email", "boss@bolt.test", "--password", "Boss-pass-2027")
    spec = json.loads(run_cli("openapi"))
    assert spec["openapi"] == "3.1.0" and len(spec["paths"]) > 60
    if (cli.DEFAULT_BLOG_DIR / "posts.json").exists():
        assert "imported 20 article(s)" in run_cli("seed-blog")
    assert "synced 0 account(s)" in run_cli("sync-accounts")
    assert "handled" in run_cli("send-emails")
    with pytest.raises(SystemExit):
        run_cli("create-admin", "--email", "weak@bolt.test", "--password", "short")


def test_bootstrap_admin(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    s = settings_with(monkeypatch, tmp_path, BOOTSTRAP_ADMIN_EMAIL="Owner@Bolt.test", BOOTSTRAP_ADMIN_PASSWORD="Owner-pass-2026")
    create_app(s)
    create_app(s)  # idempotent
    db = Database(s.database_url)
    with db.tx() as c:
        rows = c.all("SELECT email, role, email_verified_at FROM users")
    assert len(rows) == 1 and rows[0]["email"] == "owner@bolt.test" and rows[0]["role"] == "admin" and rows[0]["email_verified_at"]
    db.close()


def test_production_settings_are_checked(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    s = settings_with(monkeypatch, tmp_path, ENVIRONMENT="production", SECRET_KEY="short", DATA_KEY="", MT5_MODE="mock", QUOTES_MODE="simulated",
                      FRONTEND_URL="http://insecure.example")
    problems = s.validate()
    assert len(problems) == 6
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        create_app(s)
    assert s.registration_open is True  # explicitly set in BASE_ENV
    monkeypatch.delenv("REGISTRATION_OPEN")
    assert Settings().registration_open is False  # closed by default in production


def test_http_client_refuses_other_schemes() -> None:
    from app.services.http import HttpClient, IntegrationError

    with pytest.raises(IntegrationError):
        HttpClient().request("GET", "file:///etc/passwd")
    assert HttpResponse(204).ok


def test_api_with_manager_bridge_end_to_end(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """API -> BridgeGateway -> HTTP -> bridge/mt5_manager_bridge.py (--mock backend)."""
    import importlib.util

    from starlette.testclient import TestClient

    from app.services.container import Services

    spec = importlib.util.spec_from_file_location("bridge_mod", Path(__file__).resolve().parents[1] / "bridge" / "mt5_manager_bridge.py")
    assert spec and spec.loader
    bridge = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bridge)
    key = "k" * 32
    server = ThreadingHTTPServer(("127.0.0.1", 0), bridge.make_handler(bridge.MockBackend(), key))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        s = settings_with(monkeypatch, tmp_path, MT5_MODE="bridge", MT5_BRIDGE_URL=f"http://127.0.0.1:{server.server_address[1]}", MT5_BRIDGE_KEY=key)
        services = Services.create(s)  # real HTTP client
        with TestClient(create_app(s, services)) as client:
            client.post("/api/v1/auth/register", json={"full_name": "Sara Ahmed", "email": "s@example.com", "password": "Sunrise-2048x", "country": "AE", "accept_terms": True})
            with services.db.tx() as c:
                c.exec("UPDATE users SET email_verified_at = created_at")
            tokens = client.post("/api/v1/auth/login", json={"email": "s@example.com", "password": "Sunrise-2048x"}).json()
            headers = {"Authorization": f"Bearer {tokens['access_token']}"}
            opened = client.post("/api/v1/accounts", json={"kind": "demo", "account_type": "standard", "leverage": 100}, headers=headers).json()
            assert opened["account"]["status"] == "active" and opened["account"]["login"].startswith("900")
            assert opened["account"]["balance"] == 10000.0  # initial demo balance credited through the bridge
            acc_id = opened["account"]["id"]
            assert len(client.post(f"/api/v1/accounts/{acc_id}/reset-password", headers=headers).json()["password"]) == 12
        assert bridge.MockBackend is not None
        bad = urllib.request.Request(f"http://127.0.0.1:{server.server_address[1]}/accounts/1", headers={"X-Bridge-Key": "wrong"})
        with pytest.raises(urllib.error.HTTPError) as err:
            urllib.request.urlopen(bad, timeout=5)
        assert err.value.code == 401
    finally:
        server.shutdown()


def test_mail_sync_delivers_during_the_request(make_world: Any) -> None:
    """Serverless hosts (MAIL_SYNC): the email is processed before the response, no worker thread."""
    w = make_world({"MAIL_SYNC": "true"})
    assert w.services.mailer._thread is None
    w.register("omar@example.com", name="Omar Haddad")
    rows = w.outbox("omar@example.com")
    assert rows, "verification email queued"
    # SMTP is not configured in tests, so the synchronous delivery marks it as disabled right away
    assert {r["status"] for r in rows} == {"disabled"}
