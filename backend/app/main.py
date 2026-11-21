"""ASGI application factory: ``uvicorn app.main:app``."""
from __future__ import annotations

import asyncio
import contextlib
import logging
import os
from collections.abc import AsyncIterator
from typing import Any

from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Route
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from . import __version__
from .api import accounts, admin, auth, funded, kyc, me, money, public, support, webhooks
from .config import Settings, get_settings
from .db import utcnow
from .schemas import clean_email, strong_password
from .security import hash_password, new_referral_code
from .services.container import Services, audit
from .web import Api, ApiError, build_openapi, build_routes, docs_page, json_response, pick_lang

log = logging.getLogger("bolt")

APIS: list[Api] = [public.api, auth.api, me.api, accounts.api, money.api, kyc.api, support.api, funded.api, webhooks.api, admin.api]


class SecurityHeaders:
    """Adds conservative security headers to every HTTP response."""

    def __init__(self, app: ASGIApp, hsts: bool) -> None:
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {k.lower() for k, _ in headers}
                extra = [
                    (b"x-content-type-options", b"nosniff"),
                    (b"referrer-policy", b"no-referrer"),
                    (b"x-frame-options", b"DENY"),
                    (b"cross-origin-resource-policy", b"cross-origin"),
                ]
                if self.hsts:
                    extra.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
                headers += [(k, v) for k, v in extra if k not in present]
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)


async def sync_loop(services: Services, minutes: int) -> None:
    """Keeps balances fresh and checks Bolt Funded limits (ACCOUNT_SYNC_MINUTES, 0 turns it off)."""
    from .services.domain import sync_account

    def run_once() -> int:
        with services.db.tx() as c:
            ids = [r["id"] for r in c.all("SELECT id FROM trading_accounts WHERE status = 'active' AND login IS NOT NULL ORDER BY id")]
        for account_id in ids:
            sync_account(services, account_id)
        return len(ids)

    while True:
        await asyncio.sleep(minutes * 60)
        try:
            await run_in_threadpool(run_once)
        except Exception:  # pragma: no cover - keep the loop alive
            log.exception("scheduled account sync failed")


def bootstrap_admin(services: Services) -> None:
    """Creates the first administrator from BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD (once)."""
    s = services.settings
    if not (s.bootstrap_admin_email and s.bootstrap_admin_password):
        return
    try:
        email = clean_email(s.bootstrap_admin_email)
        strong_password(s.bootstrap_admin_password)
    except ValueError:
        log.error("BOOTSTRAP_ADMIN_EMAIL/PASSWORD are invalid (password needs 10+ characters with a letter and a number); no admin created")
        return
    with services.db.tx() as c:
        if c.one("SELECT id FROM users WHERE email = :e", e=email):
            return
        code = new_referral_code()
        while c.one("SELECT id FROM users WHERE referral_code = :r", r=code):
            code = new_referral_code()
        now = utcnow()
        user = c.insert("users", {
            "email": email, "password_hash": hash_password(s.bootstrap_admin_password, n=s.scrypt_n), "full_name": s.bootstrap_admin_name,
            "country": "--", "language": "en", "role": "admin", "status": "active", "email_verified_at": now, "token_version": 0,
            "totp_enabled": False, "kyc_status": "none", "referral_code": code, "terms_accepted_at": now, "failed_logins": 0,
            "created_at": now, "updated_at": now,
        })
        audit(c, None, "staff.bootstrap_admin", "user", user["id"])
    log.info("created bootstrap administrator %s", email)


def create_app(settings: Settings | None = None, services: Services | None = None) -> Starlette:
    settings = settings or (services.settings if services else get_settings())
    problems = settings.validate()
    if problems:
        raise RuntimeError("Configuration problems:\n- " + "\n- ".join(problems))
    services = services or Services.create(settings)

    if os.environ.get("AUTO_MIGRATE", "true").lower() in ("1", "true", "yes", "on"):
        applied = services.db.migrate()
        if applied:
            log.info("database migrated: %s", ", ".join(applied))
    bootstrap_admin(services)

    @contextlib.asynccontextmanager
    async def lifespan(app: Starlette) -> AsyncIterator[None]:
        services.quotes.bind_loop(asyncio.get_running_loop())
        services.mailer.start()
        services.mailer.kick()
        tasks: list[asyncio.Task[Any]] = []
        if settings.quotes_mode == "simulated":
            tasks.append(asyncio.create_task(services.quotes.run_simulation()))
        if services.mt5.enabled and settings.account_sync_minutes > 0:
            tasks.append(asyncio.create_task(sync_loop(services, settings.account_sync_minutes)))
        elif settings.quotes_mode == "terminal":
            services.quotes.start_terminal_thread(settings)
        try:
            yield
        finally:
            for task in tasks:
                task.cancel()
            services.quotes.stop()
            services.mailer.stop()

    openapi_doc: dict[str, Any] | None = None

    def openapi_json(request: Request) -> Response:
        nonlocal openapi_doc
        if openapi_doc is None:
            openapi_doc = build_openapi(APIS, title="Bolt Markets API", version=__version__, server_url=settings.public_api_url)
        return json_response(openapi_doc)

    def root(request: Request) -> Response:
        return json_response({"name": "Bolt Markets API", "version": __version__, "docs": "/docs" if settings.api_docs else None, "health": "/api/v1/health"})

    routes: list[Route] = [Route("/", root, methods=["GET"])]
    if settings.api_docs:
        routes += [Route("/openapi.json", openapi_json, methods=["GET"]), Route("/docs", docs_page, methods=["GET"])]
    routes += build_routes(APIS, services)

    async def http_error(request: Request, exc: Exception) -> Response:
        assert isinstance(exc, HTTPException)
        lang = pick_lang(request)
        if exc.status_code == 404:
            err = ApiError(404, "NOT_FOUND", "Not found.", "غير موجود.")
        elif exc.status_code == 405:
            err = ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", "الطريقة غير مسموح بها.")
        elif exc.status_code == 413:
            err = ApiError(413, "PAYLOAD_TOO_LARGE", "The request is too large.", "حجم الطلب كبير جدًا.")
        else:
            err = ApiError(exc.status_code, "HTTP_ERROR", str(exc.detail), str(exc.detail))
        return json_response(err.render(lang), err.status, dict(exc.headers or {}))

    app = Starlette(
        routes=routes,
        lifespan=lifespan,
        exception_handlers={HTTPException: http_error},
        max_body_size=12 * 1024 * 1024,
        middleware=[
            Middleware(SecurityHeaders, hsts=settings.is_production),
            Middleware(
                CORSMiddleware,
                allow_origins=settings.cors_origins,
                allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
                allow_headers=["Authorization", "Content-Type", "Accept", "Accept-Language"],
                expose_headers=["Content-Disposition", "Retry-After"],
                max_age=600,
            ),
        ],
    )
    app.state.services = services
    return app


def _default_app() -> Starlette:
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO").upper(), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    return create_app()


def __getattr__(name: str) -> Any:
    # ``app`` is created lazily so importing this module (tests, CLI) has no side effects.
    if name == "app":
        globals()["app"] = _default_app()
        return globals()["app"]
    raise AttributeError(name)
