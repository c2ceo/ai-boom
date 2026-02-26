
-- Track fal.ai credits per user
CREATE TABLE public.fal_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- One row per user, enforce uniqueness
CREATE UNIQUE INDEX idx_fal_credits_user_id ON public.fal_credits (user_id);

-- Enable RLS
ALTER TABLE public.fal_credits ENABLE ROW LEVEL SECURITY;

-- Users can view their own credits
CREATE POLICY "Users can view own credits"
ON public.fal_credits FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own credits row
CREATE POLICY "Users can insert own credits"
ON public.fal_credits FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role handles updates (via edge function), but users can read
-- Allow update by owner for edge function calls that pass the user JWT
CREATE POLICY "Users can update own credits"
ON public.fal_credits FOR UPDATE
USING (auth.uid() = user_id);
