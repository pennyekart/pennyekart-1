
-- 1. New columns on seller_products
ALTER TABLE public.seller_products
  ADD COLUMN IF NOT EXISTS assign_to_all_micro_godowns boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_grocery boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_seller_products_is_grocery ON public.seller_products(is_grocery);
CREATE INDEX IF NOT EXISTS idx_seller_products_assign_all ON public.seller_products(assign_to_all_micro_godowns);

-- 2. Link table
CREATE TABLE IF NOT EXISTS public.seller_product_micro_godowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_product_id uuid NOT NULL,
  godown_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_product_id, godown_id)
);

CREATE INDEX IF NOT EXISTS idx_spmg_seller_product ON public.seller_product_micro_godowns(seller_product_id);
CREATE INDEX IF NOT EXISTS idx_spmg_godown ON public.seller_product_micro_godowns(godown_id);

ALTER TABLE public.seller_product_micro_godowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read seller product micro godowns"
  ON public.seller_product_micro_godowns
  FOR SELECT USING (true);

CREATE POLICY "Authorized can insert seller product micro godowns"
  ON public.seller_product_micro_godowns
  FOR INSERT WITH CHECK (is_super_admin() OR has_permission('update_products'));

CREATE POLICY "Authorized can update seller product micro godowns"
  ON public.seller_product_micro_godowns
  FOR UPDATE USING (is_super_admin() OR has_permission('update_products'));

CREATE POLICY "Authorized can delete seller product micro godowns"
  ON public.seller_product_micro_godowns
  FOR DELETE USING (is_super_admin() OR has_permission('update_products'));

-- 3. Trigger to maintain is_grocery flag
CREATE OR REPLACE FUNCTION public.mark_grocery_seller_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ctype text;
BEGIN
  IF NEW.category IS NULL THEN
    NEW.is_grocery := false;
  ELSE
    SELECT category_type INTO _ctype
    FROM public.categories
    WHERE name = NEW.category
    LIMIT 1;
    NEW.is_grocery := (_ctype = 'grocery');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_grocery_seller_product ON public.seller_products;
CREATE TRIGGER trg_mark_grocery_seller_product
  BEFORE INSERT OR UPDATE OF category
  ON public.seller_products
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_grocery_seller_product();

-- 4. Backfill existing rows
UPDATE public.seller_products sp
SET is_grocery = true
WHERE EXISTS (
  SELECT 1 FROM public.categories c
  WHERE c.name = sp.category AND c.category_type = 'grocery'
);
