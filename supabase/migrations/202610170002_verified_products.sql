-- Source-backed product records. All unknown fields remain NULL; this table does not imply live inventory.
create table if not exists public.outfitter_products (
  id text primary key,
  slot text not null check (slot in ('backpack','shelter','bag','pad','running-shoes','hydration')),
  activity_ids text[] not null,
  brand text not null,
  name text not null,
  price_cents integer,
  price_text text,
  source_url text not null,
  search_url text not null,
  source_kind text not null check (source_kind in ('REI listing','REI product page','Manufacturer')),
  checked_at timestamptz not null,
  facts jsonb not null default '[]'::jsonb,
  variant_id text,
  variant_name text,
  image_url text,
  evidence text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.outfitter_products enable row level security;

insert into public.outfitter_products (id,slot,activity_ids,brand,name,price_cents,source_url,search_url,source_kind,checked_at,facts,evidence) values
('rei-flash-55-mens','backpack',array['backpacking'],'REI Co-op','Flash 55 Pack - Men''s',15993,'https://www.rei.com/c/backpacking-packs','https://www.rei.com/search?q=REI%20Co-op%20Flash%2055%20Pack%20Men%27s','REI listing','2026-10-17T00:00:00Z','["Multiday","53 to 57 liters","2.75 to 2.87 lbs","Ultralight","Reservoir compatible"]','Public REI Backpacking Packs listing; price is a recorded snapshot.'),
('rei-trailmade-2-tent','shelter',array['backpacking','camping'],'REI Co-op','Trailmade 2 Tent with Footprint',19900,'https://www.rei.com/b/rei-co-op/c/backpacking-tents','https://www.rei.com/search?q=REI%20Co-op%20Trailmade%202%20Tent%20with%20Footprint','REI listing','2026-10-17T00:00:00Z','["2-person","Minimum trail weight: 4 lbs. 10 oz.","3-season","Footprint included"]','Public REI Co-op Backpacking Tents listing; price is a recorded snapshot.'),
('rei-magma-15','bag',array['backpacking','camping'],'REI Co-op','Magma 15 Sleeping Bag',27893,'https://www.rei.com/c/backpacking-sleeping-bags','https://www.rei.com/search?q=REI%20Co-op%20Magma%2015%20Sleeping%20Bag','REI listing','2026-10-17T00:00:00Z','["15 F","2.12 to 2.5 lbs","Down","Water-resistant down"]','Public REI Backpacking Sleeping Bags listing; price is a recorded snapshot.'),
('rei-helix-insulated-air-pad','pad',array['backpacking','camping'],'REI Co-op','Helix Insulated Air Sleeping Pad',6683,'https://www.rei.com/b/rei-co-op/c/sleeping-pads/f/bu-backpacking','https://www.rei.com/search?q=REI%20Co-op%20Helix%20Insulated%20Air%20Sleeping%20Pad','REI listing','2026-10-17T00:00:00Z','["Backpacking","1.62 lbs","3 in. thick"]','Public REI Co-op Backpacking Sleeping Pads listing; price is a recorded snapshot.'),
('rei-altra-experience-wild-3-mens','running-shoes',array['running'],'Altra','Experience Wild 3 Trail-Running Shoes - Men''s',15000,'https://www.rei.com/c/trail-running-shoes','https://www.rei.com/search?q=Altra%20Experience%20Wild%203%20Trail-Running%20Shoes%20Men%27s','REI listing','2026-10-17T00:00:00Z','["Trail running","4 mm heel-to-toe drop","Moderate cushioning","Regular width"]','Public REI Trail-Running Shoes listing; price is a recorded snapshot. Fit is not verified.'),
('rei-swiftland-handheld-bottle','hydration',array['running'],'REI Co-op','Swiftland Handheld Water Bottle - 14 fl. oz.',4495,'https://www.rei.com/b/rei-co-op/c/running-hydration-packs','https://www.rei.com/search?q=REI%20Co-op%20Swiftland%20Handheld%20Water%20Bottle%2014%20fl%20oz','REI listing','2026-10-17T00:00:00Z','["14 fl. oz.","Handheld water bottle","Running hydration"]','Public REI Co-op Running Hydration Packs listing; price is a recorded snapshot.')
on conflict (id) do update set price_cents=excluded.price_cents, source_url=excluded.source_url, search_url=excluded.search_url, checked_at=excluded.checked_at, facts=excluded.facts, evidence=excluded.evidence, updated_at=now();
