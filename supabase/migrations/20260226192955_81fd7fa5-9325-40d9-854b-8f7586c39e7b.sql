
-- Track monthly free generations for eligible accounts
CREATE TABLE public.free_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month TEXT NOT NULL, -- format: 'YYYY-MM'
  generations_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE public.free_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own free generations"
  ON public.free_generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages free generations"
  ON public.free_generations FOR ALL
  USING (true)
  WITH CHECK (true);
