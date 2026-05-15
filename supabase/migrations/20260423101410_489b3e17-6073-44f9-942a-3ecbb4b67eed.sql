ALTER TABLE public.scratch_cards
  ADD COLUMN product_link_url text DEFAULT NULL,
  ADD COLUMN product_discount_text text DEFAULT NULL;