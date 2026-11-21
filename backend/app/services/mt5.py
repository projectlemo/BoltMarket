"""MetaTrader 5 back-office gateways.

* ``disabled`` – no MT5 connection. Accounts wait as "pending" and staff provision them by
  hand in the MT5 Administrator/Manager, then record the login in the back office.
* ``mock``     – in-memory simulation for development and automated tests (blocked in production).
* ``webapi``   – the MT5 server's Web API (manager login with the Web API right).
* ``bridge``   – a small HTTPS service you run next to the MT5 Manager API on Windows
  (reference implementation in ``backend/bridge/mt5_manager_bridge.py``).
"""
from __future__ import annotations

import hashlib
import http.client
import json
import logging
import os
import ssl
import threading
from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from urllib.parse import quote, urlencode, urlsplit

from ..config import Settings
from .http import HttpClient, IntegrationError

log = logging.getLogger("bolt.mt5")


class Mt5Error(Exception):
    pass


class Mt5Unavailable(Mt5Error):
    pass


@dataclass
class NewAccount:
    login: str
    server: str | None


@dataclass
class AccountInfo:
    balance: Decimal
    equity: Decimal
    margin_free: Decimal


class Mt5Gateway:
    name = "disabled"
    enabled = False

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def server_for(self, kind: str) -> str | None:
        return (self.settings.mt5_server_live if kind == "live" else self.settings.mt5_server_demo) or None

    def create_account(self, *, kind: str, group: str, name: str, email: str, country: str, phone: str | None,
                       leverage: int, password: str, investor_password: str) -> NewAccount:
        raise Mt5Unavailable("MT5 integration is switched off")

    def account_info(self, login: str) -> AccountInfo:
        raise Mt5Unavailable("MT5 integration is switched off")

    def balance(self, login: str, amount: Decimal, comment: str) -> str:
        raise Mt5Unavailable("MT5 integration is switched off")

    def set_password(self, login: str, password: str) -> None:
        raise Mt5Unavailable("MT5 integration is switched off")

    def set_enabled(self, login: str, enabled: bool) -> None:
        raise Mt5Unavailable("MT5 integration is switched off")


class MockGateway(Mt5Gateway):
    """Deterministic in-memory MT5 used by tests and local development."""

    name = "mock"
    enabled = True

    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)
        self._lock = threading.Lock()
        self._next = {"live": 7_100_000, "demo": 5_100_000}
        self.accounts: dict[str, dict[str, Any]] = {}
        self.deals: list[tuple[str, Decimal, str]] = []
        self.fail_next: str | None = None

    def _maybe_fail(self) -> None:
        if self.fail_next:
            message, self.fail_next = self.fail_next, None
            raise Mt5Error(message)

    def create_account(self, *, kind: str, group: str, name: str, email: str, country: str, phone: str | None,
                       leverage: int, password: str, investor_password: str) -> NewAccount:
        self._maybe_fail()
        with self._lock:
            self._next[kind] += 1
            login = str(self._next[kind])
            self.accounts[login] = {"kind": kind, "group": group, "name": name, "leverage": leverage, "balance": Decimal("0"),
                                    "password": password, "investor": investor_password, "enabled": True}
        return NewAccount(login, self.server_for(kind) or ("BoltMarkets-Demo" if kind == "demo" else "BoltMarkets-Live"))

    def _get(self, login: str) -> dict[str, Any]:
        if login not in self.accounts:
            raise Mt5Error(f"account {login} not found")
        return self.accounts[login]

    def account_info(self, login: str) -> AccountInfo:
        self._maybe_fail()
        acc = self._get(login)
        bal = acc["balance"]
        return AccountInfo(bal, bal, bal)

    def balance(self, login: str, amount: Decimal, comment: str) -> str:
        self._maybe_fail()
        with self._lock:
            acc = self._get(login)
            if amount < 0 and acc["balance"] + amount < 0:
                raise Mt5Error("not enough money")
            acc["balance"] += amount
            self.deals.append((login, amount, comment))
            return str(900_000 + len(self.deals))

    def set_password(self, login: str, password: str) -> None:
        self._maybe_fail()
        self._get(login)["password"] = password

    def set_enabled(self, login: str, enabled: bool) -> None:
        self._maybe_fail()
        self._get(login)["enabled"] = enabled


class WebApiGateway(Mt5Gateway):
    """MT5 Web API client (challenge–response authentication over a kept-alive HTTPS connection)."""

    name = "webapi"
    enabled = True
    USER_RIGHT_ENABLED = 0x0001
    DEAL_BALANCE = 2

    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)
        parts = urlsplit(settings.mt5_webapi_url)
        self._host = parts.hostname or ""
        self._port = parts.port or 443
        self._conn: http.client.HTTPSConnection | None = None
        self._lock = threading.Lock()

    @staticmethod
    def password_hash(password: str) -> bytes:
        return hashlib.md5(hashlib.md5(password.encode("utf-16-le")).digest() + b"WebAPI").digest()  # noqa: S324 - MT5 protocol

    def _request(self, conn: http.client.HTTPSConnection, path: str, params: dict[str, Any], body: Any = None) -> dict[str, Any]:
        query = urlencode({k: v for k, v in params.items() if v is not None}, quote_via=quote)
        if body is None:
            conn.request("GET", f"{path}?{query}", headers={"Connection": "keep-alive"})
        else:
            conn.request("POST", f"{path}?{query}", body=json.dumps(body).encode(), headers={"Connection": "keep-alive", "Content-Type": "application/json"})
        res = conn.getresponse()
        raw = res.read()
        try:
            data = json.loads(raw.decode("utf-8", "replace") or "{}")
        except ValueError as exc:
            raise Mt5Error(f"unexpected response from MT5 Web API (HTTP {res.status})") from exc
        retcode = str(data.get("retcode", ""))
        if not retcode.startswith("0 "):
            raise Mt5Error(f"MT5 Web API {path}: {retcode or 'HTTP ' + str(res.status)}")
        return data

    def _connect(self) -> http.client.HTTPSConnection:
        context = ssl.create_default_context()
        if not self.settings.mt5_webapi_verify_tls:
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
        conn = http.client.HTTPSConnection(self._host, self._port, timeout=20, context=context)
        start = self._request(conn, "/api/auth/start", {"version": 484, "agent": "BoltMarkets", "login": self.settings.mt5_manager_login, "type": "manager"})
        secret = self.password_hash(self.settings.mt5_manager_password)
        srv_rand = bytes.fromhex(str(start.get("srv_rand", "")))
        cli_rand = os.urandom(16)
        answer = self._request(
            conn, "/api/auth/answer", {"srv_rand_answer": hashlib.md5(secret + srv_rand).hexdigest(), "cli_rand": cli_rand.hex()}  # noqa: S324
        )
        if str(answer.get("cli_rand_answer", "")).lower() != hashlib.md5(secret + cli_rand).hexdigest():  # noqa: S324
            conn.close()
            raise Mt5Error("MT5 server failed the authentication check")
        return conn

    def _call(self, path: str, params: dict[str, Any], body: Any = None) -> dict[str, Any]:
        with self._lock:
            for attempt in range(2):
                try:
                    if self._conn is None:
                        self._conn = self._connect()
                    return self._request(self._conn, path, params, body)
                except (OSError, http.client.HTTPException) as exc:
                    if self._conn is not None:
                        self._conn.close()
                    self._conn = None
                    if attempt == 1:
                        raise Mt5Error(f"MT5 Web API unreachable: {exc}") from exc
            raise Mt5Error("MT5 Web API unreachable")

    def create_account(self, *, kind: str, group: str, name: str, email: str, country: str, phone: str | None,
                       leverage: int, password: str, investor_password: str) -> NewAccount:
        data = self._call(
            "/api/user/add",
            {"login": 0, "pass_main": password, "pass_investor": investor_password, "group": group, "name": name,
             "leverage": leverage, "email": email, "country": country, "phone": phone or None},
        )
        login = str((data.get("answer") or {}).get("Login", ""))
        if not login or login == "0":
            raise Mt5Error("MT5 did not return a login")
        return NewAccount(login, self.server_for(kind))

    def account_info(self, login: str) -> AccountInfo:
        answer = self._call("/api/user/account/get", {"login": login}).get("answer") or {}
        return AccountInfo(Decimal(str(answer.get("Balance", "0"))), Decimal(str(answer.get("Equity", "0"))), Decimal(str(answer.get("MarginFree", "0"))))

    def balance(self, login: str, amount: Decimal, comment: str) -> str:
        params = {"login": login, "type": self.DEAL_BALANCE, "balance": f"{amount:.2f}", "comment": comment[:31]}
        if amount < 0:
            params["check_margin"] = 1
        answer = self._call("/api/trade/balance", params).get("answer") or {}
        return str(answer.get("ticket", ""))

    def set_password(self, login: str, password: str) -> None:
        self._call("/api/user/change_password", {"login": login, "type": "main", "password": password})

    def set_enabled(self, login: str, enabled: bool) -> None:
        user = self._call("/api/user/get", {"login": login}).get("answer") or {}
        rights = int(str(user.get("Rights", "0")) or 0)
        rights = rights | self.USER_RIGHT_ENABLED if enabled else rights & ~self.USER_RIGHT_ENABLED
        self._call("/api/user/update", {"login": login, "rights": rights})


class BridgeGateway(Mt5Gateway):
    """JSON contract with a Manager API bridge (see backend/bridge/README.md)."""

    name = "bridge"
    enabled = True

    def __init__(self, settings: Settings, http: HttpClient) -> None:
        super().__init__(settings)
        self.http = http

    def _send(self, method: str, path: str, payload: Any = None) -> dict[str, Any]:
        headers = {"X-Bridge-Key": self.settings.mt5_bridge_key, "Accept": "application/json"}
        body = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(payload).encode()
        try:
            res = self.http.request(method, self.settings.mt5_bridge_url + path, headers=headers, body=body)
        except IntegrationError as exc:
            raise Mt5Error(str(exc)) from exc
        data = res.json() if res.body else {}
        if not res.ok:
            raise Mt5Error(str((data or {}).get("error") or f"bridge returned HTTP {res.status}"))
        return data or {}

    def create_account(self, *, kind: str, group: str, name: str, email: str, country: str, phone: str | None,
                       leverage: int, password: str, investor_password: str) -> NewAccount:
        data = self._send("POST", "/accounts", {"kind": kind, "group": group, "name": name, "email": email, "country": country,
                                                "phone": phone, "leverage": leverage, "password": password, "investor_password": investor_password})
        login = str(data.get("login", ""))
        if not login:
            raise Mt5Error("bridge did not return a login")
        return NewAccount(login, self.server_for(kind))

    def account_info(self, login: str) -> AccountInfo:
        data = self._send("GET", f"/accounts/{quote(login)}")
        return AccountInfo(Decimal(str(data.get("balance", 0))), Decimal(str(data.get("equity", 0))), Decimal(str(data.get("margin_free", 0))))

    def balance(self, login: str, amount: Decimal, comment: str) -> str:
        data = self._send("POST", f"/accounts/{quote(login)}/balance", {"amount": f"{amount:.2f}", "comment": comment[:31]})
        return str(data.get("ticket", ""))

    def set_password(self, login: str, password: str) -> None:
        self._send("POST", f"/accounts/{quote(login)}/password", {"password": password})

    def set_enabled(self, login: str, enabled: bool) -> None:
        self._send("POST", f"/accounts/{quote(login)}/enabled", {"enabled": enabled})


def make_gateway(settings: Settings, http: HttpClient) -> Mt5Gateway:
    if not settings.mt5_enabled:
        if settings.mt5_mode != "disabled":
            log.warning("MT5_MODE=%s is missing its connection settings; MT5 integration stays off", settings.mt5_mode)
        return Mt5Gateway(settings)
    if settings.mt5_mode == "mock":
        return MockGateway(settings)
    if settings.mt5_mode == "webapi":
        return WebApiGateway(settings)
    return BridgeGateway(settings, http)
