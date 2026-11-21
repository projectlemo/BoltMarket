/** Small, dependency-free validators shared by forms (mirrors backend rules). */
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) && v.trim().length <= 254;

export interface PasswordCheck {
  length: boolean;
  letter: boolean;
  number: boolean;
  notCommon: boolean;
}

const COMMON = new Set(['password', 'password1', '12345678', '123456789', 'qwerty123', '11111111', 'abc12345', 'iloveyou1', 'bolt1234', 'trading1']);

/** At least 10 characters, a letter and a number, not on the common-password list. */
export function checkPassword(v: string): PasswordCheck {
  return {
    length: v.length >= 10,
    letter: /[A-Za-z؀-ۿ]/.test(v),
    number: /\d/.test(v),
    notCommon: !COMMON.has(v.toLowerCase()),
  };
}

export const passwordOk = (v: string) => Object.values(checkPassword(v)).every(Boolean);

export function parseAmount(v: string): number | null {
  const n = Number(v.replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
