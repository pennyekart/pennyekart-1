-- COMMUNITIES
CREATE TABLE public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  creator_user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  joined_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.community_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  invited_mobile text NOT NULL,
  invited_user_id uuid,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_invites TO authenticated;
GRANT ALL ON public.community_invites TO service_role;
ALTER TABLE public.community_invites ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX community_invites_pending_uniq
  ON public.community_invites (community_id, invited_mobile)
  WHERE status = 'pending';

CREATE TRIGGER update_communities_updated_at BEFORE UPDATE ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_community_invites_updated_at BEFORE UPDATE ON public.community_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- helpers
CREATE OR REPLACE FUNCTION public.is_community_creator(_community_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.communities c WHERE c.id = _community_id AND c.creator_user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.my_community_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT community_id FROM public.community_members WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_normalized_mobile()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT RIGHT(regexp_replace(COALESCE(mobile_number, ''), '\D', '', 'g'), 10)
  FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.am_i_verified()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_verified FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), false);
$$;

-- POLICIES: communities
CREATE POLICY "Members can view their community" ON public.communities FOR SELECT TO authenticated
  USING (creator_user_id = auth.uid() OR id = public.my_community_id());
CREATE POLICY "Verified users can create a community" ON public.communities FOR INSERT TO authenticated
  WITH CHECK (creator_user_id = auth.uid() AND public.am_i_verified());
CREATE POLICY "Creator can update their community" ON public.communities FOR UPDATE TO authenticated
  USING (creator_user_id = auth.uid()) WITH CHECK (creator_user_id = auth.uid());
CREATE POLICY "Creator can delete their community" ON public.communities FOR DELETE TO authenticated
  USING (creator_user_id = auth.uid());

-- POLICIES: community_members (member sees only own row; creator sees all)
CREATE POLICY "Own row or creator can view members" ON public.community_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_community_creator(community_id));
CREATE POLICY "Creator can add self as member" ON public.community_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_community_creator(community_id));
CREATE POLICY "Leave or be removed by creator" ON public.community_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_community_creator(community_id));

-- POLICIES: community_invites
CREATE POLICY "Creator or invitee can view invites" ON public.community_invites FOR SELECT TO authenticated
  USING (public.is_community_creator(community_id) OR invited_mobile = public.my_normalized_mobile());
CREATE POLICY "Creator can invite" ON public.community_invites FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_community_creator(community_id) AND public.am_i_verified());
CREATE POLICY "Creator can cancel invites" ON public.community_invites FOR UPDATE TO authenticated
  USING (public.is_community_creator(community_id)) WITH CHECK (public.is_community_creator(community_id));
CREATE POLICY "Creator can delete invites" ON public.community_invites FOR DELETE TO authenticated
  USING (public.is_community_creator(community_id));

-- RPC: my community summary
CREATE OR REPLACE FUNCTION public.get_my_community()
RETURNS TABLE(community_id uuid, name text, creator_name text, member_count integer, is_creator boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id,
         c.name,
         COALESCE(p.full_name, 'Community owner'),
         (SELECT COUNT(*)::int FROM public.community_members m2 WHERE m2.community_id = c.id),
         (c.creator_user_id = auth.uid()),
         c.created_at
  FROM public.community_members m
  JOIN public.communities c ON c.id = m.community_id
  LEFT JOIN public.profiles p ON p.user_id = c.creator_user_id
  WHERE m.user_id = auth.uid()
  LIMIT 1;
$$;

-- RPC: create community (creates + adds creator as member)
CREATE OR REPLACE FUNCTION public.create_community(_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT public.am_i_verified() THEN RAISE EXCEPTION 'Please verify your account first'; END IF;
  IF COALESCE(TRIM(_name), '') = '' THEN RAISE EXCEPTION 'Community name is required'; END IF;
  IF EXISTS (SELECT 1 FROM public.community_members WHERE user_id = _uid) THEN
    RAISE EXCEPTION 'You already belong to a community';
  END IF;
  INSERT INTO public.communities (name, creator_user_id) VALUES (TRIM(_name), _uid) RETURNING id INTO _id;
  INSERT INTO public.community_members (community_id, user_id) VALUES (_id, _uid);
  RETURN _id;
END;
$$;

-- RPC: invite by mobile
CREATE OR REPLACE FUNCTION public.invite_to_community(_mobile text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  ORDER BY created_at LIMIT 1;

  IF _target.user_id IS NULL THEN RAISE EXCEPTION 'This mobile number is not registered on Pennyekart'; END IF;
  IF NOT COALESCE(_target.is_verified, false) THEN RAISE EXCEPTION 'This user has not verified their account yet'; END IF;
  IF EXISTS (SELECT 1 FROM public.community_members WHERE user_id = _target.user_id) THEN
    RAISE EXCEPTION 'This person already belongs to a community (ഈ ഉപയോക്താവ് ഇതിനകം ഒരു കമ്മ്യൂണിറ്റിയിൽ അംഗമാണ്)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.community_invites WHERE community_id = _cid AND invited_mobile = _norm AND status = 'pending') THEN
    RAISE EXCEPTION 'An invite is already pending for this number (ഈ നമ്പറിലേക്ക് ഇതിനകം ഒരു ക്ഷണം അയച്ചിട്ടുണ്ട്.)';
  END IF;

  INSERT INTO public.community_invites (community_id, invited_mobile, invited_user_id, created_by)
  VALUES (_cid, _norm, _target.user_id, _uid)
  RETURNING id INTO _invite_id;
  RETURN _invite_id;
END;
$$;

-- RPC: invites addressed to me
CREATE OR REPLACE FUNCTION public.get_my_community_invites()
RETURNS TABLE(invite_id uuid, community_id uuid, community_name text, creator_name text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, c.id, c.name, COALESCE(p.full_name, 'Community owner'), i.created_at
  FROM public.community_invites i
  JOIN public.communities c ON c.id = i.community_id
  LEFT JOIN public.profiles p ON p.user_id = c.creator_user_id
  WHERE i.status = 'pending'
    AND i.invited_mobile = public.my_normalized_mobile()
  ORDER BY i.created_at DESC;
$$;

-- RPC: respond to invite
CREATE OR REPLACE FUNCTION public.respond_to_community_invite(_invite_id uuid, _accept boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _inv record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO _inv FROM public.community_invites
  WHERE id = _invite_id AND status = 'pending' AND invited_mobile = public.my_normalized_mobile();
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'Invite not found or already handled'; END IF;

  IF NOT _accept THEN
    UPDATE public.community_invites SET status = 'declined' WHERE id = _inv.id;
    RETURN false;
  END IF;

  IF NOT public.am_i_verified() THEN RAISE EXCEPTION 'Please verify your account first'; END IF;
  IF EXISTS (SELECT 1 FROM public.community_members WHERE user_id = _uid) THEN
    RAISE EXCEPTION 'You already belong to a community';
  END IF;

  INSERT INTO public.community_members (community_id, user_id) VALUES (_inv.community_id, _uid);
  UPDATE public.community_invites SET status = 'accepted' WHERE id = _inv.id;
  RETURN true;
END;
$$;

-- RPC: creator member list
CREATE OR REPLACE FUNCTION public.get_community_members()
RETURNS TABLE(user_id uuid, full_name text, mobile_number text, joined_at timestamptz, is_creator boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id, p.full_name, p.mobile_number, m.joined_at, (c.creator_user_id = m.user_id)
  FROM public.communities c
  JOIN public.community_members m ON m.community_id = c.id
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE c.creator_user_id = auth.uid()
  ORDER BY (c.creator_user_id = m.user_id) DESC, m.joined_at;
$$;

-- RPC: pending invites for creator
CREATE OR REPLACE FUNCTION public.get_community_pending_invites()
RETURNS TABLE(invite_id uuid, invited_mobile text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.invited_mobile, i.created_at
  FROM public.community_invites i
  JOIN public.communities c ON c.id = i.community_id
  WHERE c.creator_user_id = auth.uid() AND i.status = 'pending'
  ORDER BY i.created_at DESC;
$$;

-- RPC: remove member (creator) / leave (self)
CREATE OR REPLACE FUNCTION public.remove_community_member(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _cid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT community_id INTO _cid FROM public.community_members WHERE user_id = _user_id;
  IF _cid IS NULL THEN RETURN false; END IF;
  IF NOT (_user_id = _uid OR public.is_community_creator(_cid)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.communities WHERE id = _cid AND creator_user_id = _user_id) THEN
    RAISE EXCEPTION 'The creator cannot leave their own community';
  END IF;
  DELETE FROM public.community_members WHERE user_id = _user_id;
  RETURN true;
END;
$$;

-- RPC: cancel invite
CREATE OR REPLACE FUNCTION public.cancel_community_invite(_invite_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  UPDATE public.community_invites i SET status = 'cancelled'
  WHERE i.id = _invite_id AND i.status = 'pending'
    AND EXISTS (SELECT 1 FROM public.communities c WHERE c.id = i.community_id AND c.creator_user_id = _uid);
  RETURN FOUND;
END;
$$;
