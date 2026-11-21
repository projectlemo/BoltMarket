"""Shared services, created once per application instance."""
from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from typing import Any

from ..config import Settings
from ..db import Conn, Database, Json, utcnow
from ..security import Vault
from ..web import RateLimiter
from .http import HttpClient
from .mailer import Mailer
from .mt5 import Mt5Gateway, make_gateway
from .quotes import QuoteHub

log = logging.getLogger("bolt")


@dataclass
class Services:
    settings: Settings
    db: Database
    vault: Vault
    http: HttpClient
    mailer: Mailer
    mt5: Mt5Gateway
    quotes: QuoteHub
    limiter: RateLimiter

    @classmethod
    def create(cls, settings: Settings, *, db: Database | None = None, http: HttpClient | None = None) -> Services:
        database = db or Database(settings.database_url, pool_size=settings.db_pool_size)
        client = http or HttpClient()
        return cls(
            settings=settings,
            db=database,
            vault=Vault(settings.encryption_key),
            http=client,
            mailer=Mailer(settings, database),
            mt5=make_gateway(settings, client),
            quotes=QuoteHub(settings.quote_symbols, settings.quotes_mode),
            limiter=RateLimiter(),
        )

    # -- small shared helpers -------------------------------------------------------------
    def portal_link(self, path: str, lang: str = "en") -> str:
        prefix = "/ar" if lang == "ar" else ""
        path = path if path.startswith("/") else "/" + path
        base, _, query = path.partition("?")
        if not base.endswith("/"):
            base += "/"
        return f"{self.settings.frontend_url}{prefix}{base}" + (f"?{query}" if query else "")

    def admin_link(self, path: str) -> str:
        return f"{self.settings.admin_url}/#{path}"

    def notify_staff(self, c: Conn, email: Any) -> None:
        if self.settings.support_inbox:
            self.mailer.enqueue(c, self.settings.support_inbox, email)

    def trigger_site_rebuild(self, reason: str) -> None:
        """Asks GitHub Actions to rebuild the static site (so new blog posts are prerendered)."""
        s = self.settings
        if not (s.github_dispatch_token and s.github_repository):
            return

        def run() -> None:
            try:
                res = self.http.post_json(
                    f"https://api.github.com/repos/{s.github_repository}/dispatches",
                    {"event_type": "cms-publish", "client_payload": {"reason": reason[:100]}},
                    headers={"Authorization": f"Bearer {s.github_dispatch_token}", "Accept": "application/vnd.github+json"},
                )
                if res.status >= 300:
                    log.warning("site rebuild dispatch returned HTTP %s", res.status)
            except Exception as exc:  # pragma: no cover - network
                log.warning("site rebuild dispatch failed: %s", exc)

        threading.Thread(target=run, name="bolt-dispatch", daemon=True).start()


def audit(c: Conn, actor_id: int | None, action: str, target_type: str | None = None, target_id: Any = None,
          data: dict[str, Any] | None = None, ip: str | None = None) -> None:
    c.insert(
        "audit_log",
        {
            "actor_id": actor_id,
            "action": action,
            "target_type": target_type,
            "target_id": None if target_id is None else str(target_id),
            "data": Json(data or {}),
            "ip": ip,
            "created_at": utcnow(),
        },
    )
