-- What voters need to judge an entry: the original to compare against, and facts about each copy.
-- Run after 0002_gamification.sql. Safe to re-run.

-- The real restaurant dish each cook-off is judged against (a photo you own, in the "dishes" bucket).
alter table public.challenges add column if not exists reference_image_path text;

-- Entry details shown to voters.
alter table public.attempts add column if not exists cost_per_plate numeric(6, 2) check (cost_per_plate is null or cost_per_plate between 0 and 200);
alter table public.attempts add column if not exists minutes int check (minutes is null or minutes between 1 and 1440);
alter table public.attempts add column if not exists swaps text check (swaps is null or char_length(swaps) <= 200);
alter table public.attempts add column if not exists notes text check (notes is null or char_length(notes) <= 1000);
-- 'self' = typed in by the cook; 'receipt' = worked out by Plateful from a receipt photo (the receipt is not stored).
alter table public.attempts add column if not exists cost_source text check (cost_source is null or cost_source in ('self', 'receipt'));
alter table public.attempts add column if not exists receipt_store text check (receipt_store is null or char_length(receipt_store) <= 60);
alter table public.attempts add column if not exists receipt_verified_at timestamptz;

-- Thriftiest copy: cheapest receipt-verified entry each week.
alter table public.challenges add column if not exists thriftiest_attempt_id uuid references public.attempts (id) on delete set null;

alter table public.user_badges drop constraint if exists user_badges_badge_check;
alter table public.user_badges add constraint user_badges_badge_check
  check (badge in ('first_copycat', 'top10', 'crowd_favorite', 'chef_pick', 'thriftiest', 'streak_4', 'brought_3'));

alter table public.points_events drop constraint if exists points_events_kind_check;
alter table public.points_events add constraint points_events_kind_check
  check (kind in ('post', 'vote_cast', 'vote_received', 'referral_signup', 'referral_cook', 'streak', 'win', 'chef_pick', 'thriftiest', 'top10', 'receipt'));

