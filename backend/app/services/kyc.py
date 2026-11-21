"""Identity verification: encrypted document storage (manual review) and Sumsub integration."""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

from ..config import Settings
from ..security import Vault
from .http import HttpClient, IntegrationError

DOC_TYPES = ("id_front", "id_back", "proof_of_address", "selfie")
REQUIRED_DOCS = ("id_front", "id_back", "proof_of_address")
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf"}


class KycError(Exception):
    pass


def sniff_type(data: bytes) -> str | None:
    """Trust the file's bytes, not the browser's label."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    return None


def store_document(settings: Settings, vault: Vault, user_id: int, sha256: str, data: bytes) -> dict[str, Any]:
    """Encrypts the file and returns the columns describing where it lives."""
    aad = f"kyc:{user_id}:{sha256}".encode()
    encrypted = vault.encrypt(data, aad)
    if settings.kyc_storage == "local":
        folder = Path(settings.kyc_local_dir) / str(user_id)
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{sha256}.bin"
        path.write_bytes(encrypted)
        return {"storage": "local", "path": str(path), "data": None}
    return {"storage": "database", "path": None, "data": encrypted}


def read_document(vault: Vault, row: dict[str, Any]) -> bytes:
    aad = f"kyc:{row['user_id']}:{row['sha256']}".encode()
    blob = Path(row["path"]).read_bytes() if row["storage"] == "local" else bytes(row["data"])
    return vault.decrypt(blob, aad)


def delete_document_file(row: dict[str, Any]) -> None:
    if row.get("storage") == "local" and row.get("path"):
        Path(row["path"]).unlink(missing_ok=True)


# --- Sumsub ---------------------------------------------------------------------------------------

def external_user_id(user_id: int) -> str:
    return f"bolt-{user_id}"


def user_id_from_external(value: str) -> int | None:
    if value.startswith("bolt-") and value[5:].isdigit():
        return int(value[5:])
    return None


def sumsub_access_token(settings: Settings, http: HttpClient, user_id: int) -> str:
    path = f"/resources/accessTokens?userId={quote(external_user_id(user_id))}&levelName={quote(settings.sumsub_level_name)}&ttlInSecs=1800"
    ts = str(int(time.time()))
    signature = hmac.new(settings.sumsub_secret_key.encode(), (ts + "POST" + path).encode(), hashlib.sha256).hexdigest()
    try:
        res = http.request(
            "POST",
            settings.sumsub_base_url + path,
            headers={"X-App-Token": settings.sumsub_app_token, "X-App-Access-Ts": ts, "X-App-Access-Sig": signature, "Accept": "application/json"},
            body=b"",
        )
    except IntegrationError as exc:
        raise KycError("verification service unreachable") from exc
    data = res.json()
    if not res.ok or not data.get("token"):
        raise KycError(f"Sumsub rejected the request: {(data or {}).get('description', f'HTTP {res.status}')}")
    return str(data["token"])


_DIGESTS = {"HMAC_SHA1_HEX": hashlib.sha1, "HMAC_SHA256_HEX": hashlib.sha256, "HMAC_SHA512_HEX": hashlib.sha512}


def sumsub_verify(secret: str, payload: bytes, digest: str, algorithm: str) -> dict[str, Any]:
    fn = _DIGESTS.get(algorithm or "HMAC_SHA256_HEX")
    if fn is None or not digest:
        raise KycError("missing or unsupported Sumsub signature")
    expected = hmac.new(secret.encode(), payload, fn).hexdigest()
    if not hmac.compare_digest(expected, digest.strip().lower()):
        raise KycError("bad Sumsub signature")
    return json.loads(payload)
