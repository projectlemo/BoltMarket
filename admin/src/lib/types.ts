// Shapes returned by /api/v1/admin/* (see backend/app/api/admin.py)
export type Role = 'client' | 'support' | 'compliance' | 'finance' | 'admin';
export type KycStatus = 'none' | 'draft' | 'pending' | 'approved' | 'rejected';
export type Permission = 'users.read' | 'users.write' | 'users.role' | 'kyc' | 'finance' | 'support' | 'content' | 'audit' | 'system';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Me {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  totp_enabled: boolean;
  permissions: Permission[];
  language: 'en' | 'ar';
}

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  country: string;
  language: 'en' | 'ar';
  role: Role;
  status: 'active' | 'suspended';
  email_verified: boolean;
  totp_enabled: boolean;
  kyc_status: KycStatus;
  kyc_rejection_reason: string | null;
  kyc_submitted_at: string | null;
  kyc_reviewed_at: string | null;
  referral_code: string;
  referred_by: number | null;
  last_login_at: string | null;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminAccount {
  id: number;
  user_id: number;
  user_email: string | null;
  user_name: string | null;
  kind: 'live' | 'demo';
  account_type: 'standard' | 'pro' | 'institutional' | 'funded';
  login: string | null;
  server: string | null;
  group_name: string | null;
  leverage: number;
  currency: string;
  status: 'pending' | 'active' | 'disabled' | 'failed';
  balance: number | null;
  equity: number | null;
  margin_free: number | null;
  last_error: string | null;
  synced_at: string | null;
  created_at: string;
}

export type TxType = 'deposit' | 'withdrawal' | 'ib_commission' | 'adjustment' | 'funded_fee';
export type TxStatus = 'pending' | 'awaiting_payment' | 'processing' | 'completed' | 'rejected' | 'failed' | 'cancelled';

export interface AdminTx {
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
  admin_note: string | null;
  user_id: number;
  user_email: string | null;
  user_name: string | null;
  provider: string | null;
  provider_ref: string | null;
  destination: Record<string, string> | null;
  mt5_ticket: string | null;
  challenge_id: number | null;
  processed_by: number | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KycDoc {
  id: number;
  doc_type: 'id_front' | 'id_back' | 'proof_of_address' | 'selfie';
  filename: string;
  content_type: string;
  size_bytes: number;
  status: 'uploaded' | 'accepted' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
}

export interface KycQueueItem {
  id: number;
  email: string;
  full_name: string;
  country: string;
  kyc_status: KycStatus;
  kyc_submitted_at: string | null;
  kyc_reviewed_at: string | null;
  created_at: string;
  documents: number;
}

export interface Ticket {
  id: number;
  subject: string;
  category: string;
  status: 'open' | 'answered' | 'closed';
  created_at: string;
  updated_at: string;
  user_id: number;
  user_email: string;
  user_name: string;
  user_language?: 'en' | 'ar';
}

export interface TicketMessage {
  id: number;
  body: string;
  is_staff: boolean;
  author_name: string;
  created_at: string;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  topic: string;
  subject: string;
  message: string;
  language: 'en' | 'ar';
  status: 'new' | 'handled';
  handled_at: string | null;
  created_at: string;
}

export interface Challenge {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string;
  plan_size: number;
  fee: number;
  status: 'awaiting_payment' | 'pending_activation' | 'phase1' | 'phase2' | 'funded' | 'failed' | 'cancelled';
  account_id: number | null;
  login: string | null;
  equity: number | null;
  note: string | null;
  breach: string | null;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: number;
  slug: string;
  language: 'en' | 'ar';
  category: 'learn' | 'insights';
  title: string;
  excerpt: string;
  body_md?: string;
  status: 'draft' | 'published';
  published_at: string | null;
  reading_minutes: number;
  author_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: number;
  actor_id: number | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  data: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export interface Overview {
  clients: number;
  new_clients_7d: number;
  kyc_pending: number;
  withdrawals_pending: number;
  withdrawals_pending_amount: number;
  withdrawals_to_pay: number;
  deposits_to_review: number;
  deposits_24h_amount: number;
  deposits_7d_amount: number;
  accounts_pending: number;
  tickets_open: number;
  messages_new: number;
  challenges_to_activate: number;
  challenges_flagged: number;
  signups_14d: { date: string; count: number }[];
}

export interface ClientFile {
  user: AdminUser;
  accounts: AdminAccount[];
  transactions: AdminTx[];
  documents: KycDoc[];
  notes: { id: number; body: string; author_name: string | null; created_at: string }[];
  tickets: Omit<Ticket, 'user_id' | 'user_email' | 'user_name'>[];
  challenges: { id: number; plan_size: number; status: Challenge['status']; created_at: string }[];
  referrer: { id: number; full_name: string; email: string } | null;
  referrals: number;
}

export interface SystemStatus {
  version: string;
  environment: string;
  database: string;
  migrations: string[];
  registration_open: boolean;
  restricted_countries: string[];
  mt5: { mode: string; enabled: boolean; server_live: string | null; server_demo: string | null };
  quotes: { mode: string; symbols: number; live_symbols: number; clients: number; last_update: string | null };
  payments: { card_stripe: boolean; crypto_nowpayments: boolean; nowpayments_sandbox: boolean };
  kyc: { provider: string; storage: string; require_for_deposit: boolean };
  email: { smtp: boolean; support_inbox: boolean; outbox: Record<string, number> };
  security: { admin_require_2fa: boolean; api_docs: boolean; data_key_set: boolean };
  site_rebuild: boolean;
}
