"""Request and response models (also used to generate the OpenAPI document)."""
from __future__ import annotations

import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .security import password_problem
from .web import bi

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
Lang = Literal["en", "ar"]
Role = Literal["client", "support", "compliance", "finance", "admin"]
KycStatus = Literal["none", "draft", "pending", "approved", "rejected"]
AccountKind = Literal["live", "demo"]
AccountStatus = Literal["pending", "active", "disabled", "failed"]
TxType = Literal["deposit", "withdrawal", "ib_commission", "adjustment", "funded_fee"]
TxStatus = Literal["pending", "awaiting_payment", "processing", "completed", "rejected", "failed", "cancelled"]
ChallengeStatus = Literal["awaiting_payment", "pending_activation", "phase1", "phase2", "funded", "failed", "cancelled"]
TicketCategory = Literal["account", "payments", "platform", "funded", "other"]
PostCategory = Literal["learn", "insights"]

_PASSWORD_MESSAGES = {
    "length": bi("Use at least 10 characters.", "استخدم 10 أحرف على الأقل."),
    "too_long": bi("Use at most 200 characters.", "استخدم 200 حرف كحد أقصى."),
    "letter": bi("Include at least one letter.", "أضف حرفًا واحدًا على الأقل."),
    "number": bi("Include at least one number.", "أضف رقمًا واحدًا على الأقل."),
    "common": bi("This password is too common.", "كلمة المرور هذه شائعة جدًا."),
}


def clean_email(value: str) -> str:
    value = (value or "").strip().lower()
    if len(value) > 254 or not EMAIL_RE.match(value):
        raise ValueError(bi("Enter a valid email address.", "أدخل بريدًا إلكترونيًا صحيحًا."))
    return value


def strong_password(value: str) -> str:
    problem = password_problem(value)
    if problem:
        raise ValueError(_PASSWORD_MESSAGES[problem])
    return value


def to_cents(value: float | str | Decimal) -> int:
    try:
        amount = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError(bi("Enter a valid amount.", "أدخل مبلغًا صحيحًا.")) from exc
    if not amount.is_finite() or amount <= 0:
        raise ValueError(bi("Enter an amount greater than zero.", "أدخل مبلغًا أكبر من صفر."))
    if amount != amount.quantize(Decimal("0.01")):
        raise ValueError(bi("Use at most two decimal places.", "استخدم منزلتين عشريتين كحد أقصى."))
    if amount > Decimal("10000000"):
        raise ValueError(bi("This amount is too large.", "هذا المبلغ كبير جدًا."))
    return int(amount * 100)


class In(BaseModel):
    model_config = ConfigDict(extra="ignore")


# --- auth -------------------------------------------------------------------------------------------

class RegisterIn(In):
    full_name: str = Field(max_length=120)
    email: str
    password: str
    country: str
    language: Lang = "en"
    referral_code: str | None = Field(default=None, max_length=32)
    accept_terms: bool

    @field_validator("full_name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v.split(" ")) < 2 or len(v) < 3:
            raise ValueError(bi("Enter your first and last name as on your ID.", "أدخل اسمك الأول والأخير كما في هويتك."))
        return v

    _email = field_validator("email")(classmethod(lambda cls, v: clean_email(v)))
    _password = field_validator("password")(classmethod(lambda cls, v: strong_password(v)))

    @field_validator("country")
    @classmethod
    def _country(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.fullmatch(r"[A-Z]{2}", v):
            raise ValueError(bi("Select your country of residence.", "اختر دولة إقامتك."))
        return v

    @field_validator("accept_terms")
    @classmethod
    def _terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError(bi("You need to accept the terms to continue.", "يجب الموافقة على الشروط للمتابعة."))
        return v

    @field_validator("referral_code")
    @classmethod
    def _ref(cls, v: str | None) -> str | None:
        v = (v or "").strip().upper()
        return v or None


class LoginIn(In):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return v.strip().lower()


class Login2faIn(In):
    mfa_token: str = Field(max_length=2000)
    code: str = Field(max_length=20)


class RefreshIn(In):
    refresh_token: str = Field(max_length=200)


class TokenIn(In):
    token: str = Field(max_length=200)


class EmailIn(In):
    email: str = Field(max_length=254)
    language: Lang | None = None

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return v.strip().lower()


class ResetPasswordIn(In):
    token: str = Field(max_length=200)
    password: str
    _password = field_validator("password")(classmethod(lambda cls, v: strong_password(v)))


class TokenPairOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"]
    expires_in: int


class MfaRequiredOut(BaseModel):
    mfa_required: Literal[True]
    mfa_token: str


class OkOut(BaseModel):
    ok: bool


# --- users ------------------------------------------------------------------------------------------

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    phone: str | None
    country: str
    language: Lang
    role: Role
    email_verified: bool
    totp_enabled: bool
    kyc_status: KycStatus
    referral_code: str
    created_at: datetime
    permissions: list[str]


class UpdateProfileIn(In):
    full_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    language: Lang | None = None

    @field_validator("full_name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = " ".join(v.split())
        if len(v.split(" ")) < 2:
            raise ValueError(bi("Enter your first and last name.", "أدخل اسمك الأول والأخير."))
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if not re.fullmatch(r"\+?[0-9 ()\-]{6,24}", v):
            raise ValueError(bi("Enter a valid phone number.", "أدخل رقم هاتف صحيحًا."))
        return v


class ChangePasswordIn(In):
    current_password: str = Field(max_length=200)
    new_password: str
    _password = field_validator("new_password")(classmethod(lambda cls, v: strong_password(v)))


class TotpSetupOut(BaseModel):
    secret: str
    otpauth_url: str


class CodeIn(In):
    code: str = Field(max_length=20)


class RecoveryCodesOut(BaseModel):
    recovery_codes: list[str]


class Disable2faIn(In):
    password: str = Field(max_length=200)
    code: str = Field(max_length=20)


# --- public -----------------------------------------------------------------------------------------

class PaymentMethodOut(BaseModel):
    id: Literal["card", "crypto"]
    provider: str
    min_amount: float
    currency: str


class PublicConfigOut(BaseModel):
    registration_open: bool
    mt5_enabled: bool
    mt5_server_live: str | None
    mt5_server_demo: str | None
    kyc_provider: Literal["manual", "sumsub"]
    require_kyc_for_deposit: bool
    deposit_methods: list[PaymentMethodOut]
    withdrawal_methods: list[PaymentMethodOut]
    leverage_options: list[int]
    account_currencies: list[str]
    demo_balance: int
    restricted_countries: list[str]


class ContactIn(In):
    name: str = Field(max_length=100)
    email: str
    topic: Literal["general", "accounts", "payments", "platform", "funded", "partnerships"] = "general"
    subject: str = Field(max_length=150)
    message: str = Field(max_length=5000)
    language: Lang = "en"
    website: str | None = Field(default=None, max_length=200)

    _email = field_validator("email")(classmethod(lambda cls, v: clean_email(v)))

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError(bi("Please enter your name.", "يرجى إدخال اسمك."))
        return v

    @field_validator("subject")
    @classmethod
    def _subject(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError(bi("Please add a short subject.", "يرجى إضافة موضوع مختصر."))
        return v

    @field_validator("message")
    @classmethod
    def _message(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 20:
            raise ValueError(bi("Please write at least 20 characters so we can help.", "يرجى كتابة 20 حرفًا على الأقل حتى نتمكن من المساعدة."))
        return v


class QuoteIn(BaseModel):
    s: str
    b: float
    a: float
    t: int | None = None
    o: float | None = None


class QuotesIngestIn(In):
    quotes: list[QuoteIn] = Field(max_length=500)


class QuotesOut(BaseModel):
    status: Literal["live", "simulated", "disabled", "waiting"]
    quotes: list[dict[str, float | int | str]]


class CmsPostOut(BaseModel):
    slug: str
    language: Lang
    category: PostCategory
    title: str
    excerpt: str
    body_md: str | None = None
    published_at: datetime
    reading_minutes: int


class CmsPostListOut(BaseModel):
    items: list[CmsPostOut]


# --- trading accounts ---------------------------------------------------------------------------------

class TradingAccountOut(BaseModel):
    id: int
    kind: AccountKind
    account_type: Literal["standard", "pro", "institutional", "funded"]
    login: str | None
    server: str | None
    leverage: int
    currency: str
    status: AccountStatus
    balance: float | None
    equity: float | None
    margin_free: float | None
    synced_at: datetime | None
    created_at: datetime


class AccountListOut(BaseModel):
    items: list[TradingAccountOut]


class OpenAccountIn(In):
    kind: AccountKind
    account_type: Literal["standard", "pro", "institutional"]
    leverage: int = Field(ge=1, le=3000)
    currency: str = Field(default="USD", max_length=3)


class OpenAccountOut(BaseModel):
    account: TradingAccountOut
    password: str | None
    investor_password: str | None


class PasswordOut(BaseModel):
    password: str


# --- money --------------------------------------------------------------------------------------------

class TransactionOut(BaseModel):
    id: int
    type: TxType
    method: str
    amount: float
    currency: str
    status: TxStatus
    account_id: int | None
    account_login: str | None
    reference: str | None
    note: str | None
    created_at: datetime
    updated_at: datetime


class TransactionPageOut(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    page_size: int


class DepositIn(In):
    account_id: int
    amount: float
    method: Literal["card", "crypto"]

    @field_validator("amount")
    @classmethod
    def _amount(cls, v: float) -> float:
        to_cents(v)
        return v


class DepositOut(BaseModel):
    transaction: TransactionOut
    redirect_url: str | None


class WithdrawIn(In):
    account_id: int
    amount: float
    method: Literal["card", "crypto"]
    destination: dict[str, str] = Field(default_factory=dict)

    @field_validator("amount")
    @classmethod
    def _amount(cls, v: float) -> float:
        to_cents(v)
        return v


# --- KYC ---------------------------------------------------------------------------------------------------

class KycDocumentOut(BaseModel):
    id: int
    doc_type: Literal["id_front", "id_back", "proof_of_address", "selfie"]
    filename: str
    status: Literal["uploaded", "accepted", "rejected"]
    rejection_reason: str | None
    created_at: datetime


class KycStateOut(BaseModel):
    status: KycStatus
    provider: Literal["manual", "sumsub"]
    rejection_reason: str | None
    required: list[str]
    documents: list[KycDocumentOut]


class SumsubTokenOut(BaseModel):
    token: str


# --- support -------------------------------------------------------------------------------------------------

class TicketOut(BaseModel):
    id: int
    subject: str
    category: str
    status: Literal["open", "answered", "closed"]
    created_at: datetime
    updated_at: datetime


class TicketListOut(BaseModel):
    items: list[TicketOut]


class TicketMessageOut(BaseModel):
    id: int
    body: str
    is_staff: bool
    author_name: str
    created_at: datetime


class TicketDetailOut(BaseModel):
    ticket: TicketOut
    messages: list[TicketMessageOut]


class TicketIn(In):
    subject: str = Field(max_length=150)
    category: TicketCategory = "other"
    message: str = Field(max_length=5000)

    @field_validator("subject")
    @classmethod
    def _subject(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError(bi("Please add a short subject.", "يرجى إضافة موضوع مختصر."))
        return v

    @field_validator("message")
    @classmethod
    def _message(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 10:
            raise ValueError(bi("Please describe the issue in at least 10 characters.", "يرجى وصف المشكلة في 10 أحرف على الأقل."))
        return v


class TicketReplyIn(In):
    body: str = Field(max_length=5000)

    @field_validator("body")
    @classmethod
    def _body(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError(bi("Write a message first.", "اكتب رسالة أولًا."))
        return v


# --- partners ---------------------------------------------------------------------------------------------------

class IbStats(BaseModel):
    registered: int
    verified: int
    funded: int


class IbReferral(BaseModel):
    id: int
    name: str
    country: str
    joined_at: datetime
    status: Literal["registered", "verified", "funded"]


class IbOverviewOut(BaseModel):
    referral_code: str
    stats: IbStats
    commissions_total: float
    referrals: list[IbReferral]


# --- funded -------------------------------------------------------------------------------------------------------

class ChallengeOut(BaseModel):
    id: int
    plan_size: int
    fee: float
    status: ChallengeStatus
    account: TradingAccountOut | None
    created_at: datetime


class ChallengeListOut(BaseModel):
    items: list[ChallengeOut]


class BuyChallengeIn(In):
    plan_size: int
    method: Literal["card", "crypto"]


class BuyChallengeOut(BaseModel):
    challenge: ChallengeOut
    redirect_url: str | None
