
CREATE OR REPLACE FUNCTION public.credit_seller_wallet_on_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _item jsonb;
  _product_id uuid;
  _qty int;
  _seller_id uuid;
  _purchase_rate numeric;
  _wallet_points numeric;
  _credit_amount numeric;
  _wallet record;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    FOR _item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      _product_id := (_item->>'id')::uuid;
      _qty := COALESCE((_item->>'quantity')::int, 1);

      SELECT sp.seller_id, sp.purchase_rate, sp.wallet_points
        INTO _seller_id, _purchase_rate, _wallet_points
      FROM public.seller_products sp
      WHERE sp.id = _product_id;

      IF _seller_id IS NOT NULL THEN
        -- Deduct wallet_points from purchase_rate before crediting
        _wallet_points := COALESCE(_wallet_points, 0);
        _credit_amount := GREATEST(0, (_purchase_rate - _wallet_points)) * _qty;

        SELECT * INTO _wallet FROM public.seller_wallets WHERE seller_id = _seller_id FOR UPDATE;

        IF NOT FOUND THEN
          INSERT INTO public.seller_wallets (seller_id, balance)
          VALUES (_seller_id, 0)
          ON CONFLICT DO NOTHING
          RETURNING * INTO _wallet;

          IF _wallet IS NULL THEN
            SELECT * INTO _wallet FROM public.seller_wallets WHERE seller_id = _seller_id FOR UPDATE;
          END IF;
        END IF;

        IF _wallet IS NOT NULL AND _credit_amount > 0 THEN
          UPDATE public.seller_wallets
          SET balance = balance + _credit_amount
          WHERE id = _wallet.id;

          INSERT INTO public.seller_wallet_transactions (
            wallet_id, seller_id, order_id, type, amount, description
          ) VALUES (
            _wallet.id,
            _seller_id,
            NEW.id,
            'credit',
            _credit_amount,
            'Order delivered: ₹' || _credit_amount || ' for ' || _qty || ' unit(s) (purchase ₹' || _purchase_rate || ' - wallet pts ₹' || _wallet_points || ')'
          );
        END IF;

        _seller_id := NULL;
        _purchase_rate := NULL;
        _wallet_points := NULL;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
