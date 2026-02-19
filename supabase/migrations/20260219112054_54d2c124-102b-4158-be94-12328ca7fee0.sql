
-- Penny Prime Coupons: created by sellers, tied to a specific product
CREATE TABLE public.penny_prime_coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_code text NOT NULL UNIQUE,
  customer_discount_type text NOT NULL DEFAULT 'amount' CHECK (customer_discount_type IN ('amount', 'percent')),
  customer_discount_value numeric NOT NULL DEFAULT 0,
  agent_margin_type text NOT NULL DEFAULT 'amount' CHECK (agent_margin_type IN ('amount', 'percent')),
  agent_margin_value numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.penny_prime_coupons ENABLE ROW LEVEL SECURITY;

-- Sellers can create/manage their own coupons
CREATE POLICY "Sellers can create own coupons"
  ON public.penny_prime_coupons FOR INSERT
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update own coupons"
  ON public.penny_prime_coupons FOR UPDATE
  USING (seller_id = auth.uid() OR is_super_admin());

CREATE POLICY "Sellers can delete own coupons"
  ON public.penny_prime_coupons FOR DELETE
  USING (seller_id = auth.uid() OR is_super_admin());

CREATE POLICY "Anyone can read active penny prime coupons"
  ON public.penny_prime_coupons FOR SELECT
  USING (is_active = true OR seller_id = auth.uid() OR is_super_admin() OR has_permission('read_products'));

-- Penny Prime Collabs: agents who collaborate on a coupon
CREATE TABLE public.penny_prime_collabs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id uuid NOT NULL REFERENCES public.penny_prime_coupons(id) ON DELETE CASCADE,
  agent_user_id uuid,
  agent_mobile text NOT NULL,
  collab_code text NOT NULL UNIQUE,
  margin_status text NOT NULL DEFAULT 'pending' CHECK (margin_status IN ('pending', 'paid')),
  margin_paid_at timestamp with time zone,
  margin_paid_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.penny_prime_collabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can create collab"
  ON public.penny_prime_collabs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Read own collab or admin"
  ON public.penny_prime_collabs FOR SELECT
  USING (agent_user_id = auth.uid() OR is_super_admin() OR has_permission('read_products'));

CREATE POLICY "Admin can update collabs"
  ON public.penny_prime_collabs FOR UPDATE
  USING (is_super_admin() OR has_permission('read_orders'));

-- Penny Prime Coupon Uses: tracks when a collab code is used in an order
CREATE TABLE public.penny_prime_coupon_uses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collab_id uuid NOT NULL REFERENCES public.penny_prime_collabs(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_user_id uuid,
  discount_amount numeric NOT NULL DEFAULT 0,
  agent_margin_amount numeric NOT NULL DEFAULT 0,
  used_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.penny_prime_coupon_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can insert coupon uses"
  ON public.penny_prime_coupon_uses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and involved users can read coupon uses"
  ON public.penny_prime_coupon_uses FOR SELECT
  USING (customer_user_id = auth.uid() OR is_super_admin() OR has_permission('read_orders'));

-- Trigger for updated_at
CREATE TRIGGER update_penny_prime_coupons_updated_at
  BEFORE UPDATE ON public.penny_prime_coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
