"""Transactional email templates in English and Arabic (plain text + simple HTML)."""
from __future__ import annotations

import html
from dataclasses import dataclass


@dataclass
class Email:
    subject: str
    text: str
    html: str


_FOOTER = {
    "en": "Trading leveraged products such as CFDs carries a high risk of losing money. Only trade with money you can afford to lose.",
    "ar": "ينطوي تداول المنتجات ذات الرافعة المالية مثل عقود الفروقات على مخاطر عالية لخسارة الأموال. لا تتداول إلا بأموال يمكنك تحمّل خسارتها.",
}
_AUTOMATED = {
    "en": "This is an automated message from Bolt Markets. Please do not reply to this email.",
    "ar": "هذه رسالة تلقائية من Bolt Markets. يرجى عدم الرد على هذا البريد.",
}


def _wrap(lang: str, title: str, paragraphs: list[str], button: tuple[str, str] | None = None) -> str:
    direction = "rtl" if lang == "ar" else "ltr"
    align = "right" if lang == "ar" else "left"
    body = "".join(
        f'<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d4d4d4">{html.escape(p)}</p>' for p in paragraphs
    )
    if button:
        label, url = button
        body += (
            f'<p style="margin:24px 0"><a href="{html.escape(url, quote=True)}" '
            'style="display:inline-block;background:#FFD400;color:#0A0A0A;font-weight:700;text-decoration:none;'
            f'padding:12px 22px;border-radius:10px">{html.escape(label)}</a></p>'
            f'<p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#8a8a8a;word-break:break-all">{html.escape(url)}</p>'
        )
    return f"""<!doctype html>
<html lang="{lang}" dir="{direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{html.escape(title)}</title></head>
<body style="margin:0;background:#0A0A0A;font-family:Inter,Segoe UI,Tahoma,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141414;border:1px solid #262626;border-radius:16px">
<tr><td style="padding:24px 28px;border-bottom:1px solid #262626;text-align:{align}">
<span style="display:inline-block;background:#FFD400;color:#0A0A0A;font-weight:800;border-radius:8px;padding:4px 9px">&#9889;</span>
<span style="color:#ffffff;font-weight:800;font-size:18px;padding-inline-start:8px">Bolt Markets</span></td></tr>
<tr><td style="padding:28px;text-align:{align}" dir="{direction}">
<h1 style="margin:0 0 18px;font-size:20px;line-height:1.35;color:#ffffff">{html.escape(title)}</h1>{body}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #262626;text-align:{align}">
<p style="margin:0 0 8px;font-size:11px;line-height:1.5;color:#8a8a8a">{html.escape(_FOOTER[lang])}</p>
<p style="margin:0;font-size:11px;line-height:1.5;color:#8a8a8a">{html.escape(_AUTOMATED[lang])}</p></td></tr>
</table></td></tr></table></body></html>"""


def _text(title: str, paragraphs: list[str], lang: str, link: str | None = None) -> str:
    parts = [title, "", *paragraphs]
    if link:
        parts += ["", link]
    parts += ["", "—", _FOOTER[lang], _AUTOMATED[lang]]
    return "\n".join(parts)


def _make(lang: str, subject: str, title: str, paragraphs: list[str], button: tuple[str, str] | None = None) -> Email:
    return Email(subject, _text(title, paragraphs, lang, button[1] if button else None), _wrap(lang, title, paragraphs, button))


def first_name(full_name: str) -> str:
    return (full_name or "").strip().split(" ")[0] or full_name


def verify_email(lang: str, name: str, link: str) -> Email:
    if lang == "ar":
        return _make(lang, "أكّد بريدك الإلكتروني", f"مرحبًا {first_name(name)}، أكّد بريدك الإلكتروني",
                     ["شكرًا لتسجيلك في Bolt Markets. اضغط الزر أدناه لتأكيد بريدك الإلكتروني وتفعيل حسابك.", "تنتهي صلاحية هذا الرابط خلال 48 ساعة. إذا لم تطلب إنشاء حساب فتجاهل هذه الرسالة."],
                     ("تأكيد البريد الإلكتروني", link))
    return _make(lang, "Confirm your email address", f"Hi {first_name(name)}, confirm your email",
                 ["Thanks for signing up with Bolt Markets. Press the button below to confirm your email address and activate your account.",
                  "The link expires in 48 hours. If you did not create an account, you can ignore this message."],
                 ("Confirm email", link))


def reset_password(lang: str, name: str, link: str) -> Email:
    if lang == "ar":
        return _make(lang, "إعادة تعيين كلمة المرور", "إعادة تعيين كلمة المرور",
                     [f"مرحبًا {first_name(name)}، تلقّينا طلبًا لإعادة تعيين كلمة مرور حسابك.", "ينتهي هذا الرابط خلال ساعة واحدة. إذا لم تطلب ذلك فلا تفعل شيئًا وستبقى كلمة المرور كما هي."],
                     ("اختر كلمة مرور جديدة", link))
    return _make(lang, "Reset your password", "Reset your password",
                 [f"Hi {first_name(name)}, we received a request to reset the password for your account.",
                  "This link expires in one hour. If you did not ask for it, do nothing and your password stays the same."],
                 ("Choose a new password", link))


def password_changed(lang: str, name: str) -> Email:
    if lang == "ar":
        return _make(lang, "تم تغيير كلمة المرور", "تم تغيير كلمة المرور",
                     [f"مرحبًا {first_name(name)}، تم تغيير كلمة مرور حسابك في Bolt Markets وتسجيل الخروج من جميع الأجهزة.", "إذا لم تقم بذلك، تواصل مع الدعم فورًا."])
    return _make(lang, "Your password was changed", "Your password was changed",
                 [f"Hi {first_name(name)}, the password for your Bolt Markets account was changed and all devices were signed out.",
                  "If this was not you, contact support immediately."])


def account_ready(lang: str, name: str, kind: str, login: str, server: str, portal_link: str) -> Email:
    if lang == "ar":
        kind_ar = "الحقيقي" if kind == "live" else "التجريبي"
        return _make(lang, f"حسابك {kind_ar} على ميتاتريدر 5 جاهز", f"حسابك {kind_ar} جاهز",
                     [f"مرحبًا {first_name(name)}، أصبح حسابك على ميتاتريدر 5 جاهزًا.", f"رقم الحساب: {login}", f"الخادم: {server or '—'}",
                      "لأسباب أمنية لا نرسل كلمات المرور عبر البريد الإلكتروني. يمكنك تعيين كلمة مرور جديدة للتداول من صفحة الحسابات في البوابة."],
                     ("فتح البوابة", portal_link))
    label = "live" if kind == "live" else "demo"
    return _make(lang, f"Your MT5 {label} account is ready", f"Your {label} account is ready",
                 [f"Hi {first_name(name)}, your MetaTrader 5 account is ready.", f"Login: {login}", f"Server: {server or '—'}",
                  "For security we never send passwords by email. You can set a new trading password from the Accounts page of the portal."],
                 ("Open the portal", portal_link))


def deposit_completed(lang: str, name: str, amount: str, login: str) -> Email:
    if lang == "ar":
        return _make(lang, "تم إيداع أموالك", "تم إيداع أموالك",
                     [f"مرحبًا {first_name(name)}، أضفنا {amount} إلى حسابك على ميتاتريدر 5 رقم {login}."])
    return _make(lang, "Your deposit has been credited", "Deposit credited",
                 [f"Hi {first_name(name)}, we credited {amount} to your MT5 account {login}."])


def withdrawal_update(lang: str, name: str, amount: str, status: str, note: str | None) -> Email:
    labels = {
        "processing": ("approved and is being sent", "تمت الموافقة عليه وجارٍ إرساله"),
        "completed": ("completed", "اكتمل"),
        "rejected": ("rejected", "رُفض"),
        "failed": ("could not be completed", "تعذّر إتمامه"),
    }
    en, ar = labels.get(status, (status, status))
    extra_en = [f"Note from our team: {note}"] if note else []
    extra_ar = [f"ملاحظة من فريقنا: {note}"] if note else []
    if lang == "ar":
        return _make(lang, "تحديث بشأن طلب السحب", "تحديث بشأن طلب السحب", [f"مرحبًا {first_name(name)}، طلب سحب {amount} {ar}.", *extra_ar])
    return _make(lang, "Update on your withdrawal", "Withdrawal update", [f"Hi {first_name(name)}, your withdrawal of {amount} has been {en}.", *extra_en])


def kyc_result(lang: str, name: str, approved: bool, reason: str | None, link: str) -> Email:
    if lang == "ar":
        if approved:
            return _make(lang, "تم التحقق من هويتك", "تم التحقق من هويتك", [f"مرحبًا {first_name(name)}، اعتمدنا مستنداتك. أصبحت الإيداعات والسحوبات متاحة الآن."], ("فتح البوابة", link))
        return _make(lang, "نحتاج إلى مستندات إضافية", "لم نتمكن من اعتماد مستنداتك",
                     [f"مرحبًا {first_name(name)}، لم نتمكن من اعتماد مستندات التحقق.", f"السبب: {reason or '—'}", "يرجى رفع المستندات المطلوبة مجددًا من صفحة التحقق."], ("رفع المستندات", link))
    if approved:
        return _make(lang, "Your identity is verified", "You are verified", [f"Hi {first_name(name)}, we approved your documents. Deposits and withdrawals are now available."], ("Open the portal", link))
    return _make(lang, "We need more documents", "We could not approve your documents",
                 [f"Hi {first_name(name)}, we could not approve your verification documents.", f"Reason: {reason or '—'}", "Please upload the requested documents again from the Verification page."],
                 ("Upload documents", link))


def ticket_reply(lang: str, name: str, subject: str, link: str) -> Email:
    if lang == "ar":
        return _make(lang, f"رد جديد على تذكرتك: {subject}", "رد فريق الدعم على تذكرتك", [f"مرحبًا {first_name(name)}، أضاف فريق الدعم ردًا على تذكرتك «{subject}»."], ("عرض الرد", link))
    return _make(lang, f"New reply to your ticket: {subject}", "Support replied to your ticket", [f"Hi {first_name(name)}, our support team replied to your ticket “{subject}”."], ("View reply", link))


def challenge_update(lang: str, name: str, plan: str, status: str, link: str) -> Email:
    names = {
        "pending_activation": ("payment received, account being prepared", "تم استلام الدفع وجارٍ تجهيز الحساب"),
        "phase1": ("Phase 1 is active", "المرحلة الأولى نشطة"),
        "phase2": ("Phase 2 is active", "المرحلة الثانية نشطة"),
        "funded": ("funded account approved", "تمت الموافقة على الحساب الممول"),
        "failed": ("evaluation ended", "انتهى التقييم"),
        "cancelled": ("cancelled", "أُلغي"),
    }
    en, ar = names.get(status, (status, status))
    if lang == "ar":
        return _make(lang, f"تحديث تحدي Bolt Funded بقيمة {plan}", "تحديث بشأن التحدي", [f"مرحبًا {first_name(name)}، حالة تحدي {plan}: {ar}."], ("عرض التحدي", link))
    return _make(lang, f"Bolt Funded {plan} update", "Your challenge was updated", [f"Hi {first_name(name)}, your {plan} challenge: {en}."], ("View challenge", link))


def staff_notice(subject: str, lines: list[str], link: str | None = None) -> Email:
    return _make("en", subject, subject, lines, ("Open back office", link) if link else None)
