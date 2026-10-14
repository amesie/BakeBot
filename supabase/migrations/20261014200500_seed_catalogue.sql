-- M1: reference data. Catalogue and prices confirmed by the owner on
-- 2026-10-14 (docs/DECISIONS.md D-001). Descriptions from the Figma design.
-- Prices are edited later in the owner dashboard, not by new migrations.

insert into public.app_settings (id) values (true)
on conflict (id) do nothing;

insert into public.products (product_name, flavour, description, unit_price, sort_order) values
  ('Cake pop', 'Belgian Chocolate',
   'Fudgy dark chocolate cake coated in decadent Belgian chocolate with chocolate drizzle.',
   15.00, 1),
  ('Cake pop', 'Cookies and Cream',
   'Chocolate cake with an Oreo crumble centre, covered in silky white chocolate and topped with Oreo pieces.',
   12.00, 2),
  ('Cake pop', 'Top Deck',
   'Moist chocolate and vanilla swirl cake coated in decadent Belgian chocolate with white chocolate drizzle.',
   15.00, 3),
  ('Cake pop', 'Funfetti',
   'Sweet vanilla sponge with rainbow sprinkles, covered in silky white chocolate and extra sprinkles.',
   10.00, 4)
on conflict (product_name, flavour) do nothing;
