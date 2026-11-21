"""Operations commands: ``python -m app.cli <command>``.

  migrate          apply database migrations
  create-admin     create an administrator (prompts for the password)
  seed-blog        import the 10 starter articles (EN + AR) into the CMS
  sync-accounts    refresh MT5 balances and Bolt Funded limit checks (run on a schedule)
  send-emails      deliver queued emails now
  openapi          print the OpenAPI document
  check            show which integrations are configured (no secrets)
"""
from __future__ import annotations

import argparse
import getpass
import json
import logging
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from .config import get_settings
from .db import utcnow
from .schemas import clean_email, strong_password
from .security import hash_password, new_referral_code
from .services.container import Services, audit
from .services.domain import sync_account

DEFAULT_BLOG_DIR = Path(__file__).resolve().parents[2] / "frontend" / "src" / "content" / "blog"


def _services() -> Services:
    settings = get_settings()
    problems = settings.validate()
    if problems:
        sys.exit("Configuration problems:\n- " + "\n- ".join(problems))
    return Services.create(settings)


def cmd_migrate(_: argparse.Namespace) -> None:
    applied = _services().db.migrate()
    print("applied: " + (", ".join(applied) if applied else "nothing (up to date)"))


def cmd_create_admin(args: argparse.Namespace) -> None:
    services = _services()
    services.db.migrate()
    email = clean_email(args.email)
    password = args.password or getpass.getpass("Password (10+ characters, a letter and a number): ")
    strong_password(password)
    now = utcnow()
    with services.db.tx() as c:
        existing = c.one("SELECT id FROM users WHERE email = :e", e=email)
        if existing:
            c.update("users", existing["id"], {"role": "admin", "password_hash": hash_password(password, n=services.settings.scrypt_n),
                                                "email_verified_at": now, "status": "active", "updated_at": now})
            audit(c, None, "staff.promoted_by_cli", "user", existing["id"])
            print(f"updated {email}: role admin, new password set")
            return
        code = new_referral_code()
        while c.one("SELECT id FROM users WHERE referral_code = :r", r=code):
            code = new_referral_code()
        user = c.insert("users", {
            "email": email, "password_hash": hash_password(password, n=services.settings.scrypt_n), "full_name": args.name, "country": "--",
            "language": "en", "role": "admin", "status": "active", "email_verified_at": now, "token_version": 0, "totp_enabled": False,
            "kyc_status": "none", "referral_code": code, "terms_accepted_at": now, "failed_logins": 0, "created_at": now, "updated_at": now,
        })
        audit(c, None, "staff.created_by_cli", "user", user["id"])
    print(f"created administrator {email}. Sign in to the back office and turn on two-factor authentication.")


def seed_blog(services: Services, directory: Path) -> int:
    meta = json.loads((directory / "posts.json").read_text(encoding="utf-8"))
    created = 0
    now = utcnow()
    with services.db.tx() as c:
        for post in meta:
            published = datetime.fromisoformat(post["date"]).replace(hour=8, tzinfo=UTC)
            for lang in ("en", "ar"):
                body_path = directory / f"{post['slug']}.{lang}.md"
                if not body_path.exists() or c.one("SELECT id FROM posts WHERE slug = :s AND language = :l", s=post["slug"], l=lang):
                    continue
                c.insert("posts", {
                    "slug": post["slug"], "language": lang, "category": post["category"], "title": post["title"][lang], "excerpt": post["excerpt"][lang],
                    "body_md": body_path.read_text(encoding="utf-8"), "status": "published", "published_at": published, "created_at": now, "updated_at": now,
                })
                created += 1
    return created


def cmd_seed_blog(args: argparse.Namespace) -> None:
    directory = Path(args.path or os.environ.get("BLOG_SEED_DIR") or DEFAULT_BLOG_DIR)
    if not (directory / "posts.json").exists():
        sys.exit(f"posts.json not found in {directory}")
    services = _services()
    services.db.migrate()
    print(f"imported {seed_blog(services, directory)} article(s) from {directory}")


def cmd_sync_accounts(_: argparse.Namespace) -> None:
    services = _services()
    if not services.mt5.enabled:
        print("MT5 integration is off; nothing to sync")
        return
    with services.db.tx() as c:
        ids = [r["id"] for r in c.all("SELECT id FROM trading_accounts WHERE status = 'active' AND login IS NOT NULL ORDER BY id")]
    for account_id in ids:
        sync_account(services, account_id)
    print(f"synced {len(ids)} account(s)")


def cmd_send_emails(_: argparse.Namespace) -> None:
    services = _services()
    total = 0
    while True:
        handled = services.mailer.flush()
        total += handled
        if handled == 0:
            break
    print(f"handled {total} email(s)")


def cmd_openapi(_: argparse.Namespace) -> None:
    from . import __version__
    from .main import APIS
    from .web import build_openapi

    settings = get_settings()
    print(json.dumps(build_openapi(APIS, title="Bolt Markets API", version=__version__, server_url=settings.public_api_url), indent=2, default=str))


def cmd_check(_: argparse.Namespace) -> None:
    s = get_settings()
    rows = [
        ("environment", s.environment),
        ("database", "postgresql" if s.database_url.startswith("postgres") else "sqlite"),
        ("registration open", s.registration_open),
        ("restricted countries", ", ".join(s.restricted_countries) or "(none set)"),
        ("MT5", f"{s.mt5_mode} ({'connected settings present' if s.mt5_enabled else 'off'})"),
        ("live prices", s.quotes_mode),
        ("card payments (Stripe)", s.stripe_enabled),
        ("crypto payments (NOWPayments)", s.nowpayments_enabled),
        ("KYC provider", s.effective_kyc_provider),
        ("SMTP email", s.smtp_enabled),
        ("support inbox", s.support_inbox or "(none)"),
        ("site rebuild on publish", bool(s.github_dispatch_token and s.github_repository)),
    ]
    for key, value in rows:
        print(f"{key:32} {value}")
    problems = s.validate()
    print("\nproblems:\n- " + "\n- ".join(problems) if problems else "\nno blocking problems")


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="Bolt Markets operations")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("migrate").set_defaults(fn=cmd_migrate)
    p = sub.add_parser("create-admin")
    p.add_argument("--email", required=True)
    p.add_argument("--name", default="Platform Administrator")
    p.add_argument("--password", help="omit to be prompted (recommended)")
    p.set_defaults(fn=cmd_create_admin)
    p = sub.add_parser("seed-blog")
    p.add_argument("--path", help="folder with posts.json and <slug>.<lang>.md files")
    p.set_defaults(fn=cmd_seed_blog)
    sub.add_parser("sync-accounts").set_defaults(fn=cmd_sync_accounts)
    sub.add_parser("send-emails").set_defaults(fn=cmd_send_emails)
    sub.add_parser("openapi").set_defaults(fn=cmd_openapi)
    sub.add_parser("check").set_defaults(fn=cmd_check)
    args = parser.parse_args(argv)
    try:
        args.fn(args)
    except ValueError as exc:
        sys.exit(str(exc).split("||")[0])


if __name__ == "__main__":
    main()
