import type { KycStatus } from '../../lib/auth';
import type { AccountStatus, ChallengeStatus, TxStatus, TxType } from '../../lib/portal-api';

type LS = { en: string; ar: string };
type Tone = 'neutral' | 'bolt' | 'up' | 'down' | 'info' | 'warn';

export const kycLabel: Record<KycStatus, { label: LS; tone: Tone }> = {
  none: { label: { en: 'Not started', ar: 'لم يبدأ' }, tone: 'neutral' },
  draft: { label: { en: 'In progress', ar: 'قيد الإعداد' }, tone: 'info' },
  pending: { label: { en: 'Under review', ar: 'قيد المراجعة' }, tone: 'warn' },
  approved: { label: { en: 'Verified', ar: 'موثّق' }, tone: 'up' },
  rejected: { label: { en: 'Action needed', ar: 'مطلوب إجراء' }, tone: 'down' },
};

export const accountStatusLabel: Record<AccountStatus, { label: LS; tone: Tone }> = {
  pending: { label: { en: 'Being set up', ar: 'قيد الإعداد' }, tone: 'warn' },
  active: { label: { en: 'Active', ar: 'نشط' }, tone: 'up' },
  disabled: { label: { en: 'Disabled', ar: 'معطّل' }, tone: 'neutral' },
  failed: { label: { en: 'Failed', ar: 'تعذّر الإنشاء' }, tone: 'down' },
};

export const txTypeLabel: Record<TxType, LS> = {
  deposit: { en: 'Deposit', ar: 'إيداع' },
  withdrawal: { en: 'Withdrawal', ar: 'سحب' },
  ib_commission: { en: 'Partner commission', ar: 'عمولة شريك' },
  adjustment: { en: 'Adjustment', ar: 'تسوية' },
  funded_fee: { en: 'Funded evaluation fee', ar: 'رسوم تقييم التمويل' },
};

export const txStatusLabel: Record<TxStatus, { label: LS; tone: Tone }> = {
  pending: { label: { en: 'Pending review', ar: 'بانتظار المراجعة' }, tone: 'warn' },
  awaiting_payment: { label: { en: 'Awaiting payment', ar: 'بانتظار الدفع' }, tone: 'info' },
  processing: { label: { en: 'Processing', ar: 'قيد المعالجة' }, tone: 'info' },
  completed: { label: { en: 'Completed', ar: 'مكتملة' }, tone: 'up' },
  rejected: { label: { en: 'Rejected', ar: 'مرفوضة' }, tone: 'down' },
  failed: { label: { en: 'Failed', ar: 'فشلت' }, tone: 'down' },
  cancelled: { label: { en: 'Cancelled', ar: 'ملغاة' }, tone: 'neutral' },
};

export const challengeLabel: Record<ChallengeStatus, { label: LS; tone: Tone }> = {
  awaiting_payment: { label: { en: 'Awaiting payment', ar: 'بانتظار الدفع' }, tone: 'info' },
  pending_activation: { label: { en: 'Activating', ar: 'قيد التفعيل' }, tone: 'warn' },
  phase1: { label: { en: 'Phase 1', ar: 'المرحلة 1' }, tone: 'bolt' },
  phase2: { label: { en: 'Phase 2', ar: 'المرحلة 2' }, tone: 'bolt' },
  funded: { label: { en: 'Funded', ar: 'ممول' }, tone: 'up' },
  failed: { label: { en: 'Ended', ar: 'منتهٍ' }, tone: 'down' },
  cancelled: { label: { en: 'Cancelled', ar: 'ملغى' }, tone: 'neutral' },
};

export const methodLabel: Record<string, LS> = {
  card: { en: 'Card', ar: 'بطاقة' },
  crypto: { en: 'Crypto', ar: 'عملات رقمية' },
  manual: { en: 'Manual', ar: 'يدوي' },
  internal: { en: 'Internal', ar: 'داخلي' },
};

export const accountTypeName: Record<string, LS> = {
  standard: { en: 'Standard', ar: 'ستاندرد' },
  pro: { en: 'Pro', ar: 'برو' },
  institutional: { en: 'Institutional', ar: 'المؤسسات' },
  funded: { en: 'Bolt Funded', ar: 'Bolt الممول' },
};

export const ticketCategories: { id: string; label: LS }[] = [
  { id: 'account', label: { en: 'Account & verification', ar: 'الحساب والتحقق' } },
  { id: 'payments', label: { en: 'Deposits & withdrawals', ar: 'الإيداع والسحب' } },
  { id: 'platform', label: { en: 'MetaTrader 5 & trading', ar: 'ميتاتريدر 5 والتداول' } },
  { id: 'funded', label: { en: 'Bolt Funded', ar: 'برنامج التمويل' } },
  { id: 'other', label: { en: 'Other', ar: 'أخرى' } },
];

export const ticketStatusLabel: Record<'open' | 'answered' | 'closed', { label: LS; tone: Tone }> = {
  open: { label: { en: 'Open', ar: 'مفتوحة' }, tone: 'warn' },
  answered: { label: { en: 'Answered', ar: 'تم الرد' }, tone: 'info' },
  closed: { label: { en: 'Closed', ar: 'مغلقة' }, tone: 'neutral' },
};
