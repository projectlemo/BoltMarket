"""Outbound HTTPS calls (payment, KYC and MT5 bridge APIs) using only the standard library.

Tests replace ``Services.http`` with a fake, so every integration can be exercised offline.
"""
from __future__ import annotations

import json
import logging
import ssl
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any

log = logging.getLogger("bolt.http")


class IntegrationError(Exception):
    """A third-party service could not be reached or rejected the request."""


@dataclass
class HttpResponse:
    status: int
    body: bytes = b""
    headers: dict[str, str] = field(default_factory=dict)

    def json(self) -> Any:
        try:
            return json.loads(self.body or b"null")
        except ValueError as exc:
            raise IntegrationError(f"invalid JSON from upstream (HTTP {self.status})") from exc

    @property
    def ok(self) -> bool:
        return 200 <= self.status < 300


class HttpClient:
    def __init__(self, timeout: float = 20.0) -> None:
        self.timeout = timeout
        self._ssl = ssl.create_default_context()

    def request(
        self, method: str, url: str, *, headers: dict[str, str] | None = None, body: bytes | None = None, timeout: float | None = None
    ) -> HttpResponse:
        if not url.startswith(("https://", "http://")):
            raise IntegrationError("only http(s) URLs are allowed")
        req = urllib.request.Request(url, data=body, method=method, headers={"User-Agent": "BoltMarkets/1.0", **(headers or {})})  # noqa: S310
        try:
            with urllib.request.urlopen(req, timeout=timeout or self.timeout, context=self._ssl) as res:  # noqa: S310
                return HttpResponse(res.status, res.read(), dict(res.headers.items()))
        except urllib.error.HTTPError as exc:
            return HttpResponse(exc.code, exc.read() or b"", dict(exc.headers.items()) if exc.headers else {})
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            log.warning("%s %s failed: %s", method, url.split("?")[0], exc)
            raise IntegrationError(f"could not reach {url.split('/')[2] if '//' in url else url}") from exc

    def post_json(self, url: str, payload: Any, headers: dict[str, str] | None = None) -> HttpResponse:
        return self.request(
            "POST", url, headers={"Content-Type": "application/json", "Accept": "application/json", **(headers or {})}, body=json.dumps(payload).encode()
        )
