
ALTER TABLE public.products
ADD COLUMN purchase_rate numeric NOT NULL DEFAULT 0,
ADD COLUMN mrp numeric NOT NULL DEFAULT 0,
ADD COLUMN discount_rate numeric NOT NULL DEFAULT 0,
ADD COLUMN image_url_2 text,
ADD COLUMN image_url_3 text;
