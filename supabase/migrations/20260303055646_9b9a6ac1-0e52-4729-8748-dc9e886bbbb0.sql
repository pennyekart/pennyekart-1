
-- Trigger: Credit signup bonus when a new customer profile is created
CREATE OR REPLACE FUNCTION public.credit_signup_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _enabled text;
  _amount numeric;
  _wallet record;
BEGIN
  -- Only for new customer profiles
  IF NEW.user_type = 'customer' THEN
    SELECT value INTO _enabled FROM public.app_settings WHERE key = 'wallet_rule_signup_enabled';
    IF _enabled = 'true' THEN
      SELECT value INTO _amount FROM public.app_settings WHERE key = 'wallet_rule_signup_amount';
      _amount := COALESCE(_amount::numeric, 0);
      IF _amount > 0 THEN
        -- Wait briefly for wallet to be created by auto_create_customer_wallet
        SELECT * INTO _wallet FROM public.customer_wallets WHERE customer_user_id = NEW.user_id;
        IF _wallet IS NOT NULL THEN
          UPDATE public.customer_wallets SET balance = balance + _amount, updated_at = now() WHERE id = _wallet.id;
          INSERT INTO public.customer_wallet_transactions (wallet_id, customer_user_id, type, amount, description)
          VALUES (_wallet.id, NEW.user_id, 'credit', _amount, 'Signup bonus: ₹' || _amount);
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop if exists, then create trigger (after auto_create_customer_wallet)
DROP TRIGGER IF EXISTS trg_credit_signup_bonus ON public.profiles;
CREATE TRIGGER trg_credit_signup_bonus
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.credit_signup_bonus();

-- Trigger: Credit first purchase + midnight order bonus on delivery
CREATE OR REPLACE FUNCTION public.credit_order_bonus_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _wallet record;
  _enabled text;
  _amount numeric;
  _order_count int;
  _order_hour int;
  _total_bonus numeric := 0;
  _desc text := '';
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') AND NEW.user_id IS NOT NULL THEN

    SELECT * INTO _wallet FROM public.customer_wallets WHERE customer_user_id = NEW.user_id;
    IF _wallet IS NULL THEN RETURN NEW; END IF;

    -- First Purchase Bonus
    SELECT value INTO _enabled FROM public.app_settings WHERE key = 'wallet_rule_first_purchase_enabled';
    IF _enabled = 'true' THEN
      SELECT COUNT(*) INTO _order_count FROM public.orders
      WHERE user_id = NEW.user_id AND status = 'delivered' AND id != NEW.id;
      IF _order_count = 0 THEN
        SELECT value INTO _amount FROM public.app_settings WHERE key = 'wallet_rule_first_purchase_amount';
        _amount := COALESCE(_amount::numeric, 0);
        IF _amount > 0 THEN
          _total_bonus := _total_bonus + _amount;
          _desc := 'First purchase bonus: ₹' || _amount;
        END IF;
      END IF;
    END IF;

    -- Midnight Order Bonus (order placed between 12 AM - 5 AM)
    SELECT value INTO _enabled FROM public.app_settings WHERE key = 'wallet_rule_midnight_enabled';
    IF _enabled = 'true' THEN
      _order_hour := EXTRACT(HOUR FROM NEW.created_at);
      IF _order_hour >= 0 AND _order_hour < 5 THEN
        SELECT value INTO _amount FROM public.app_settings WHERE key = 'wallet_rule_midnight_amount';
        _amount := COALESCE(_amount::numeric, 0);
        IF _amount > 0 THEN
          _total_bonus := _total_bonus + _amount;
          IF _desc != '' THEN _desc := _desc || ' + '; END IF;
          _desc := _desc || 'Midnight order bonus: ₹' || _amount;
        END IF;
      END IF;
    END IF;

    -- Credit total bonus
    IF _total_bonus > 0 THEN
      UPDATE public.customer_wallets SET balance = balance + _total_bonus, updated_at = now() WHERE id = _wallet.id;
      INSERT INTO public.customer_wallet_transactions (wallet_id, customer_user_id, order_id, type, amount, description)
      VALUES (_wallet.id, NEW.user_id, NEW.id, 'credit', _total_bonus, _desc);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_order_bonus_rules ON public.orders;
CREATE TRIGGER trg_credit_order_bonus_rules
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.credit_order_bonus_rules();
