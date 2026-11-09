CREATE TABLE public.stripe_credit_purchases (
  session_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stripe_credit_purchases TO authenticated;
GRANT ALL ON public.stripe_credit_purchases TO service_role;
ALTER TABLE public.stripe_credit_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyers read own purchases" ON public.stripe_credit_purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);
GRANT SELECT ON public.fal_credits TO authenticated;
GRANT ALL ON public.fal_credits TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.fal_credits FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.fulfill_stripe_credits(p_session_id text, p_user_id uuid, p_credits integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted_count integer;
BEGIN
  IF p_session_id IS NULL OR p_session_id NOT LIKE 'cs_%' OR p_user_id IS NULL OR p_credits IS NULL OR p_credits <= 0 OR p_credits > 10000 THEN
    RAISE EXCEPTION 'Invalid purchase';
  END IF;
  INSERT INTO public.stripe_credit_purchases(session_id, user_id, credits)
  VALUES (p_session_id, p_user_id, p_credits) ON CONFLICT (session_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 0 THEN RETURN false; END IF;
  INSERT INTO public.fal_credits(user_id, credits_remaining, total_purchased)
  VALUES (p_user_id, p_credits, p_credits)
  ON CONFLICT (user_id) DO UPDATE SET
    credits_remaining = public.fal_credits.credits_remaining + EXCLUDED.credits_remaining,
    total_purchased = public.fal_credits.total_purchased + EXCLUDED.total_purchased,
    updated_at = now();
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.fulfill_stripe_credits(text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_stripe_credits(text, uuid, integer) TO service_role;