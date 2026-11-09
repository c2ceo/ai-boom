ALTER POLICY "Service role manages subscriptions" ON public.subscriptions TO service_role;
ALTER POLICY "Service role manages free generations" ON public.free_generations TO service_role;
GRANT SELECT ON public.subscriptions, public.free_generations TO authenticated;
GRANT ALL ON public.subscriptions, public.free_generations TO service_role;
REVOKE ALL ON public.subscriptions, public.free_generations FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions, public.free_generations FROM authenticated;