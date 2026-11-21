"""A thin, typed routing layer on top of Starlette.

Handlers receive a ``Ctx`` with the validated Pydantic body, the authenticated user and the
shared services. Errors use one shape everywhere:
``{"error": {"code": "...", "message": "...", "fields": {"name": "..."}}}``.
Messages are returned in English or Arabic, following the request's Accept-Language.
"""
from __future__ import annotations

import inspect
import json
import logging
import re
import threading
import time
from collections import deque
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, TypeAdapter, ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import HTMLResponse, Response
from starlette.routing import Route

from .security import TokenInvalid, decode_token

if TYPE_CHECKING:
    from .services.container import Services

log = logging.getLogger("bolt.api")

# --- errors ------------------------------------------------------------------------------------

Text = str | tuple[str, str]


def bi(en: str, ar: str) -> str:
    """Bilingual message for Pydantic validators (split again when the error is rendered)."""
    return f"{en}||{ar}"


class ApiError(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        en: str,
        ar: str | None = None,
        fields: dict[str, Text] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(en)
        self.status = status
        self.code = code
        self.en = en
        self.ar = ar or en
        self.fields = fields or {}
        self.headers = headers or {}

    def render(self, lang: str) -> dict[str, Any]:
        fields: dict[str, str] = {}
        for key, value in self.fields.items():
            if isinstance(value, tuple):
                fields[key] = value[1] if lang == "ar" else value[0]
            else:
                fields[key] = _pick(value, lang)
        return {"error": {"code": self.code, "message": self.ar if lang == "ar" else self.en, "fields": fields}}


def _pick(message: str, lang: str) -> str:
    if "||" in message:
        en, ar = message.split("||", 1)
        return ar if lang == "ar" else en
    return message


def not_found(what_en: str = "Not found.", what_ar: str = "غير موجود.") -> ApiError:
    return ApiError(404, "NOT_FOUND", what_en, what_ar)


_GENERIC_FIELD_ERRORS: dict[str, tuple[str, str]] = {
    "missing": ("This field is required.", "هذا الحقل مطلوب."),
    "string_too_short": ("This value is too short.", "هذه القيمة قصيرة جدًا."),
    "string_too_long": ("This value is too long.", "هذه القيمة طويلة جدًا."),
    "literal_error": ("Choose one of the allowed values.", "اختر إحدى القيم المسموح بها."),
    "enum": ("Choose one of the allowed values.", "اختر إحدى القيم المسموح بها."),
    "greater_than": ("This value is too small.", "هذه القيمة صغيرة جدًا."),
    "greater_than_equal": ("This value is too small.", "هذه القيمة صغيرة جدًا."),
    "less_than": ("This value is too large.", "هذه القيمة كبيرة جدًا."),
    "less_than_equal": ("This value is too large.", "هذه القيمة كبيرة جدًا."),
}


def validation_error(exc: ValidationError) -> ApiError:
    fields: dict[str, Text] = {}
    for err in exc.errors():
        loc = [str(p) for p in err.get("loc", ()) if not isinstance(p, int)]
        key = loc[-1] if loc else "form"
        if key in fields:
            continue
        if err.get("type") == "value_error":
            message = str(err.get("msg", "")).removeprefix("Value error, ")
            fields[key] = message if "||" in message else (message, message)
        else:
            fields[key] = _GENERIC_FIELD_ERRORS.get(str(err.get("type")), ("This value is not valid.", "هذه القيمة غير صالحة."))
    return ApiError(422, "VALIDATION_ERROR", "Please check the highlighted fields.", "يرجى مراجعة الحقول المحددة.", fields)


# --- rate limiting ----------------------------------------------------------------------------------

class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def hit(self, key: str, limit: int, window: int) -> bool:
        now = time.monotonic()
        with self._lock:
            bucket = self._hits.setdefault(key, deque())
            while bucket and bucket[0] <= now - window:
                bucket.popleft()
            if len(bucket) >= limit:
                return False
            bucket.append(now)
            if now - self._last_sweep > 300:
                self._last_sweep = now
                for k in [k for k, v in self._hits.items() if not v or v[-1] <= now - 3600]:
                    del self._hits[k]
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


def rate_limit(ctx: Ctx, bucket: str, limit: int, window: int, *, key: str = "") -> None:
    settings = ctx.services.settings
    if not settings.rate_limits:
        return
    if not ctx.services.limiter.hit(f"{bucket}:{ctx.ip}:{key}", limit, window):
        raise ApiError(
            429,
            "RATE_LIMITED",
            "Too many attempts. Please wait a few minutes and try again.",
            "محاولات كثيرة. يرجى الانتظار بضع دقائق ثم المحاولة مجددًا.",
            headers={"Retry-After": str(window)},
        )


# --- permissions ---------------------------------------------------------------------------------------

STAFF_ROLES = ("support", "compliance", "finance", "admin")
PERMISSIONS: dict[str, set[str]] = {
    "users.read": {"admin", "compliance", "finance", "support"},
    "users.write": {"admin", "compliance"},
    "users.role": {"admin"},
    "kyc": {"admin", "compliance"},
    "finance": {"admin", "finance"},
    "support": {"admin", "support", "compliance"},
    "content": {"admin", "support"},
    "audit": {"admin", "compliance"},
    "system": {"admin"},
}


def permissions_for(role: str) -> list[str]:
    return sorted(p for p, roles in PERMISSIONS.items() if role in roles)


def has_perms(role: str, perms: tuple[str, ...]) -> bool:
    return all(role in PERMISSIONS.get(p, set()) for p in perms)


# --- request context -----------------------------------------------------------------------------------

@dataclass
class Uploaded:
    filename: str
    content_type: str
    data: bytes


class Ctx:
    def __init__(self, request: Request, services: Services, lang: str) -> None:
        self.request = request
        self.services = services
        self.lang = lang
        self.user: dict[str, Any] | None = None
        self.body: Any = None
        self.form: dict[str, Any] = {}
        self.raw: bytes = b""

    @property
    def settings(self):
        return self.services.settings

    @property
    def db(self):
        return self.services.db

    @property
    def me(self) -> dict[str, Any]:
        assert self.user is not None, "endpoint requires authentication"
        return self.user

    @property
    def ip(self) -> str:
        if self.services.settings.trust_proxy:
            forwarded = self.request.headers.get("x-forwarded-for", "")
            if forwarded:
                return forwarded.split(",")[0].strip()[:64]
        return (self.request.client.host if self.request.client else "unknown")[:64]

    @property
    def user_agent(self) -> str:
        return self.request.headers.get("user-agent", "")[:300]

    @property
    def query(self):
        return self.request.query_params

    def path_int(self, name: str) -> int:
        value = self.request.path_params.get(name)
        if isinstance(value, int):
            return value
        try:
            return int(str(value))
        except ValueError as exc:
            raise not_found() from exc

    def query_int(self, name: str, default: int, *, lo: int = 1, hi: int = 10_000) -> int:
        raw = self.request.query_params.get(name)
        if raw in (None, ""):
            return default
        try:
            return max(lo, min(hi, int(raw)))
        except ValueError:
            return default

    def t(self, en: str, ar: str) -> str:
        return ar if self.lang == "ar" else en


# --- endpoints ------------------------------------------------------------------------------------------

Handler = Callable[[Ctx], Any] | Callable[[Ctx], Awaitable[Any]]


@dataclass
class Endpoint:
    method: str
    path: str
    fn: Handler
    auth: str = "user"  # public | optional | user | staff
    perms: tuple[str, ...] = ()
    body: type[BaseModel] | None = None
    form: bool = False
    raw: bool = False
    response: Any = None
    status: int = 200
    summary: str = ""
    tags: tuple[str, ...] = ()
    query: dict[str, str] = field(default_factory=dict)
    hidden: bool = False
    max_body: int = 1024 * 1024

    def __post_init__(self) -> None:
        self.is_async = inspect.iscoroutinefunction(self.fn)
        self.adapter = TypeAdapter(self.response) if self.response is not None else None


class Api:
    def __init__(self, prefix: str = "", tags: tuple[str, ...] = ()) -> None:
        self.prefix = prefix
        self.tags = tags
        self.endpoints: list[Endpoint] = []

    def route(self, method: str, path: str, **options: Any) -> Callable[[Handler], Handler]:
        def deco(fn: Handler) -> Handler:
            options.setdefault("tags", self.tags)
            self.endpoints.append(Endpoint(method=method, path=self.prefix + path, fn=fn, **options))
            return fn

        return deco

    def get(self, path: str, **o: Any) -> Callable[[Handler], Handler]:
        return self.route("GET", path, **o)

    def post(self, path: str, **o: Any) -> Callable[[Handler], Handler]:
        return self.route("POST", path, **o)

    def patch(self, path: str, **o: Any) -> Callable[[Handler], Handler]:
        return self.route("PATCH", path, **o)

    def put(self, path: str, **o: Any) -> Callable[[Handler], Handler]:
        return self.route("PUT", path, **o)

    def delete(self, path: str, **o: Any) -> Callable[[Handler], Handler]:
        return self.route("DELETE", path, **o)


def pick_lang(request: Request) -> str:
    first = request.headers.get("accept-language", "").split(",")[0].strip().lower()
    return "ar" if first.startswith("ar") else "en"


def _json_default(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat().replace("+00:00", "Z")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, (set, tuple)):
        return list(value)
    raise TypeError(f"not JSON serializable: {type(value).__name__}")


def dumps(data: Any) -> bytes:
    return json.dumps(data, default=_json_default, ensure_ascii=False, separators=(",", ":")).encode()


def json_response(data: Any, status: int = 200, headers: dict[str, str] | None = None) -> Response:
    return Response(dumps(data), status_code=status, media_type="application/json", headers=headers)


def _authenticate(services: Services, request: Request, ep: Endpoint) -> dict[str, Any] | None:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        if ep.auth == "optional":
            return None
        raise ApiError(401, "NOT_AUTHENTICATED", "Please log in to continue.", "يرجى تسجيل الدخول للمتابعة.")
    try:
        payload = decode_token(services.settings, header[7:].strip(), "access")
    except TokenInvalid as exc:
        if exc.expired:
            raise ApiError(401, "TOKEN_EXPIRED", "Your session has expired.", "انتهت صلاحية جلستك.") from exc
        raise ApiError(401, "TOKEN_INVALID", "Please log in again.", "يرجى تسجيل الدخول مجددًا.") from exc
    with services.db.tx() as c:
        user = c.get("users", int(payload["sub"]))
    if not user or int(payload.get("tv", -1)) != int(user["token_version"]):
        raise ApiError(401, "TOKEN_REVOKED", "Please log in again.", "يرجى تسجيل الدخول مجددًا.")
    user["_sid"] = str(payload.get("sid") or "")
    if user["status"] != "active":
        raise ApiError(403, "ACCOUNT_SUSPENDED", "This account is suspended. Please contact support.", "هذا الحساب موقوف. يرجى التواصل مع الدعم.")
    if ep.auth == "staff":
        if user["role"] not in STAFF_ROLES or not has_perms(user["role"], ep.perms):
            raise ApiError(403, "FORBIDDEN", "You do not have access to this area.", "ليست لديك صلاحية الوصول إلى هذا القسم.")
        if services.settings.admin_require_2fa and not user["totp_enabled"]:
            raise ApiError(
                403,
                "TWO_FACTOR_REQUIRED",
                "Turn on two-factor authentication to use the back office.",
                "فعّل المصادقة الثنائية لاستخدام لوحة الإدارة.",
            )
    return user


async def _parse_form(request: Request, max_bytes: int) -> dict[str, Any]:
    form = await request.form(max_files=4, max_fields=20, max_part_size=64 * 1024)
    out: dict[str, Any] = {}
    try:
        for key, value in form.multi_items():
            if isinstance(value, UploadFile):
                data = await value.read(max_bytes + 1)
                out[key] = Uploaded(value.filename or "upload", value.content_type or "application/octet-stream", data)
            else:
                out[key] = value
    finally:
        await form.close()
    return out


def make_endpoint(ep: Endpoint, services: Services) -> Callable[[Request], Awaitable[Response]]:
    async def endpoint(request: Request) -> Response:
        lang = pick_lang(request)
        ctx = Ctx(request, services, lang)
        try:
            if ep.auth != "public":
                ctx.user = await run_in_threadpool(_authenticate, services, request, ep)
            if ep.form:
                ctx.form = await _parse_form(request, ep.max_body)
            elif ep.method in ("POST", "PATCH", "PUT", "DELETE"):
                ctx.raw = await request.body()
                if len(ctx.raw) > ep.max_body:
                    raise ApiError(413, "PAYLOAD_TOO_LARGE", "The request is too large.", "حجم الطلب كبير جدًا.")
                if ep.body is not None:
                    try:
                        data = json.loads(ctx.raw or b"{}")
                    except ValueError as exc:
                        raise ApiError(400, "INVALID_JSON", "The request body is not valid JSON.", "محتوى الطلب ليس JSON صالحًا.") from exc
                    try:
                        ctx.body = ep.body.model_validate(data)
                    except ValidationError as exc:
                        raise validation_error(exc) from exc
            result = await ep.fn(ctx) if ep.is_async else await run_in_threadpool(ep.fn, ctx)
            if ep.method != "GET":
                if services.settings.mail_sync:
                    await run_in_threadpool(services.mailer.kick)
                else:
                    services.mailer.kick()
            if isinstance(result, Response):
                return result
            if result is None:
                return Response(status_code=204)
            payload = json.loads(dumps(result))
            if ep.adapter is not None and services.settings.validate_responses:
                try:
                    ep.adapter.validate_python(payload)
                except ValidationError:
                    log.exception("response for %s %s does not match its declared model", ep.method, ep.path)
                    raise
            return json_response(payload, ep.status)
        except ApiError as err:
            if err.status >= 500:
                log.warning("%s %s -> %s %s", ep.method, ep.path, err.status, err.code)
            return json_response(err.render(lang), err.status, err.headers)
        except HTTPException as exc:
            if exc.status_code == 413:
                too_large = ApiError(413, "PAYLOAD_TOO_LARGE", "The request is too large.", "حجم الطلب كبير جدًا.")
                return json_response(too_large.render(lang), 413)
            raise
        except Exception:
            log.exception("unhandled error in %s %s", ep.method, ep.path)
            failure = ApiError(500, "SERVER_ERROR", "Something went wrong on our side. Please try again.", "حدث خطأ من جانبنا. يرجى المحاولة مجددًا.")
            return json_response(failure.render(lang), 500)

    endpoint.__name__ = getattr(ep.fn, "__name__", "endpoint")
    return endpoint


def build_routes(apis: list[Api], services: Services) -> list[Route]:
    routes: list[Route] = []
    for api in apis:
        for ep in api.endpoints:
            routes.append(Route(ep.path, make_endpoint(ep, services), methods=[ep.method], name=f"{ep.method} {ep.path}", max_body_size=ep.max_body))
    return routes


# --- OpenAPI ---------------------------------------------------------------------------------------------

_CONVERTER = re.compile(r"\{(\w+)(?::(\w+))?\}")


def build_openapi(apis: list[Api], *, title: str, version: str, server_url: str) -> dict[str, Any]:
    components: dict[str, Any] = {
        "Error": {
            "type": "object",
            "properties": {
                "error": {
                    "type": "object",
                    "properties": {
                        "code": {"type": "string"},
                        "message": {"type": "string"},
                        "fields": {"type": "object", "additionalProperties": {"type": "string"}},
                    },
                    "required": ["code", "message", "fields"],
                }
            },
        }
    }

    def schema(tp: Any, mode: str) -> dict[str, Any]:
        s = TypeAdapter(tp).json_schema(ref_template="#/components/schemas/{model}", mode=mode)  # type: ignore[arg-type]
        components.update(s.pop("$defs", {}))
        if isinstance(tp, type) and issubclass(tp, BaseModel):
            components[tp.__name__] = s
            return {"$ref": f"#/components/schemas/{tp.__name__}"}
        return s

    paths: dict[str, dict[str, Any]] = {}
    for api in apis:
        for ep in api.endpoints:
            if ep.hidden:
                continue
            params = []
            for name, conv in _CONVERTER.findall(ep.path):
                params.append({"name": name, "in": "path", "required": True, "schema": {"type": "integer" if conv == "int" else "string"}})
            for name, typ in ep.query.items():
                params.append({"name": name, "in": "query", "required": False, "schema": {"type": typ}})
            op: dict[str, Any] = {
                "summary": ep.summary or ep.fn.__name__.replace("_", " ").capitalize(),
                "operationId": f"{ep.method.lower()}_{ep.fn.__name__}",
                "tags": list(ep.tags),
                "responses": {"default": {"description": "Error", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}}},
            }
            if params:
                op["parameters"] = params
            if ep.body is not None:
                op["requestBody"] = {"required": True, "content": {"application/json": {"schema": schema(ep.body, "validation")}}}
            elif ep.form:
                op["requestBody"] = {"required": True, "content": {"multipart/form-data": {"schema": {"type": "object"}}}}
            if ep.response is not None:
                op["responses"][str(ep.status)] = {"description": "Success", "content": {"application/json": {"schema": schema(ep.response, "serialization")}}}
            else:
                op["responses"]["204" if ep.status == 200 else str(ep.status)] = {"description": "Success"}
            if ep.auth in ("user", "staff"):
                op["security"] = [{"bearer": []}]
            path = _CONVERTER.sub(lambda m: "{" + m.group(1) + "}", ep.path)
            paths.setdefault(path, {})[ep.method.lower()] = op
    return {
        "openapi": "3.1.0",
        "info": {"title": title, "version": version},
        "servers": [{"url": server_url}],
        "paths": paths,
        "components": {"schemas": components, "securitySchemes": {"bearer": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}}},
    }


DOCS_HTML = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bolt Markets API</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"></head>
<body><div id="ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>window.ui = SwaggerUIBundle({ url: './openapi.json', dom_id: '#ui', deepLinking: true });</script>
</body></html>"""


def docs_page(_: Request) -> HTMLResponse:
    return HTMLResponse(DOCS_HTML)
