"""Application settings, read from environment variables (see backend/.env.example).

Every integration that needs credentials you have not supplied yet stays switched off
until its variables are present. Nothing here invents company or regulatory details.
"""
from __future__ import annotations

import os
import secrets
from dataclasses import dataclass, field
from functools import lru_cache
from urllib.parse import urlsplit


def _s(name: str, default: str = "") -> str:
    """Environment value; a missing or blank variable means "use the default"."""
    value = os.environ.get(name)
    return default if value is None or not value.strip() else value.strip()


def _b(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _vercel_url() -> str:
    """Production URL Vercel exposes to its functions (host name only)."""
    host = os.environ.get("VERCEL_PROJECT_PRODUCTION_URL", "").strip()
    return f"https://{host}" if host else ""


def _i(name: str, default: int) -> int:
    raw = _s(name)
    return int(raw) if raw else default


def _list(name: str, default: str = "") -> list[str]:
    return [x.strip() for x in _s(name, default).split(",") if x.strip()]


def _plans(raw: str) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    for part in raw.split(","):
        if ":" in part:
            size, fee = part.split(":", 1)
            out.append((int(size.strip()), int(fee.strip())))
    return out


def origin_of(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}" if parts.scheme and parts.netloc else ""


DEFAULT_SYMBOLS = (
    "EURUSD,GBPUSD,USDJPY,USDCHF,AUDUSD,USDCAD,NZDUSD,EURGBP,EURJPY,GBPJPY,EURCHF,AUDJPY,EURAUD,GBPCHF,USDMXN,USDZAR,"
    "US30,US500,NAS100,GER40,UK100,JP225,EU50,AUS200,BTCUSD,ETHUSD,SOLUSD,XRPUSD,LTCUSD,BNBUSD,ADAUSD,DOGEUSD,"
    "XAUUSD,XAGUSD,XPTUSD,USOIL,UKOIL,NATGAS"
)


@dataclass(frozen=True)
class Settings:
    environment: str = field(default_factory=lambda: _s("ENVIRONMENT", "development"))
    secret_key: str = field(default_factory=lambda: _s("SECRET_KEY"))
    data_key: str = field(default_factory=lambda: _s("DATA_KEY"))
    # POSTGRES_URL is the name some hosted Postgres integrations (Vercel Marketplace) use.
    database_url: str = field(default_factory=lambda: _s("DATABASE_URL", _s("POSTGRES_URL", "sqlite:///./bolt.db")))
    db_pool_size: int = field(default_factory=lambda: _i("DB_POOL_SIZE", 10))
    frontend_url: str = field(default_factory=lambda: _s("FRONTEND_URL", "http://localhost:5173").rstrip("/"))
    admin_url: str = field(default_factory=lambda: _s("ADMIN_URL", "http://localhost:5174").rstrip("/"))
    # Render sets RENDER_EXTERNAL_URL for every web service, so the Blueprint needs no extra value.
    public_api_url: str = field(default_factory=lambda: _s("PUBLIC_API_URL", _s("RENDER_EXTERNAL_URL", _vercel_url() or "http://localhost:8000")).rstrip("/"))
    extra_cors_origins: list[str] = field(default_factory=lambda: _list("CORS_ORIGINS"))
    api_docs: bool = field(default_factory=lambda: _b("API_DOCS", _s("ENVIRONMENT", "development") != "production"))
    trust_proxy: bool = field(default_factory=lambda: _b("TRUST_PROXY", True))
    rate_limits: bool = field(default_factory=lambda: _b("RATE_LIMITS", True))
    validate_responses: bool = field(default_factory=lambda: _b("VALIDATE_RESPONSES", _s("ENVIRONMENT", "development") != "production"))
    brand: str = "Bolt Markets"

    # Accounts & auth
    registration_open: bool = field(default_factory=lambda: _b("REGISTRATION_OPEN", _s("ENVIRONMENT", "development") != "production"))
    restricted_countries: list[str] = field(default_factory=lambda: [c.upper() for c in _list("RESTRICTED_COUNTRIES")])
    access_token_minutes: int = field(default_factory=lambda: _i("ACCESS_TOKEN_MINUTES", 15))
    refresh_token_days: int = field(default_factory=lambda: _i("REFRESH_TOKEN_DAYS", 30))
    admin_require_2fa: bool = field(default_factory=lambda: _b("ADMIN_REQUIRE_2FA", True))
    bootstrap_admin_email: str = field(default_factory=lambda: _s("BOOTSTRAP_ADMIN_EMAIL").lower())
    bootstrap_admin_password: str = field(default_factory=lambda: _s("BOOTSTRAP_ADMIN_PASSWORD"))
    bootstrap_admin_name: str = field(default_factory=lambda: _s("BOOTSTRAP_ADMIN_NAME", "Platform Administrator"))
    scrypt_n: int = field(default_factory=lambda: _i("SCRYPT_N", 2**15))

    # Email
    smtp_host: str = field(default_factory=lambda: _s("SMTP_HOST"))
    # Deliver email during the request instead of from a background thread. Needed on serverless
    # hosts (Vercel), where nothing runs between requests; on by default when VERCEL is set.
    mail_sync: bool = field(default_factory=lambda: _b("MAIL_SYNC", bool(os.environ.get("VERCEL"))))
    smtp_port: int = field(default_factory=lambda: _i("SMTP_PORT", 587))
    smtp_user: str = field(default_factory=lambda: _s("SMTP_USER"))
    smtp_password: str = field(default_factory=lambda: _s("SMTP_PASSWORD"))
    smtp_from: str = field(default_factory=lambda: _s("SMTP_FROM", "Bolt Markets <no-reply@localhost>"))
    smtp_security: str = field(default_factory=lambda: _s("SMTP_SECURITY", "starttls").lower())  # starttls | ssl | none
    support_inbox: str = field(default_factory=lambda: _s("SUPPORT_INBOX"))

    # MetaTrader 5
    mt5_mode: str = field(default_factory=lambda: _s("MT5_MODE", "disabled").lower())  # disabled | mock | webapi | bridge
    mt5_webapi_url: str = field(default_factory=lambda: _s("MT5_WEBAPI_URL").rstrip("/"))
    mt5_manager_login: str = field(default_factory=lambda: _s("MT5_MANAGER_LOGIN"))
    mt5_manager_password: str = field(default_factory=lambda: _s("MT5_MANAGER_PASSWORD"))
    mt5_webapi_verify_tls: bool = field(default_factory=lambda: _b("MT5_WEBAPI_VERIFY_TLS", True))
    mt5_bridge_url: str = field(default_factory=lambda: _s("MT5_BRIDGE_URL").rstrip("/"))
    mt5_bridge_key: str = field(default_factory=lambda: _s("MT5_BRIDGE_KEY"))
    mt5_server_live: str = field(default_factory=lambda: _s("MT5_SERVER_LIVE"))
    mt5_server_demo: str = field(default_factory=lambda: _s("MT5_SERVER_DEMO"))
    mt5_groups: dict[str, str] = field(
        default_factory=lambda: {
            "standard": _s("MT5_GROUP_STANDARD", "real\\standard"),
            "pro": _s("MT5_GROUP_PRO", "real\\pro"),
            "institutional": _s("MT5_GROUP_INSTITUTIONAL", "real\\institutional"),
            "demo": _s("MT5_GROUP_DEMO", "demo\\standard"),
            "funded": _s("MT5_GROUP_FUNDED", "demo\\funded"),
        }
    )
    demo_balance: int = field(default_factory=lambda: _i("DEMO_BALANCE", 10000))
    account_currencies: list[str] = field(default_factory=lambda: [c.upper() for c in _list("ACCOUNT_CURRENCIES", "USD")])
    leverage_options: list[int] = field(default_factory=lambda: [int(x) for x in _list("LEVERAGE_OPTIONS", "50,100,200,300,400,500")])
    max_accounts_per_user: int = field(default_factory=lambda: _i("MAX_ACCOUNTS_PER_USER", 10))
    account_sync_minutes: int = field(default_factory=lambda: _i("ACCOUNT_SYNC_MINUTES", 10))

    # Prices
    quotes_mode: str = field(default_factory=lambda: _s("QUOTES_MODE", "disabled").lower())  # disabled | bridge | terminal | simulated
    quotes_bridge_key: str = field(default_factory=lambda: _s("QUOTES_BRIDGE_KEY"))
    quote_symbols: list[str] = field(default_factory=lambda: [s.upper() for s in _list("QUOTE_SYMBOLS", DEFAULT_SYMBOLS)])
    mt5_terminal_path: str = field(default_factory=lambda: _s("MT5_TERMINAL_PATH"))
    mt5_terminal_login: str = field(default_factory=lambda: _s("MT5_TERMINAL_LOGIN"))
    mt5_terminal_password: str = field(default_factory=lambda: _s("MT5_TERMINAL_PASSWORD"))
    mt5_terminal_server: str = field(default_factory=lambda: _s("MT5_TERMINAL_SERVER"))

    # Payments
    stripe_secret_key: str = field(default_factory=lambda: _s("STRIPE_SECRET_KEY"))
    stripe_webhook_secret: str = field(default_factory=lambda: _s("STRIPE_WEBHOOK_SECRET"))
    nowpayments_api_key: str = field(default_factory=lambda: _s("NOWPAYMENTS_API_KEY"))
    nowpayments_ipn_secret: str = field(default_factory=lambda: _s("NOWPAYMENTS_IPN_SECRET"))
    nowpayments_sandbox: bool = field(default_factory=lambda: _b("NOWPAYMENTS_SANDBOX"))
    min_deposit: int = field(default_factory=lambda: _i("MIN_DEPOSIT", 10))
    min_withdrawal: int = field(default_factory=lambda: _i("MIN_WITHDRAWAL", 10))
    require_kyc_for_deposit: bool = field(default_factory=lambda: _b("REQUIRE_KYC_FOR_DEPOSIT", True))
    account_min_deposits: dict[str, int] = field(default_factory=lambda: {"standard": 10, "pro": 1000, "institutional": 100000})

    # KYC
    kyc_provider: str = field(default_factory=lambda: _s("KYC_PROVIDER", "manual").lower())  # manual | sumsub
    sumsub_app_token: str = field(default_factory=lambda: _s("SUMSUB_APP_TOKEN"))
    sumsub_secret_key: str = field(default_factory=lambda: _s("SUMSUB_SECRET_KEY"))
    sumsub_webhook_secret: str = field(default_factory=lambda: _s("SUMSUB_WEBHOOK_SECRET"))
    sumsub_level_name: str = field(default_factory=lambda: _s("SUMSUB_LEVEL_NAME", "basic-kyc-level"))
    sumsub_base_url: str = field(default_factory=lambda: _s("SUMSUB_BASE_URL", "https://api.sumsub.com").rstrip("/"))
    kyc_storage: str = field(default_factory=lambda: _s("KYC_STORAGE", "database").lower())  # database | local
    kyc_local_dir: str = field(default_factory=lambda: _s("KYC_LOCAL_DIR", "./uploads"))
    max_upload_mb: int = field(default_factory=lambda: _i("MAX_UPLOAD_MB", 10))

    # Bolt Funded (must match frontend/src/config/funded.ts)
    funded_plans: list[tuple[int, int]] = field(default_factory=lambda: _plans(_s("FUNDED_PLANS", "10000:99,25000:199,50000:299,100000:499,200000:949")))
    funded_leverage: int = field(default_factory=lambda: _i("FUNDED_LEVERAGE", 100))
    funded_max_daily_loss: int = field(default_factory=lambda: _i("FUNDED_MAX_DAILY_LOSS", 5))
    funded_max_overall_loss: int = field(default_factory=lambda: _i("FUNDED_MAX_OVERALL_LOSS", 10))
    funded_phase1_target: int = field(default_factory=lambda: _i("FUNDED_PHASE1_TARGET", 8))
    funded_phase2_target: int = field(default_factory=lambda: _i("FUNDED_PHASE2_TARGET", 5))

    # Optional: rebuild the static site when a blog post is published
    github_dispatch_token: str = field(default_factory=lambda: _s("GITHUB_DISPATCH_TOKEN"))
    github_repository: str = field(default_factory=lambda: _s("GITHUB_REPOSITORY"))

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def jwt_secret(self) -> str:
        return self.secret_key or _dev_secret()

    @property
    def encryption_key(self) -> str:
        # Development falls back to a fixed, clearly non-secret key so local data stays readable.
        return self.data_key or "bolt-markets-development-only-data-key"

    @property
    def cors_origins(self) -> list[str]:
        out: list[str] = []
        for value in [origin_of(self.frontend_url), origin_of(self.admin_url), *self.extra_cors_origins]:
            value = value.rstrip("/")
            if value and value not in out:
                out.append(value)
        return out

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host)

    @property
    def mt5_enabled(self) -> bool:
        if self.mt5_mode == "mock":
            return True
        if self.mt5_mode == "webapi":
            return bool(self.mt5_webapi_url and self.mt5_manager_login and self.mt5_manager_password)
        if self.mt5_mode == "bridge":
            return bool(self.mt5_bridge_url and self.mt5_bridge_key)
        return False

    @property
    def stripe_enabled(self) -> bool:
        return bool(self.stripe_secret_key and self.stripe_webhook_secret)

    @property
    def nowpayments_enabled(self) -> bool:
        return bool(self.nowpayments_api_key and self.nowpayments_ipn_secret)

    @property
    def sumsub_enabled(self) -> bool:
        return self.kyc_provider == "sumsub" and bool(self.sumsub_app_token and self.sumsub_secret_key)

    @property
    def effective_kyc_provider(self) -> str:
        return "sumsub" if self.sumsub_enabled else "manual"

    def funded_fee(self, plan_size: int) -> int | None:
        for size, fee in self.funded_plans:
            if size == plan_size:
                return fee
        return None

    def validate(self) -> list[str]:
        """Problems that must block start-up in production."""
        problems: list[str] = []
        if self.is_production:
            if len(self.secret_key) < 32:
                problems.append("SECRET_KEY must be set to at least 32 random characters.")
            if len(self.data_key) < 32:
                problems.append("DATA_KEY must be set to at least 32 random characters (it encrypts KYC files and 2FA secrets).")
            if self.database_url.startswith("sqlite"):
                problems.append("DATABASE_URL must point to PostgreSQL in production.")
            if self.quotes_mode == "simulated":
                problems.append("QUOTES_MODE=simulated is not allowed in production.")
            if self.mt5_mode == "mock":
                problems.append("MT5_MODE=mock is not allowed in production.")
            if not self.frontend_url.startswith("https://"):
                problems.append("FRONTEND_URL must be an https:// URL in production.")
        if self.mt5_mode not in {"disabled", "mock", "webapi", "bridge"}:
            problems.append("MT5_MODE must be one of disabled, mock, webapi, bridge.")
        if self.quotes_mode not in {"disabled", "bridge", "terminal", "simulated"}:
            problems.append("QUOTES_MODE must be one of disabled, bridge, terminal, simulated.")
        if self.quotes_mode == "bridge" and not self.quotes_bridge_key:
            problems.append("QUOTES_MODE=bridge needs QUOTES_BRIDGE_KEY.")
        return problems


@lru_cache(maxsize=1)
def _dev_secret() -> str:
    # Development only: a random per-process key (sessions end when the process restarts).
    return secrets.token_urlsafe(48)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
