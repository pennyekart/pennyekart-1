CREATE OR REPLACE FUNCTION public.invite_to_community(_mobile text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cid uuid;
  _norm text := RIGHT(regexp_replace(COALESCE(_mobile, ''), '\D', '', 'g'), 10);
  _target record;
  _invite_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT id INTO _cid FROM public.communities WHERE creator_user_id = _uid;
  IF _cid IS NULL THEN RAISE EXCEPTION 'Only the community creator can invite members'; END IF;
  IF length(_norm) <> 10 THEN RAISE EXCEPTION 'Enter a valid 10-digit mobile number'; END IF;
  IF _norm = public.my_normalized_mobile() THEN RAISE EXCEPTION 'You are already in this community'; END IF;

  SELECT user_id, is_verified INTO _target
  FROM public.profiles
  WHERE RIGHT(regexp_replace(COALESCE(mobile_number, ''), '\D', '', 'g'), 10) = _norm
  ORDER BY
    COALESCE(is_verified, false) DESC,
    (user_type = 'customer') DESC,
    created_at
  LIMIT 1;

  IF _target.user_id IS NULL THEN RAISE EXCEPTION 'This mobile number is not registered on Pennyekart'; END IF;
  IF NOT COALESCE(_target.is_verified, false) THEN RAISE EXCEPTION 'This user has not verified their account yet'; END IF;
  IF EXISTS (SELECT 1 FROM public.community_members WHERE user_id = _target.user_id) THEN
    RAISE EXCEPTION 'This person already belongs to a community (ഈ ഉപയോക്താവ് ഇതിനകം ഒരു കമ്മ്യൂണിറ്റിയിൽ അംഗമാണ്)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.community_invites WHERE community_id = _cid AND invited_mobile = _norm AND status = 'pending') THEN
    RAISE EXCEPTION 'An invite is already pending for this number (ഈ നമ്പറിലേക്ക് ഇതിനകം ഒരു ക്ഷണം ലഭിച്ചിട്ടുണ്ട്.)';
  END IF;

  INSERT INTO public.community_invites (community_id, invited_mobile, invited_user_id, created_by)
  VALUES (_cid, _norm, _target.user_id, _uid)
  RETURNING id INTO _invite_id;
  RETURN _invite_id;
END;
$$;
