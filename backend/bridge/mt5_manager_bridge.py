"""MT5 Manager API bridge (reference implementation).

Run this on a Windows machine that can reach your MT5 trade server, then set on the API:
    MT5_MODE=bridge  MT5_BRIDGE_URL=https://<this machine>  MT5_BRIDGE_KEY=<same key>

It exposes the small JSON contract used by ``app/services/mt5.py::BridgeGateway`` and talks to
MetaTrader 5 through MetaQuotes' official ``MT5Manager`` Python package (Windows only):
    pip install MT5Manager

    POST /accounts                    {kind, group, name, email, country, phone, leverage, password, investor_password} -> {login}
    GET  /accounts/<login>            -> {balance, equity, margin_free}
    POST /accounts/<login>/balance    {amount, comment} -> {ticket}
    POST /accounts/<login>/password   {password} -> {}
    POST /accounts/<login>/enabled    {enabled} -> {}
    GET  /health                      -> {ok, connected}

Every request must carry ``X-Bridge-Key``. Put the bridge behind HTTPS (``--cert``/``--key`` or a
reverse proxy) and allow only your API's outbound IPs in the firewall.

IMPORTANT: written against the MT5Manager package documentation; method names can differ between
Manager API builds. Test every call against a demo group before pointing it at live groups.
``--mock`` serves the same contract from memory so you can try the integration without MT5.

Environment: BRIDGE_KEY, MT5_SERVER (host:port), MT5_MANAGER_LOGIN, MT5_MANAGER_PASSWORD.
"""
from __future__ import annotations

import argparse
import hmac
import json
import logging
import os
import re
import ssl
import threading
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

log = logging.getLogger("mt5-bridge")


class BridgeError(Exception):
    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


class MockBackend:
    """In-memory stand-in with the same behaviour, for trying the integration."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.next_login = 9_000_000
        self.accounts: dict[str, dict[str, Any]] = {}
        self.ticket = 0

    @property
    def connected(self) -> bool:
        return True

    def create(self, data: dict[str, Any]) -> str:
        with self.lock:
            self.next_login += 1
            login = str(self.next_login)
            self.accounts[login] = {"balance": Decimal("0"), "enabled": True, **data}
            return login

    def info(self, login: str) -> dict[str, str]:
        acc = self._get(login)
        return {"balance": str(acc["balance"]), "equity": str(acc["balance"]), "margin_free": str(acc["balance"])}

    def balance(self, login: str, amount: Decimal, comment: str) -> str:
        with self.lock:
            acc = self._get(login)
            if acc["balance"] + amount < 0:
                raise BridgeError("not enough money", 409)
            acc["balance"] += amount
            self.ticket += 1
            return str(self.ticket)

    def password(self, login: str, password: str) -> None:
        self._get(login)["password"] = password

    def enabled(self, login: str, enabled: bool) -> None:
        self._get(login)["enabled"] = enabled

    def _get(self, login: str) -> dict[str, Any]:
        if login not in self.accounts:
            raise BridgeError("account not found", 404)
        return self.accounts[login]


class ManagerBackend:
    """MetaQuotes MT5Manager package (Windows)."""

    def __init__(self, server: str, login: int, password: str) -> None:
        import MT5Manager  # type: ignore[import-not-found]

        self.mt5 = MT5Manager
        self.server, self.login, self.password = server, login, password
        self.lock = threading.Lock()
        self.manager = MT5Manager.ManagerAPI()
        self._connect()

    def _connect(self) -> None:
        pump = self.mt5.ManagerAPI.EnPumpModes.PUMP_MODE_USERS
        if not self.manager.Connect(self.server, self.login, self.password, pump, 120000):
            raise BridgeError(f"cannot connect to MT5: {self.mt5.LastError()}", 502)

    @property
    def connected(self) -> bool:
        try:
            return bool(self.manager.IsConnected())
        except Exception:
            return False

    def _ensure(self) -> None:
        if not self.connected:
            self._connect()

    def create(self, data: dict[str, Any]) -> str:
        with self.lock:
            self._ensure()
            user = self.mt5.MTUser(self.manager)
            user.Group = data["group"]
            user.Leverage = int(data["leverage"])
            first, _, last = str(data["name"]).partition(" ")
            user.FirstName, user.LastName = first, last or first
            user.EMail = data.get("email") or ""
            user.Country = data.get("country") or ""
            user.Phone = data.get("phone") or ""
            user.Rights = self.mt5.MTUser.EnUsersRights.USER_RIGHT_DEFAULT
            if not self.manager.UserAdd(user, data["password"], data["investor_password"]):
                raise BridgeError(f"UserAdd failed: {self.mt5.LastError()}", 502)
            return str(user.Login)

    def info(self, login: str) -> dict[str, str]:
        with self.lock:
            self._ensure()
            account = self.manager.UserAccountGet(int(login))
            if not account:
                raise BridgeError(f"UserAccountGet failed: {self.mt5.LastError()}", 404)
            return {"balance": str(account.Balance), "equity": str(account.Equity), "margin_free": str(account.MarginFree)}

    def balance(self, login: str, amount: Decimal, comment: str) -> str:
        with self.lock:
            self._ensure()
            deal = self.manager.DealerBalance(int(login), float(amount), self.mt5.MTDeal.EnDealAction.DEAL_BALANCE, comment[:31])
            if not deal:
                error = str(self.mt5.LastError())
                raise BridgeError(f"DealerBalance failed: {error}", 409 if "MONEY" in error.upper() else 502)
            return str(deal)

    def password(self, login: str, password: str) -> None:
        with self.lock:
            self._ensure()
            kind = self.mt5.MTUser.EnUsersPasswords.USER_PASS_MAIN
            if not self.manager.UserPasswordChange(kind, int(login), password):
                raise BridgeError(f"UserPasswordChange failed: {self.mt5.LastError()}", 502)

    def enabled(self, login: str, enabled: bool) -> None:
        with self.lock:
            self._ensure()
            user = self.manager.UserGet(int(login))
            if not user:
                raise BridgeError(f"UserGet failed: {self.mt5.LastError()}", 404)
            flag = self.mt5.MTUser.EnUsersRights.USER_RIGHT_ENABLED
            user.Rights = (user.Rights | flag) if enabled else (user.Rights & ~flag)
            if not self.manager.UserUpdate(user):
                raise BridgeError(f"UserUpdate failed: {self.mt5.LastError()}", 502)


ROUTE = re.compile(r"^/accounts/(\d{1,20})(?:/(balance|password|enabled))?$")


def make_handler(backend: Any, key: str) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt: str, *args: Any) -> None:
            log.info("%s %s", self.address_string(), fmt % args)

        def send_json(self, status: int, data: dict[str, Any]) -> None:
            body = json.dumps(data).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def body(self) -> dict[str, Any]:
            length = int(self.headers.get("Content-Length") or 0)
            if length > 64 * 1024:
                raise BridgeError("request too large", 413)
            raw = self.rfile.read(length) if length else b"{}"
            try:
                data = json.loads(raw or b"{}")
            except ValueError as exc:
                raise BridgeError("invalid JSON") from exc
            if not isinstance(data, dict):
                raise BridgeError("expected a JSON object")
            return data

        def authorized(self) -> bool:
            return hmac.compare_digest(self.headers.get("X-Bridge-Key", ""), key)

        def handle_any(self, method: str) -> None:
            try:
                if self.path == "/health":
                    return self.send_json(200, {"ok": True, "connected": backend.connected})
                if not self.authorized():
                    return self.send_json(401, {"error": "invalid bridge key"})
                if method == "POST" and self.path == "/accounts":
                    data = self.body()
                    missing = [k for k in ("group", "name", "leverage", "password", "investor_password") if not data.get(k)]
                    if missing:
                        raise BridgeError(f"missing fields: {', '.join(missing)}")
                    return self.send_json(201, {"login": backend.create(data)})
                m = ROUTE.match(self.path)
                if not m:
                    return self.send_json(404, {"error": "not found"})
                login, action = m.group(1), m.group(2)
                if method == "GET" and action is None:
                    return self.send_json(200, backend.info(login))
                if method == "POST" and action == "balance":
                    data = self.body()
                    amount = Decimal(str(data.get("amount", "0")))
                    if amount == 0 or abs(amount) > Decimal("100000000"):
                        raise BridgeError("invalid amount")
                    return self.send_json(200, {"ticket": backend.balance(login, amount, str(data.get("comment", "")))})
                if method == "POST" and action == "password":
                    backend.password(login, str(self.body().get("password", "")))
                    return self.send_json(200, {})
                if method == "POST" and action == "enabled":
                    backend.enabled(login, bool(self.body().get("enabled")))
                    return self.send_json(200, {})
                return self.send_json(405, {"error": "method not allowed"})
            except BridgeError as exc:
                return self.send_json(exc.status, {"error": str(exc)})
            except Exception as exc:  # pragma: no cover - surface MT5 errors to the API
                log.exception("bridge failure")
                return self.send_json(500, {"error": str(exc)})

        def do_GET(self) -> None:
            self.handle_any("GET")

        def do_POST(self) -> None:
            self.handle_any("POST")

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description="Bolt Markets MT5 Manager bridge")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--cert", help="TLS certificate (PEM) to serve HTTPS directly")
    parser.add_argument("--key", help="TLS private key (PEM)")
    parser.add_argument("--mock", action="store_true", help="serve from memory instead of MT5 (for testing)")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    bridge_key = os.environ.get("BRIDGE_KEY", "")
    if len(bridge_key) < 24:
        raise SystemExit("Set BRIDGE_KEY to a random value of at least 24 characters (the same value as MT5_BRIDGE_KEY on the API).")
    if args.mock:
        backend: Any = MockBackend()
    else:
        backend = ManagerBackend(os.environ["MT5_SERVER"], int(os.environ["MT5_MANAGER_LOGIN"]), os.environ["MT5_MANAGER_PASSWORD"])
    server = ThreadingHTTPServer((args.host, args.port), make_handler(backend, bridge_key))
    if args.cert and args.key:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(args.cert, args.key)
        server.socket = context.wrap_socket(server.socket, server_side=True)
    log.info("MT5 bridge listening on %s:%s (%s)", args.host, args.port, "mock" if args.mock else "MT5 Manager API")
    server.serve_forever()


if __name__ == "__main__":
    main()
