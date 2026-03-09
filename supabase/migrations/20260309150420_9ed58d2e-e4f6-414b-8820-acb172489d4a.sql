
-- Fix handle_new_user to resolve referral_code instead of expecting profile ID
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _customer_role_id uuid;
  _referred_by_id uuid;
  _referral_code text;
BEGIN
  -- Get customer role id
  SELECT id INTO _customer_role_id FROM public.roles WHERE name = 'customer';

  -- Resolve referred_by: try as UUID first (legacy), then as referral_code
  _referral_code := NULLIF(TRIM(NEW.raw_user_meta_data->>'referral_code'), '');
  
  IF _referral_code IS NOT NULL THEN
    SELECT id INTO _referred_by_id FROM public.profiles WHERE referral_code = _referral_code LIMIT 1;
  ELSE
    -- Legacy: direct profile ID
    _referred_by_id := NULLIF(NEW.raw_user_meta_data->>'referred_by', '')::uuid;
  END IF;

  INSERT INTO public.profiles (user_id, email, full_name, mobile_number, date_of_birth, user_type, local_body_id, ward_number, is_approved, role_id, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'mobile_number',
    (NEW.raw_user_meta_data->>'date_of_birth')::date,
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'customer'),
    NULLIF(NEW.raw_user_meta_data->>'local_body_id', '')::uuid,
    NULLIF(NEW.raw_user_meta_data->>'ward_number', '')::integer,
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'user_type', 'customer') = 'customer' THEN true ELSE false END,
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'user_type', 'customer') = 'customer' THEN _customer_role_id ELSE NULL END,
    _referred_by_id
  );
  RETURN NEW;
END;
$function$;
