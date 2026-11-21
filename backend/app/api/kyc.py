"""Identity verification (KYC): document upload for manual review, or Sumsub."""
from __future__ import annotations

import hashlib
from typing import Any

from ..db import utcnow
from ..schemas import KycDocumentOut, KycStateOut, SumsubTokenOut
from ..serializers import kyc_doc_out
from ..services import emails
from ..services.container import audit
from ..services.kyc import ALLOWED_TYPES, DOC_TYPES, REQUIRED_DOCS, KycError, delete_document_file, sniff_type, store_document, sumsub_access_token
from ..web import Api, ApiError, Ctx, Uploaded, rate_limit

api = Api("/api/v1", tags=("verification",))
LOCKED = ("pending", "approved")


def kyc_state(ctx: Ctx, user: dict[str, Any]) -> dict[str, Any]:
    with ctx.db.tx() as c:
        docs = c.all("SELECT id, user_id, doc_type, filename, status, rejection_reason, created_at FROM kyc_documents WHERE user_id = :u ORDER BY id", u=user["id"])
    return {
        "status": user["kyc_status"],
        "provider": ctx.settings.effective_kyc_provider,
        "rejection_reason": user["kyc_rejection_reason"],
        "required": list(REQUIRED_DOCS),
        "documents": [kyc_doc_out(d) for d in docs],
    }


def locked_error() -> ApiError:
    return ApiError(409, "KYC_LOCKED", "Your documents are under review or already approved.", "مستنداتك قيد المراجعة أو معتمدة بالفعل.")


@api.get("/kyc", response=KycStateOut, summary="Verification status and documents")
def get_kyc(ctx: Ctx) -> dict[str, Any]:
    return kyc_state(ctx, ctx.me)


@api.post("/kyc/documents", form=True, response=KycDocumentOut, status=201, summary="Upload a verification document", max_body=11 * 1024 * 1024)
def upload_document(ctx: Ctx) -> dict[str, Any]:
    s = ctx.settings
    rate_limit(ctx, "kyc-upload", 30, 3600, key=str(ctx.me["id"]))
    if ctx.me["kyc_status"] in LOCKED:
        raise locked_error()
    doc_type = str(ctx.form.get("doc_type", ""))
    upload = ctx.form.get("file")
    if doc_type not in DOC_TYPES:
        raise ApiError(422, "VALIDATION_ERROR", "Please check the highlighted fields.", "يرجى مراجعة الحقول المحددة.",
                       {"doc_type": ("Choose a document type.", "اختر نوع المستند.")})
    if not isinstance(upload, Uploaded) or not upload.data:
        raise ApiError(422, "VALIDATION_ERROR", "Please check the highlighted fields.", "يرجى مراجعة الحقول المحددة.",
                       {"file": ("Choose a file to upload.", "اختر ملفًا لرفعه.")})
    if len(upload.data) > s.max_upload_mb * 1024 * 1024:
        raise ApiError(413, "FILE_TOO_LARGE", f"Files must be {s.max_upload_mb} MB or smaller.", f"يجب ألا يتجاوز حجم الملف {s.max_upload_mb} ميغابايت.",
                       {"file": (f"Files must be {s.max_upload_mb} MB or smaller.", f"يجب ألا يتجاوز حجم الملف {s.max_upload_mb} ميغابايت.")})
    content_type = sniff_type(upload.data)
    if content_type not in ALLOWED_TYPES:
        raise ApiError(415, "UNSUPPORTED_FILE", "Upload a JPG, PNG, WEBP or PDF file.", "ارفع ملفًا بصيغة JPG أو PNG أو WEBP أو PDF.",
                       {"file": ("Upload a JPG, PNG, WEBP or PDF file.", "ارفع ملفًا بصيغة JPG أو PNG أو WEBP أو PDF.")})
    digest = hashlib.sha256(upload.data).hexdigest()
    stored = store_document(s, ctx.services.vault, ctx.me["id"], digest, upload.data)
    name = "".join(ch for ch in upload.filename if ch.isalnum() or ch in "._- ").strip()[:120] or f"{doc_type}{ALLOWED_TYPES[content_type]}"
    with ctx.db.tx() as c:
        user = c.get("users", ctx.me["id"], lock=True)
        assert user is not None
        if user["kyc_status"] in LOCKED:
            raise locked_error()
        for old in c.all("SELECT id, storage, path FROM kyc_documents WHERE user_id = :u AND doc_type = :t", u=user["id"], t=doc_type):
            delete_document_file(old)
            c.exec("DELETE FROM kyc_documents WHERE id = :id", id=old["id"])
        doc = c.insert("kyc_documents", {
            "user_id": user["id"], "doc_type": doc_type, "filename": name, "content_type": content_type, "size_bytes": len(upload.data),
            "sha256": digest, **stored, "status": "uploaded", "created_at": utcnow(),
        })
        if user["kyc_status"] in ("none", "rejected"):
            c.update("users", user["id"], {"kyc_status": "draft", "updated_at": utcnow()})
        audit(c, user["id"], "kyc.document_uploaded", "kyc_document", doc["id"], {"doc_type": doc_type, "size": len(upload.data)}, ctx.ip)
    return kyc_doc_out(doc)


@api.delete("/kyc/documents/{id:int}", summary="Remove an uploaded document")
def delete_document(ctx: Ctx) -> None:
    doc_id = ctx.path_int("id")
    with ctx.db.tx() as c:
        user = c.get("users", ctx.me["id"], lock=True)
        assert user is not None
        doc = c.one("SELECT id, storage, path FROM kyc_documents WHERE id = :id AND user_id = :u", id=doc_id, u=user["id"])
        if doc is None:
            raise ApiError(404, "NOT_FOUND", "Document not found.", "المستند غير موجود.")
        if user["kyc_status"] in LOCKED:
            raise locked_error()
        delete_document_file(doc)
        c.exec("DELETE FROM kyc_documents WHERE id = :id", id=doc_id)
        audit(c, user["id"], "kyc.document_deleted", "kyc_document", doc_id, None, ctx.ip)


@api.post("/kyc/submit", response=KycStateOut, summary="Send documents for review")
def submit(ctx: Ctx) -> dict[str, Any]:
    with ctx.db.tx() as c:
        user = c.get("users", ctx.me["id"], lock=True)
        assert user is not None
        if user["kyc_status"] in LOCKED:
            raise locked_error()
        have = {r["doc_type"] for r in c.all("SELECT doc_type FROM kyc_documents WHERE user_id = :u", u=user["id"])}
        missing = [d for d in REQUIRED_DOCS if d not in have]
        if missing:
            raise ApiError(422, "DOCUMENTS_MISSING", "Upload all required documents first.", "ارفع جميع المستندات المطلوبة أولًا.",
                           {d: ("This document is required.", "هذا المستند مطلوب.") for d in missing})
        now = utcnow()
        user = c.update("users", user["id"], {"kyc_status": "pending", "kyc_submitted_at": now, "kyc_rejection_reason": None, "updated_at": now})
        assert user is not None
        c.exec("UPDATE kyc_documents SET status = 'uploaded', rejection_reason = NULL WHERE user_id = :u AND status = 'rejected'", u=user["id"])
        ctx.services.notify_staff(c, emails.staff_notice("Verification ready for review", [f"{user['full_name']} ({user['email']}) submitted documents."],
                                                         ctx.services.admin_link(f"/kyc/{user['id']}")))
        audit(c, user["id"], "kyc.submitted", "user", user["id"], None, ctx.ip)
    return kyc_state(ctx, user)


@api.post("/kyc/sumsub/token", response=SumsubTokenOut, summary="Access token for the Sumsub verification widget")
def sumsub_token(ctx: Ctx) -> dict[str, Any]:
    if ctx.settings.effective_kyc_provider != "sumsub":
        raise ApiError(409, "PROVIDER_DISABLED", "Online verification is not enabled.", "التحقق الإلكتروني غير مفعّل.")
    if ctx.me["kyc_status"] == "approved":
        raise locked_error()
    rate_limit(ctx, "sumsub-token", 30, 3600, key=str(ctx.me["id"]))
    try:
        token = sumsub_access_token(ctx.settings, ctx.services.http, ctx.me["id"])
    except KycError as exc:
        raise ApiError(502, "KYC_PROVIDER_ERROR", "The verification service is not responding. Please try again shortly.",
                       "خدمة التحقق لا تستجيب. يرجى المحاولة بعد قليل.") from exc
    if ctx.me["kyc_status"] in ("none", "rejected"):
        with ctx.db.tx() as c:
            c.update("users", ctx.me["id"], {"kyc_status": "draft", "updated_at": utcnow()})
    return {"token": token}
