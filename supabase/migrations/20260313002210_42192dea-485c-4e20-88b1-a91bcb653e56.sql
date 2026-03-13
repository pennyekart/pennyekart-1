
-- Delivery charge rules table
CREATE TABLE public.delivery_charge_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type text NOT NULL CHECK (rule_type IN ('category', 'godown', 'free_delivery', 'time_based')),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  -- category-wise: category name
  category_name text,
  -- godown-wise: godown id
  godown_id uuid REFERENCES public.godowns(id) ON DELETE CASCADE,
  -- charge amount
  charge_amount numeric NOT NULL DEFAULT 0,
  -- free delivery: minimum purchase amount
  min_purchase_amount numeric DEFAULT 0,
  -- time-based fields
  time_slot_label text,
  time_slot_start time,
  time_slot_end time,
  -- priority: lower = applied first
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_charge_rules ENABLE ROW LEVEL SECURITY;

-- Anyone can read active rules (needed at checkout)
CREATE POLICY "Anyone can read active delivery charge rules" ON public.delivery_charge_rules
  FOR SELECT TO public USING (is_active = true OR is_super_admin() OR has_permission('read_products'));

CREATE POLICY "Admin can insert delivery charge rules" ON public.delivery_charge_rules
  FOR INSERT TO public WITH CHECK (is_super_admin() OR has_permission('create_products'));

CREATE POLICY "Admin can update delivery charge rules" ON public.delivery_charge_rules
  FOR UPDATE TO public USING (is_super_admin() OR has_permission('update_products'));

CREATE POLICY "Admin can delete delivery charge rules" ON public.delivery_charge_rules
  FOR DELETE TO public USING (is_super_admin() OR has_permission('delete_products'));

-- Add delivery_charge column to orders to store the computed charge
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_charge numeric NOT NULL DEFAULT 0;
