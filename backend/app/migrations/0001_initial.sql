-- Bolt Markets initial schema. Portable SQL: {{pk}}, {{json}} and {{blob}} are replaced per dialect.
-- Money is stored as integer cents of the account currency.

CREATE TABLE users (
  id {{pk}},
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  country TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  role TEXT NOT NULL DEFAULT 'client',
  status TEXT NOT NULL DEFAULT 'active',
  email_verified_at TIMESTAMPTZ,
  token_version INTEGER NOT NULL DEFAULT 0,
  totp_secret TEXT,
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  totp_last_step BIGINT,
  recovery_codes {{json}},
  kyc_status TEXT NOT NULL DEFAULT 'none',
  kyc_rejection_reason TEXT,
  kyc_applicant_id TEXT,
  kyc_submitted_at TIMESTAMPTZ,
  kyc_reviewed_at TIMESTAMPTZ,
  kyc_reviewed_by BIGINT,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_users_referred_by ON users (referred_by);
CREATE INDEX ix_users_kyc_status ON users (kyc_status);
CREATE INDEX ix_users_created ON users (created_at);

CREATE TABLE user_notes (
  id {{pk}},
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_user_notes_user ON user_notes (user_id, created_at);

CREATE TABLE refresh_tokens (
  id {{pk}},
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX ix_refresh_tokens_family ON refresh_tokens (family_id);

CREATE TABLE action_tokens (
  id {{pk}},
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_action_tokens_user ON action_tokens (user_id, purpose);

CREATE TABLE trading_accounts (
  id {{pk}},
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  account_type TEXT NOT NULL,
  login TEXT,
  server TEXT,
  group_name TEXT,
  leverage INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  balance_cents BIGINT,
  equity_cents BIGINT,
  margin_free_cents BIGINT,
  day_start_equity_cents BIGINT,
  day_start_date TEXT,
  synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_accounts_user ON trading_accounts (user_id);
CREATE INDEX ix_accounts_status ON trading_accounts (status);
CREATE UNIQUE INDEX ux_accounts_kind_login ON trading_accounts (kind, login);

CREATE TABLE challenges (
  id {{pk}},
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_size INTEGER NOT NULL,
  fee_cents BIGINT NOT NULL,
  status TEXT NOT NULL,
  account_id BIGINT REFERENCES trading_accounts(id) ON DELETE SET NULL,
  note TEXT,
  breach TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_challenges_user ON challenges (user_id);
CREATE INDEX ix_challenges_status ON challenges (status);

CREATE TABLE transactions (
  id {{pk}},
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id BIGINT REFERENCES trading_accounts(id) ON DELETE SET NULL,
  challenge_id BIGINT REFERENCES challenges(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  method TEXT NOT NULL,
  provider TEXT,
  provider_ref TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  reference TEXT,
  destination {{json}},
  note TEXT,
  admin_note TEXT,
  mt5_ticket TEXT,
  credit_started_at TIMESTAMPTZ,
  processed_by BIGINT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_tx_user ON transactions (user_id, created_at);
CREATE INDEX ix_tx_status ON transactions (status, type);
CREATE INDEX ix_tx_account ON transactions (account_id);
CREATE UNIQUE INDEX ux_tx_provider_ref ON transactions (provider, provider_ref);

CREATE TABLE kyc_documents (
  id {{pk}},
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage TEXT NOT NULL,
  data {{blob}},
  path TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  rejection_reason TEXT,
  reviewed_by BIGINT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_kyc_docs_user ON kyc_documents (user_id);

CREATE TABLE tickets (
  id {{pk}},
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_tickets_user ON tickets (user_id);
CREATE INDEX ix_tickets_status ON tickets (status, updated_at);

CREATE TABLE ticket_messages (
  id {{pk}},
  ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  is_staff BOOLEAN NOT NULL DEFAULT FALSE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_ticket_messages_ticket ON ticket_messages (ticket_id, created_at);

CREATE TABLE contact_messages (
  id {{pk}},
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  language TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  handled_by BIGINT,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_contact_status ON contact_messages (status, created_at);

CREATE TABLE posts (
  id {{pk}},
  slug TEXT NOT NULL,
  language TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  body_md TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  author_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX ux_posts_slug_lang ON posts (slug, language);
CREATE INDEX ix_posts_status ON posts (status, published_at);

CREATE TABLE audit_log (
  id {{pk}},
  actor_id BIGINT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  data {{json}},
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_audit_created ON audit_log (created_at);
CREATE INDEX ix_audit_target ON audit_log (target_type, target_id);

CREATE TABLE email_outbox (
  id {{pk}},
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ
);
CREATE INDEX ix_outbox_status ON email_outbox (status, created_at);

CREATE TABLE webhook_events (
  id {{pk}},
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT,
  payload {{json}},
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX ux_webhook_events ON webhook_events (provider, event_id);
