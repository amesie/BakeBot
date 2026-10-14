-- M1: extensions and enum types.
-- Covers: data dictionary enums (spec section 5) and SRS gap 1 (waitlisted status).

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;  -- faq_knowledge embeddings (REQ-22)
create extension if not exists pg_cron;                         -- scheduled jobs (M6)
create extension if not exists pg_net with schema extensions;   -- pg_cron -> /api/cron/* calls (M6)

-- Helper functions live here so PostgREST never exposes them.
create schema if not exists private;

create type public.customer_type as enum ('learner', 'teacher', 'other');
create type public.language_code as enum ('en', 'xh', 'af');

-- 'waitlisted' added for REQ-06 (SRS gap 1, docs/DECISIONS.md D-008).
create type public.order_status as enum (
  'waitlisted', 'pending', 'confirmed', 'baking', 'ready', 'collected', 'cancelled'
);
create type public.payment_status as enum ('unpaid', 'pending_review', 'paid');
create type public.payment_method as enum ('cash', 'eft');

-- Collection slots from the Figma design (D-005).
create type public.collection_slot as enum ('second_break', 'after_school');

create type public.staff_role as enum ('owner', 'helper');
create type public.faq_category as enum ('pricing', 'discounts', 'allergens', 'other');
create type public.notification_channel as enum ('in_app', 'whatsapp');
create type public.notification_status as enum ('queued', 'sent', 'failed');
create type public.job_status as enum ('running', 'succeeded', 'failed');
