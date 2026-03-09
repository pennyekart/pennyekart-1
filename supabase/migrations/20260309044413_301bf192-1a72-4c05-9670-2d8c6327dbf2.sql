-- Add platform margin percentage to categories (default margin for products in this category)
ALTER TABLE public.categories ADD COLUMN margin_percentage numeric DEFAULT 0;

-- Add platform margin percentage to products (can override category margin)
ALTER TABLE public.products ADD COLUMN margin_percentage numeric DEFAULT NULL;

-- Add platform margin percentage to seller_products (can override category margin)
ALTER TABLE public.seller_products ADD COLUMN margin_percentage numeric DEFAULT NULL;