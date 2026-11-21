/** Referral attribution: a ?ref=CODE on any page is remembered for 60 days. */
export const REF_KEY = 'bolt.ref';
const TTL = 1000 * 60 * 60 * 24 * 60;

export function captureReferral(search: string) {
  const code = new URLSearchParams(search).get('ref');
  if (!code || !/^[A-Za-z0-9]{4,16}$/.test(code)) return;
  try {
    localStorage.setItem(REF_KEY, JSON.stringify({ code: code.toUpperCase(), at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export function storedReferral(): string {
  try {
    const raw = localStorage.getItem(REF_KEY);
    if (!raw) return '';
    const { code, at } = JSON.parse(raw) as { code: string; at: number };
    return Date.now() - at < TTL ? code : '';
  } catch {
    return '';
  }
}
