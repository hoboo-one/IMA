insert into storage.buckets (id, name, public)
values
  ('product-raw', 'product-raw', false),
  ('product-generated', 'product-generated', false),
  ('product-video', 'product-video', false)
on conflict (id) do nothing;

-- Buckets stay private. All app uploads/downloads go through trusted server-side clients.
