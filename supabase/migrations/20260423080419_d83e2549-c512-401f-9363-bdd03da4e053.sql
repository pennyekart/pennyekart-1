-- Scratch cards table
CREATE TABLE public.scratch_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  cover_image_url text,
  reveal_text text,
  reveal_image_url text,
  reward_amount numeric NOT NULL DEFAULT 0,
  target_audience text NOT NULL DEFAULT 'all', -- 'all' | 'agents' | 'panchayath'
  target_local_body_ids uuid[] DEFAULT '{}'::uuid[],
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  is_active boolean NOT NULL DEFAULT true,
  max_claims_per_user integer NOT NULL DEFAULT 1,
  requires_agent_streak_days integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scratch_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active scratch cards"
  ON public.scratch_cards FOR SELECT
  USING (
    (is_active = true AND now() BETWEEN start_at AND end_at)
    OR is_super_admin()
    OR has_permission('read_settings')
  );

CREATE POLICY "Admins can insert scratch cards"
  ON public.scratch_cards FOR INSERT
  WITH CHECK (is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Admins can update scratch cards"
  ON public.scratch_cards FOR UPDATE
  USING (is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Admins can delete scratch cards"
  ON public.scratch_cards FOR DELETE
  USING (is_super_admin() OR has_permission('read_settings'));

CREATE TRIGGER trg_scratch_cards_updated_at
  BEFORE UPDATE ON public.scratch_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Scratch card claims
CREATE TABLE public.scratch_card_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.scratch_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reward_amount numeric NOT NULL DEFAULT 0,
  wallet_tx_id uuid,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, user_id)
);

CREATE INDEX idx_scratch_claims_user ON public.scratch_card_claims(user_id);
CREATE INDEX idx_scratch_claims_card ON public.scratch_card_claims(card_id);

ALTER TABLE public.scratch_card_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own claims"
  ON public.scratch_card_claims FOR SELECT
  USING (auth.uid() = user_id OR is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Users can insert own claims"
  ON public.scratch_card_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_super_admin());
