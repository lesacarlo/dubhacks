-- Run after 202610170002_verified_products.sql when that migration has already
-- been applied. This lets verified web discoveries be stored for the full
-- backpacking checklist without implying inventory or availability.
alter table public.outfitter_products
  drop constraint if exists outfitter_products_slot_check;

alter table public.outfitter_products
  add constraint outfitter_products_slot_check check (
    slot in (
      'backpack', 'shelter', 'bag', 'pad', 'stove', 'water-treatment',
      'headlamp', 'first-aid', 'running-shoes', 'hydration'
    )
  );
