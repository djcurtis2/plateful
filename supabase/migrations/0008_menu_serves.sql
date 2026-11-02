-- Shareable restaurant orders: a $12.49 nachos platter that feeds 3 is $4.16 a plate.
-- Savings compare plates to plates. Run after 0007_savings.sql. Safe to re-run.
alter table public.recipes add column if not exists menu_serves smallint not null default 1 check (menu_serves between 1 and 12);

update public.recipes set menu_serves = v.n from (values
  ('chilis-loaded-nachos-demo', 3), ('chipotle-guacamole-and-chips-demo', 2), ('pf-changs-chicken-lettuce-wraps-demo', 3)
) as v(slug, n) where recipes.slug = v.slug;
-- A side of garlic bread for one person, not a whole loaf.
update public.recipes set out_price = 2.75 where slug = 'grandma-style-cheesy-garlic-bread-demo';

-- Recalculate savings already logged with the per-plate prices.
update public.cook_log c set
  out_cost = round(case when c.compare = 'menu' then r.menu_price / r.menu_serves else r.out_price end * c.servings, 2),
  saved = greatest(0, round(case when c.compare = 'menu' then r.menu_price / r.menu_serves else r.out_price end * c.servings, 2) - c.home_cost)
from public.recipes r
where r.id = c.recipe_id and ((c.compare = 'menu' and r.menu_price is not null) or (c.compare = 'similar' and r.out_price is not null));

select r.dish, c.servings, c.out_cost, c.home_cost, c.saved from public.cook_log c join public.recipes r on r.id = c.recipe_id order by c.created_at desc limit 10;
