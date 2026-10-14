-- M1: core tables from spec section 5, plus SRS gap fixes (section 8).
-- RLS is enabled on every table in 20261014200300_rls.sql.

-- ---------------------------------------------------------------------------
-- Settings (SRS gap 7: configurable last school day; owner-editable defaults)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),  -- single row
  default_weekly_cap int not null default 200 check (default_weekly_cap > 0),
  large_order_threshold int not null default 30 check (large_order_threshold > 0),  -- REQ-07
  last_school_day_isodow int not null default 5 check (last_school_day_isodow between 1 and 5),  -- REQ-20
  collection_place text not null default 'To be confirmed',
  updated_at timestamptz not null default now()
);

-- Public holidays: override the last school day for a given week (gap 7).
create table public.school_day_overrides (
  week_start date primary key check (extract(isodow from week_start) = 1),
  last_school_day date not null,
  note text,
  check (last_school_day between week_start and week_start + 4)
);

-- ---------------------------------------------------------------------------
-- Staff (SRS gap 6)
-- ---------------------------------------------------------------------------
create table public.staff_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.staff_role not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Customers (REQ-01, REQ-02, REQ-03, REQ-27)
-- ---------------------------------------------------------------------------
create table public.customers (
  customer_id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(btrim(full_name)) between 1 and 100),
  phone_number text not null unique,
  customer_type public.customer_type,
  preferred_language public.language_code not null default 'en',
  consent_given boolean not null check (consent_given),          -- no PII without consent
  consent_timestamp timestamptz not null default now(),
  consent_version text not null,
  is_minor boolean not null,
  guardian_consent boolean not null default false,
  last_order_at timestamptz,
  anonymised_at timestamptz,                                      -- REQ-27
  created_at timestamptz not null default now(),
  constraint customers_minor_needs_guardian check (not is_minor or guardian_consent),
  -- E.164 South African number, unless replaced by an anonymisation token.
  constraint customers_phone_e164 check (
    anonymised_at is not null or phone_number ~ '^\+27[1-9][0-9]{8}$'
  )
);

-- ---------------------------------------------------------------------------
-- Catalogue and capacity
-- ---------------------------------------------------------------------------
create table public.products (
  product_id uuid primary key default gen_random_uuid(),
  product_name text not null,
  flavour text not null,
  description text,
  unit_price numeric(8,2) not null check (unit_price > 0),  -- server-side source of truth
  is_available boolean not null default true,
  sort_order int not null default 0,
  unique (product_name, flavour)
);

create table public.weekly_capacity (
  week_start date primary key check (extract(isodow from week_start) = 1),  -- Monday
  unit_cap int not null check (unit_cap > 0)
);

-- ---------------------------------------------------------------------------
-- Orders (REQ-04 to REQ-09, REQ-19, REQ-20)
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq;

create table public.orders (
  order_id uuid primary key default gen_random_uuid(),  -- normally client-generated (REQ-09)
  order_number text not null unique,                    -- REQ-08, set by trigger
  customer_id uuid not null references public.customers (customer_id) on delete restrict,
  order_status public.order_status not null default 'pending',
  payment_method public.payment_method not null,
  payment_reference text unique,                         -- REQ-14, set on approval
  collection_date date not null check (extract(isodow from collection_date) between 1 and 5),
  collection_week date generated always as (collection_date - (extract(isodow from collection_date)::int - 1)) stored,  -- Monday
  collection_slot public.collection_slot not null,
  revised_collection_date date,                          -- REQ-19, gap 3
  special_notes text check (char_length(special_notes) <= 280),
  total_units int not null check (total_units > 0),
  is_large_order boolean not null default false,         -- REQ-07
  quote_amount numeric(8,2) check (quote_amount >= 0),
  access_token_hash text,                                -- status link token (gap 4)
  released_at timestamptz,                               -- REQ-20, gap 2
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders (customer_id);
create index orders_week_status_idx on public.orders (collection_week, order_status);

create table public.order_items (
  item_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (order_id) on delete cascade,
  product_id uuid not null references public.products (product_id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price_snapshot numeric(8,2) not null check (unit_price_snapshot >= 0),
  unique (order_id, product_id)
);
create index order_items_product_idx on public.order_items (product_id);

-- ---------------------------------------------------------------------------
-- Payments and invoices (REQ-14 to REQ-17)
-- ---------------------------------------------------------------------------
create table public.payments (
  payment_id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (order_id) on delete restrict,
  amount numeric(8,2) not null check (amount >= 0),       -- computed server-side only
  payment_status public.payment_status not null default 'unpaid',
  proof_of_payment_path text,                              -- private bucket path (REQ-15)
  proof_uploaded_at timestamptz,
  marked_paid_by uuid references auth.users (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_paid_has_time check (payment_status <> 'paid' or paid_at is not null)
);

create table public.invoices (
  invoice_id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,                     -- = orders.payment_reference
  order_id uuid not null unique references public.orders (order_id) on delete restrict,
  issued_at timestamptz not null default now(),
  total_amount numeric(8,2) not null check (total_amount >= 0),
  pdf_path text                                            -- private bucket
);

-- ---------------------------------------------------------------------------
-- Feedback (REQ-26)
-- ---------------------------------------------------------------------------
create table public.feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (order_id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  taste_rating int check (taste_rating between 1 and 5),
  size_rating int check (size_rating between 1 and 5),
  price_rating int check (price_rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AI assistant (REQ-21 to REQ-24)
-- ---------------------------------------------------------------------------
create table public.conversations (
  conversation_id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (customer_id) on delete set null,
  language public.language_code not null default 'en',
  messages jsonb not null default '[]'::jsonb,
  unresolved_attempts int not null default 0,
  escalated boolean not null default false,               -- REQ-23
  escalated_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),          -- deleted after 30 days (M6)
  updated_at timestamptz not null default now()
);
create index conversations_escalated_idx on public.conversations (escalated) where escalated;
create index conversations_created_idx on public.conversations (created_at);
create index conversations_customer_idx on public.conversations (customer_id);

create table public.faq_knowledge (
  faq_id uuid primary key default gen_random_uuid(),
  question text not null,
  approved_answer text not null,
  category public.faq_category not null default 'other',
  language public.language_code not null default 'en',
  embedding extensions.vector(768),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index faq_knowledge_embedding_idx on public.faq_knowledge
  using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Logs (SRS gap 5)
-- ---------------------------------------------------------------------------
create table public.notifications (
  notification_id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (order_id) on delete set null,
  customer_id uuid references public.customers (customer_id) on delete set null,
  recipient text not null check (recipient in ('customer', 'owner')),
  channel public.notification_channel not null,
  template text not null,
  params jsonb not null default '{}'::jsonb,  -- keep PII out; resolved at render time
  status public.notification_status not null default 'queued',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notifications_order_idx on public.notifications (order_id);
create index notifications_customer_idx on public.notifications (customer_id);
create index notifications_queue_idx on public.notifications (status, created_at) where status <> 'sent';

create table public.job_runs (
  run_id bigint generated always as identity primary key,
  job_name text not null,
  status public.job_status not null default 'running',
  rows_affected int,
  detail jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index job_runs_job_idx on public.job_runs (job_name, started_at desc);

create table public.error_log (
  error_id bigint generated always as identity primary key,
  source text not null,
  message text not null,
  context jsonb,
  occurred_at timestamptz not null default now()
);
create index error_log_time_idx on public.error_log (occurred_at desc);
