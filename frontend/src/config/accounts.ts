/**
 * Trading account specifications as supplied by the business owner.
 * Change values here; every page, the comparison tool and the portal read from this file.
 */
export type AccountTypeId = 'standard' | 'pro' | 'institutional';

export interface AccountType {
  id: AccountTypeId;
  minDeposit: number;
  /** Minimum spread in pips on major FX pairs. */
  spreadFrom: number;
  /** Commission in USD per standard lot, per side (0 = commission-free). */
  commissionPerLot: number;
  maxLeverage: number;
  raw: boolean;
  featured?: boolean;
}

export const accountTypes: AccountType[] = [
  { id: 'standard', minDeposit: 10, spreadFrom: 1.5, commissionPerLot: 0, maxLeverage: 500, raw: false },
  { id: 'pro', minDeposit: 1000, spreadFrom: 1.0, commissionPerLot: 0, maxLeverage: 500, raw: false, featured: true },
  { id: 'institutional', minDeposit: 100_000, spreadFrom: 0.0, commissionPerLot: 3, maxLeverage: 500, raw: true },
];

/**
 * The commission was specified as "$3/lot". The cost estimator treats it as charged
 * per side (open and close), i.e. $6 per round-turn lot. Set to 1 if your $3 is round-turn.
 */
export const COMMISSION_SIDES_PER_TRADE = 2;

export const leverageOptions = [50, 100, 200, 300, 400, 500];

export const PLATFORM_NAME = 'MetaTrader 5';

export const accountById = (id: string) => accountTypes.find((a) => a.id === id);

export const accountCopy: Record<AccountTypeId, { name: { en: string; ar: string }; tagline: { en: string; ar: string }; bestFor: { en: string; ar: string } }> = {
  standard: {
    name: { en: 'Standard', ar: 'ستاندرد' },
    tagline: { en: 'Start small, trade commission-free', ar: 'ابدأ بمبلغ صغير وتداول دون عمولة' },
    bestFor: { en: 'New traders and smaller balances', ar: 'المتداولون الجدد وأصحاب الأرصدة الصغيرة' },
  },
  pro: {
    name: { en: 'Pro', ar: 'برو' },
    tagline: { en: 'Tighter spreads for active traders', ar: 'سبريد أضيق للمتداولين النشطين' },
    bestFor: { en: 'Experienced, frequent traders', ar: 'المتداولون ذوو الخبرة والتداول المتكرر' },
  },
  institutional: {
    name: { en: 'Institutional', ar: 'المؤسسات' },
    tagline: { en: 'Raw spreads plus a fixed commission', ar: 'سبريد خام مع عمولة ثابتة' },
    bestFor: { en: 'High-volume and professional traders', ar: 'المتداولون المحترفون وأصحاب الأحجام الكبيرة' },
  },
};
