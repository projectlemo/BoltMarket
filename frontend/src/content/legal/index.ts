/**
 * Legal documents. Templates use {{TOKENS}} filled from site config. Missing details are
 * rendered as bracketed fill-ins so a lawyer can see exactly what is outstanding.
 * Every document is a DRAFT FOR LEGAL REVIEW until VITE_LEGAL_REVIEWED=true.
 */
import { countryNamesFor } from './countries';
import { site } from '../../config/site';

export type LegalDoc = 'privacy' | 'risk' | 'terms' | 'client' | 'execution';
type Lang = 'en' | 'ar';

export const legalMeta: Record<LegalDoc, { path: string; title: { en: string; ar: string }; summary: { en: string; ar: string } }> = {
  privacy: {
    path: '/legal/privacy-policy',
    title: { en: 'Privacy Policy', ar: 'سياسة الخصوصية' },
    summary: { en: 'How we collect, use, store and protect your personal data.', ar: 'كيف نجمع بياناتك الشخصية ونستخدمها ونخزنها ونحميها.' },
  },
  risk: {
    path: '/legal/risk-disclaimer',
    title: { en: 'Risk Disclaimer', ar: 'إخلاء المسؤولية عن المخاطر' },
    summary: { en: 'The risks of trading leveraged products such as CFDs and forex.', ar: 'مخاطر تداول المنتجات ذات الرافعة المالية مثل عقود الفروقات والفوركس.' },
  },
  terms: {
    path: '/legal/terms-and-conditions',
    title: { en: 'Terms & Conditions', ar: 'الشروط والأحكام' },
    summary: { en: 'The terms for using this website and our online services.', ar: 'شروط استخدام هذا الموقع وخدماتنا الإلكترونية.' },
  },
  client: {
    path: '/legal/client-agreement',
    title: { en: 'Client Agreement', ar: 'اتفاقية العميل' },
    summary: { en: 'The agreement that governs your trading accounts with us.', ar: 'الاتفاقية التي تحكم حسابات التداول الخاصة بك لدينا.' },
  },
  execution: {
    path: '/legal/order-execution-policy',
    title: { en: 'Order Execution Policy', ar: 'سياسة تنفيذ الأوامر' },
    summary: { en: 'How we execute your orders and the factors we consider.', ar: 'كيف ننفّذ أوامرك والعوامل التي نأخذها في الاعتبار.' },
  },
};

const loaders: Record<LegalDoc, Record<Lang, () => Promise<{ default: string }>>> = {
  privacy: { en: () => import('./privacy.en.md?raw'), ar: () => import('./privacy.ar.md?raw') },
  risk: { en: () => import('./risk.en.md?raw'), ar: () => import('./risk.ar.md?raw') },
  terms: { en: () => import('./terms.en.md?raw'), ar: () => import('./terms.ar.md?raw') },
  client: { en: () => import('./client.en.md?raw'), ar: () => import('./client.ar.md?raw') },
  execution: { en: () => import('./execution.en.md?raw'), ar: () => import('./execution.ar.md?raw') },
};

const fill = {
  en: {
    COMPANY: '[Company legal name]',
    REG_NO: '[company registration number]',
    ADDRESS: '[registered office address]',
    JURISDICTION: '[jurisdiction of incorporation]',
    GOVERNING_LAW: '[governing law]',
    REGULATION: '[regulatory status: regulator and licence number, or a statement that the Company is not regulated]',
    RESTRICTED: '[list of restricted countries]',
    CONTACT: 'the contact form on our website',
    EFFECTIVE: '[effective date]',
  },
  ar: {
    COMPANY: '[الاسم القانوني للشركة]',
    REG_NO: '[رقم تسجيل الشركة]',
    ADDRESS: '[عنوان المكتب المسجل]',
    JURISDICTION: '[دولة التأسيس]',
    GOVERNING_LAW: '[القانون الحاكم]',
    REGULATION: '[الوضع التنظيمي: الجهة الرقابية ورقم الترخيص، أو بيان بأن الشركة غير خاضعة للتنظيم]',
    RESTRICTED: '[قائمة الدول المحظورة]',
    CONTACT: 'نموذج التواصل على موقعنا',
    EFFECTIVE: '[تاريخ السريان]',
  },
};

export function legalTokens(lang: Lang): Record<string, string> {
  const c = site.company;
  const f = fill[lang];
  const regulation =
    c.regulatoryStatus === 'regulated' && c.regulator && c.licenseNumber
      ? lang === 'en'
        ? `The Company is authorised and regulated by ${c.regulator} under licence number ${c.licenseNumber}.`
        : `الشركة مرخّصة وخاضعة لرقابة ${c.regulator} بموجب الترخيص رقم ${c.licenseNumber}.`
      : c.regulatoryStatus === 'unregulated' && c.jurisdiction
        ? lang === 'en'
          ? `The Company is not authorised or regulated by any financial services regulator. Clients do not benefit from the protections that regulated status may provide, such as compensation schemes.`
          : `الشركة غير مرخّصة ولا تخضع لرقابة أي جهة تنظيمية للخدمات المالية، ولا يستفيد العملاء من أوجه الحماية التي قد يوفرها الترخيص، مثل برامج التعويض.`
        : f.REGULATION;
  return {
    BRAND: site.brand,
    COMPANY: c.legalName || f.COMPANY,
    REG_NO: c.registrationNumber || f.REG_NO,
    ADDRESS: c.address || f.ADDRESS,
    JURISDICTION: c.jurisdiction || f.JURISDICTION,
    GOVERNING_LAW: c.governingLaw || f.GOVERNING_LAW,
    REGULATION: regulation,
    RESTRICTED: site.restrictedCountries.length ? countryNamesFor(site.restrictedCountries, lang).join(lang === 'ar' ? '، ' : ', ') : f.RESTRICTED,
    CONTACT: site.support.email || f.CONTACT,
    EFFECTIVE: (import.meta.env.VITE_LEGAL_EFFECTIVE_DATE as string | undefined)?.trim() || f.EFFECTIVE,
  };
}

export function applyTokens(md: string, tokens: Record<string, string>) {
  return md.replace(/\{\{([A-Z_]+)\}\}/g, (all, k: string) => tokens[k] ?? all);
}

export interface LegalData {
  doc: LegalDoc;
  markdown: string;
}

export async function loadLegal(doc: string, lang: Lang): Promise<LegalData | null> {
  const d = doc as LegalDoc;
  if (!loaders[d]) return null;
  const raw = (await loaders[d][lang]()).default;
  return { doc: d, markdown: applyTokens(raw, legalTokens(lang)) };
}
