-- Sample copycats and a first cook-off so the site isn't empty on day one.
-- Safe to re-run. Images are left empty; replace image_path after uploading photos you own to the "dishes" bucket.

insert into public.recipes (slug, dish, restaurant, cuisine, servings, minutes, difficulty, confidence, why, menu_price, plate_cost, ingredients, steps)
values
('chipotle-chicken-burrito-bowl-sample', 'Chicken burrito bowl', 'Chipotle', 'Mexican-style fast casual', 2, 35, 'Easy', 0.91,
 'Adobo-charred chopped chicken, cilantro-lime rice, black beans, corn salsa and shredded romaine.', 11.25, 3.40,
 '[{"name":"Chicken thighs, boneless","qty":1,"unit":"lb","aisle":"Meat","price":6.49},
   {"name":"Chipotle peppers in adobo","qty":2,"unit":"tbsp","aisle":"International","price":2.49},
   {"name":"Long-grain white rice","qty":1,"unit":"cup","aisle":"Pantry","price":2.99},
   {"name":"Limes","qty":2,"unit":"","aisle":"Produce","price":1.00},
   {"name":"Cilantro","qty":0.25,"unit":"cup","aisle":"Produce","price":0.99},
   {"name":"Black beans","qty":1,"unit":"can","aisle":"Pantry","price":1.29},
   {"name":"Frozen corn","qty":1,"unit":"cup","aisle":"Frozen","price":1.99},
   {"name":"Romaine hearts","qty":1,"unit":"","aisle":"Produce","price":2.49},
   {"name":"Sour cream","qty":0.25,"unit":"cup","aisle":"Dairy","price":2.29},
   {"name":"Monterey Jack, shredded","qty":0.5,"unit":"cup","aisle":"Dairy","price":3.49}]'::jsonb,
 '["Blend chipotle peppers, a splash of oil, lime juice, cumin and salt; marinate the chicken 20 minutes.",
   "Cook rice, then fold in lime zest, lime juice and chopped cilantro.",
   "Grill or sear the chicken 5–6 minutes per side until charred; rest and chop small.",
   "Warm the beans; char corn in a dry pan with a pinch of chili powder and lime.",
   "Build bowls: rice, beans, chicken, corn, romaine, cheese, sour cream."]'::jsonb),
('carbone-spicy-rigatoni-vodka-sample', 'Spicy rigatoni vodka', 'Carbone', 'Italian-American', 2, 30, 'Easy', 0.94,
 'Rigatoni in a blush-orange cream sauce with chili and torn basil.', 34.00, 4.10,
 '[{"name":"Rigatoni","qty":8,"unit":"oz","aisle":"Pantry","price":2.29},
   {"name":"Tomato paste","qty":3,"unit":"tbsp","aisle":"Pantry","price":1.49},
   {"name":"Heavy cream","qty":0.5,"unit":"cup","aisle":"Dairy","price":3.19},
   {"name":"Vodka","qty":2,"unit":"tbsp","aisle":"Beer & wine","price":0},
   {"name":"Shallot","qty":1,"unit":"","aisle":"Produce","price":0.89},
   {"name":"Garlic cloves","qty":2,"unit":"","aisle":"Produce","price":0.69},
   {"name":"Calabrian chili paste","qty":1,"unit":"tsp","aisle":"International","price":5.99},
   {"name":"Parmesan, grated","qty":0.5,"unit":"cup","aisle":"Dairy","price":4.99},
   {"name":"Fresh basil","qty":6,"unit":"leaves","aisle":"Produce","price":2.49},
   {"name":"Butter","qty":1,"unit":"tbsp","aisle":"Dairy","price":4.29}]'::jsonb,
 '["Boil rigatoni in well-salted water until 1 minute shy of al dente; save 1 cup pasta water.",
   "Melt butter and soften minced shallot and garlic, 3 minutes.",
   "Stir in tomato paste and chili paste; cook until brick-red, about 4 minutes.",
   "Add vodka, let it cook off for 1 minute, then stir in the cream.",
   "Toss in the pasta, parmesan and splashes of pasta water until glossy. Finish with basil."]'::jsonb)
on conflict (slug) do nothing;

insert into public.challenges (slug, title, blurb, recipe_id, starts_at, ends_at)
select 'week-1-burrito-bowl', 'Chipotle-style burrito bowl',
       'Can you beat $11.25 a bowl? Make it, post it, and vote for the best-looking copy.',
       id, now(), now() + interval '7 days'
from public.recipes where slug = 'chipotle-chicken-burrito-bowl-sample'
on conflict (slug) do nothing;
