"""Transactional email via an outbox table.

Emails are inserted in the same database transaction as the change that caused them, then a
background worker delivers them over SMTP. Without SMTP settings the messages are kept with
status ``disabled`` (and, outside production, written to the log so links can be used locally).
"""
from __future__ import annotations

import logging
import smtplib
import ssl
import threading
from datetime import timedelta
from email.message import EmailMessage
from email.utils import formataddr, parseaddr

from ..config import Settings
from ..db import Conn, Database, utcnow
from .emails import Email

log = logging.getLogger("bolt.mail")


class Mailer:
    def __init__(self, settings: Settings, db: Database) -> None:
        self.settings = settings
        self.db = db
        self._event = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.sent: list[EmailMessage] = []  # recorded for tests when sending is disabled

    # -- producer side --------------------------------------------------------------------
    def enqueue(self, c: Conn, to: str, email: Email) -> None:
        c.insert(
            "email_outbox",
            {"to_email": to, "subject": email.subject, "body_text": email.text, "body_html": email.html, "status": "pending", "attempts": 0, "created_at": utcnow()},
        )

    def kick(self) -> None:
        self._event.set()

    # -- worker ---------------------------------------------------------------------------
    def start(self) -> None:
        if self._thread is None:
            self._thread = threading.Thread(target=self._run, name="bolt-mailer", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._event.set()
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None

    def _run(self) -> None:
        while not self._stop.is_set():
            self._event.wait(timeout=30)
            self._event.clear()
            if self._stop.is_set():
                break
            try:
                self.flush()
            except Exception:  # pragma: no cover - keep the worker alive
                log.exception("outbox flush failed")

    def flush(self, limit: int = 25) -> int:
        """Deliver pending emails. Returns how many were handled."""
        now = utcnow()
        with self.db.tx() as c:
            c.exec(
                "UPDATE email_outbox SET status = 'pending' WHERE status = 'sending' AND created_at < :stale",
                stale=now - timedelta(minutes=15),
            )
            rows = c.all(
                "UPDATE email_outbox SET status = 'sending', attempts = attempts + 1 "
                "WHERE status = 'pending' AND id IN (SELECT id FROM email_outbox WHERE status = 'pending' AND attempts < 5 "
                "AND (next_attempt_at IS NULL OR next_attempt_at <= :now) ORDER BY id LIMIT :n) "
                "RETURNING *",
                n=limit, now=now,
            )
        for row in rows:
            status, error = self._deliver(row)
            if status == "retry":
                status = "pending" if row["attempts"] < 5 else "failed"
            with self.db.tx() as c:
                c.update(
                    "email_outbox",
                    row["id"],
                    {
                        "status": status,
                        "last_error": error,
                        "sent_at": utcnow() if status == "sent" else None,
                        # back off: 1, 4, 9, 16 minutes between attempts
                        "next_attempt_at": utcnow() + timedelta(minutes=row["attempts"] ** 2) if status == "pending" else None,
                    },
                )
        return len(rows)

    def _message(self, row: dict) -> EmailMessage:
        msg = EmailMessage()
        name, addr = parseaddr(self.settings.smtp_from)
        msg["From"] = formataddr((name or self.settings.brand, addr))
        msg["To"] = row["to_email"]
        msg["Subject"] = row["subject"]
        msg.set_content(row["body_text"])
        if row.get("body_html"):
            msg.add_alternative(row["body_html"], subtype="html")
        return msg

    def _deliver(self, row: dict) -> tuple[str, str | None]:
        msg = self._message(row)
        if not self.settings.smtp_enabled:
            self.sent.append(msg)
            if self.settings.is_production:
                log.warning("SMTP is not configured; email '%s' to %s was not sent", row["subject"], row["to_email"])
            else:
                log.info("email (SMTP disabled) to %s: %s\n%s", row["to_email"], row["subject"], row["body_text"])
            return "disabled", "SMTP is not configured"
        try:
            context = ssl.create_default_context()
            server: smtplib.SMTP
            if self.settings.smtp_security == "ssl":
                server = smtplib.SMTP_SSL(self.settings.smtp_host, self.settings.smtp_port, timeout=20, context=context)
            else:
                server = smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port, timeout=20)
                if self.settings.smtp_security == "starttls":
                    server.starttls(context=context)
            with server:
                if self.settings.smtp_user:
                    server.login(self.settings.smtp_user, self.settings.smtp_password)
                server.send_message(msg)
            return "sent", None
        except (smtplib.SMTPException, OSError) as exc:
            log.warning("email to %s failed: %s", row["to_email"], exc)
            return "retry", str(exc)[:500]
