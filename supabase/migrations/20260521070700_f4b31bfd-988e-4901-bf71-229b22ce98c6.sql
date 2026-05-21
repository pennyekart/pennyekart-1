
-- Combo products: an admin-curated bundle of multiple products sold at a single combo price.
CREATE TABLE public.product_combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  combo_price numeric NOT NULL DEFAULT 0,
  total_mrp numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE public.product_combo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES public.product_combos(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_combo_items_combo ON public.product_combo_items(combo_id);
CREATE INDEX idx_product_combo_items_product ON public.product_combo_items(product_id);

ALTER TABLE public.product_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_combo_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active combos" ON public.product_combos
FOR SELECT USING (is_active = true OR is_super_admin() OR has_permission('read_products'::text));

CREATE POLICY "Authorized can create combos" ON public.product_combos
FOR INSERT WITH CHECK (is_super_admin() OR has_permission('create_products'::text));

CREATE POLICY "Authorized can update combos" ON public.product_combos
FOR UPDATE USING (is_super_admin() OR has_permission('update_products'::text));

CREATE POLICY "Authorized can delete combos" ON public.product_combos
FOR DELETE USING (is_super_admin() OR has_permission('delete_products'::text));

CREATE POLICY "Anyone can read combo items" ON public.product_combo_items
FOR SELECT USING (true);

CREATE POLICY "Authorized can create combo items" ON public.product_combo_items
FOR INSERT WITH CHECK (is_super_admin() OR has_permission('create_products'::text));

CREATE POLICY "Authorized can update combo items" ON public.product_combo_items
FOR UPDATE USING (is_super_admin() OR has_permission('update_products'::text));

CREATE POLICY "Authorized can delete combo items" ON public.product_combo_items
FOR DELETE USING (is_super_admin() OR has_permission('delete_products'::text));

CREATE TRIGGER update_product_combos_updated_at
BEFORE UPDATE ON public.product_combos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
