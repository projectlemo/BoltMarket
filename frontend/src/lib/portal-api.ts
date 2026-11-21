/** Typed client for the portal endpoints of the Bolt Markets API (see backend/app/api). */
import { api } from './api';
import type { User } from './auth';

export type AccountKind = 'live' | 'demo';
export type AccountStatus = 'pending' | 'active' | 'disabled' | 'failed';

export interface TradingAccount {
  id: number;
  kind: AccountKind;
  account_type: 'standard' | 'pro' | 'institutional' | 'funded';
  login: string | null;
  server: string | null;
  leverage: number;
  currency: string;
  status: AccountStatus;
  balance: number | null;
  equity: number | null;
  margin_free: number | null;
  synced_at: string | null;
  created_at: string;
}

export type TxType = 'deposit' | 'withdrawal' | 'ib_commission' | 'adjustment' | 'funded_fee';
export type TxStatus = 'pending' | 'awaiting_payment' | 'processing' | 'completed' | 'rejected' | 'failed' | 'cancelled';

export interface Transaction {
  id: number;
  type: TxType;
  method: string;
  amount: number;
  currency: string;
  status: TxStatus;
  account_id: number | null;
  account_login: string | null;
  reference: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface PaymentMethod {
  id: 'card' | 'crypto';
  provider: string;
  min_amount: number;
  currency: string;
}

export interface PublicConfig {
  registration_open: boolean;
  mt5_enabled: boolean;
  mt5_server_live: string | null;
  mt5_server_demo: string | null;
  kyc_provider: 'manual' | 'sumsub';
  require_kyc_for_deposit: boolean;
  deposit_methods: PaymentMethod[];
  withdrawal_methods: PaymentMethod[];
  leverage_options: number[];
  account_currencies: string[];
  demo_balance: number;
  restricted_countries: string[];
}

export type KycDocType = 'id_front' | 'id_back' | 'proof_of_address' | 'selfie';

export interface KycDocument {
  id: number;
  doc_type: KycDocType;
  filename: string;
  status: 'uploaded' | 'accepted' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
}

export interface KycState {
  status: User['kyc_status'];
  provider: 'manual' | 'sumsub';
  rejection_reason: string | null;
  required: KycDocType[];
  documents: KycDocument[];
}

export interface Ticket {
  id: number;
  subject: string;
  category: string;
  status: 'open' | 'answered' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: number;
  body: string;
  is_staff: boolean;
  author_name: string;
  created_at: string;
}

export interface IbOverview {
  referral_code: string;
  stats: { registered: number; verified: number; funded: number };
  commissions_total: number;
  referrals: { id: number; name: string; country: string; joined_at: string; status: 'registered' | 'verified' | 'funded' }[];
}

export type ChallengeStatus = 'awaiting_payment' | 'pending_activation' | 'phase1' | 'phase2' | 'funded' | 'failed' | 'cancelled';

export interface Challenge {
  id: number;
  plan_size: number;
  fee: number;
  status: ChallengeStatus;
  account: TradingAccount | null;
  created_at: string;
}

export const portal = {
  config: () => api<PublicConfig>('/public/config', { auth: false }),

  accounts: () => api<{ items: TradingAccount[] }>('/accounts'),
  openAccount: (body: { kind: AccountKind; account_type: string; leverage: number; currency: string }) =>
    api<{ account: TradingAccount; password: string | null; investor_password: string | null }>('/accounts', { body }),
  resetTradingPassword: (id: number) => api<{ password: string }>(`/accounts/${id}/reset-password`, { method: 'POST' }),
  syncAccount: (id: number) => api<TradingAccount>(`/accounts/${id}/sync`, { method: 'POST' }),

  deposit: (body: { account_id: number; amount: number; method: string }) => api<{ transaction: Transaction; redirect_url: string | null }>('/deposits', { body }),
  withdraw: (body: { account_id: number; amount: number; method: string; destination: Record<string, string> }) => api<Transaction>('/withdrawals', { body }),
  cancelWithdrawal: (id: number) => api<Transaction>(`/withdrawals/${id}/cancel`, { method: 'POST' }),
  transactions: (q: { type?: string; status?: string; page?: number; page_size?: number }) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)));
    return api<Paged<Transaction>>(`/transactions?${p.toString()}`);
  },
  transaction: (id: number) => api<Transaction>(`/transactions/${id}`),

  kyc: () => api<KycState>('/kyc'),
  uploadKyc: (docType: KycDocType, file: File) => {
    const form = new FormData();
    form.append('doc_type', docType);
    form.append('file', file);
    return api<KycDocument>('/kyc/documents', { form });
  },
  deleteKycDocument: (id: number) => api<void>(`/kyc/documents/${id}`, { method: 'DELETE' }),
  submitKyc: () => api<KycState>('/kyc/submit', { method: 'POST' }),
  sumsubToken: () => api<{ token: string }>('/kyc/sumsub/token', { method: 'POST' }),

  ib: () => api<IbOverview>('/ib'),

  tickets: () => api<{ items: Ticket[] }>('/tickets'),
  createTicket: (body: { subject: string; category: string; message: string }) => api<Ticket>('/tickets', { body }),
  ticket: (id: number) => api<{ ticket: Ticket; messages: TicketMessage[] }>(`/tickets/${id}`),
  replyTicket: (id: number, body: string) => api<TicketMessage>(`/tickets/${id}/messages`, { body: { body } }),
  closeTicket: (id: number) => api<Ticket>(`/tickets/${id}/close`, { method: 'POST' }),

  updateProfile: (body: Partial<Pick<User, 'full_name' | 'phone' | 'language'>>) => api<User>('/me', { method: 'PATCH', body }),
  changePassword: (body: { current_password: string; new_password: string }) => api<void>('/me/password', { body }),
  setup2fa: () => api<{ secret: string; otpauth_url: string }>('/me/2fa/setup', { method: 'POST' }),
  enable2fa: (code: string) => api<{ recovery_codes: string[] }>('/me/2fa/enable', { body: { code } }),
  disable2fa: (body: { password: string; code: string }) => api<void>('/me/2fa/disable', { body }),

  challenges: () => api<{ items: Challenge[] }>('/funded/challenges'),
  buyChallenge: (body: { plan_size: number; method: string }) => api<{ challenge: Challenge; redirect_url: string | null }>('/funded/challenges', { body }),
};
