-- Meal types for filtering My recipes. A dish can fit more than one (a burrito bowl is lunch and dinner).
-- Run after 0003_entry_details.sql. Safe to re-run.
alter table public.recipes add column if not exists meals text[] not null default '{}';
alter table public.recipes drop constraint if exists recipes_meals_check;
alter table public.recipes add constraint recipes_meals_check
  check (meals <@ array['breakfast', 'lunch', 'dinner', 'dessert', 'snack', 'drink']::text[]);
create index if not exists recipes_meals_idx on public.recipes using gin (meals);

-- Best guess for recipes saved before Plateful tagged meals. New scans are tagged by Claude.
update public.recipes set meals = case
  when dish ~* '(latte|coffee|frappuccino|macchiato|cold brew|\mtea\M|smoothie|lemonade|refresher|soda|cocktail|margarita|milkshake)' then array['drink']
  when dish ~* '(cake|cookie|\mpie\M|brownie|ice cream|sundae|cheesecake|churro|donut|doughnut|pudding|\mtart\M|cinnamon roll|frosty|mcflurry|blizzard|cobbler|tiramisu|flan)' then array['dessert']
  when dish ~* '(pancake|waffle|omelet|french toast|hash brown|bagel|oatmeal|benedict|breakfast|scrambl|biscuits and gravy|mcmuffin|croissant|muffin|frittata|chilaquiles)' then array['breakfast']
  when dish ~* '(fries|nachos|\mdip\M|pretzel|chips|bites|mozzarella sticks|appetizer|queso|egg roll|spring roll|dumpling|wings)' then array['snack']
  else array['lunch', 'dinner']
end
where meals = '{}';

select meals, count(*) from public.recipes group by meals order by count(*) desc;
