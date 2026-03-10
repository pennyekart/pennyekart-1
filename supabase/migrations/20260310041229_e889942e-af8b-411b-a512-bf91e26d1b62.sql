-- Add featured discount columns to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS featured_discount_type text NOT NULL DEFAULT 'amount',
  ADD COLUMN IF NOT EXISTS featured_discount_value numeric NOT NULL DEFAULT 0;

-- Add featured discount columns to seller_products table
ALTER TABLE public.seller_products
  ADD COLUMN IF NOT EXISTS featured_discount_type text NOT NULL DEFAULT 'amount',
  ADD COLUMN IF NOT EXISTS featured_discount_value numeric NOT NULL DEFAULT 0;