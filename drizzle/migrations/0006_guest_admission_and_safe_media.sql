CREATE TABLE public.visitor_admissions (user_id uuid PRIMARY KEY, age_verified_at timestamptz NOT NULL DEFAULT now(), is_guest boolean NOT NULL DEFAULT false);
GRANT SELECT ON public.visitor_admissions TO authenticated;
GRANT ALL ON public.visitor_admissions TO service_role;
ALTER TABLE public.visitor_admissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_admission ON public.visitor_admissions FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE TABLE public.safe_media (media_url text PRIMARY KEY, user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.safe_media TO service_role;
ALTER TABLE public.safe_media ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.confirm_visitor_age(p_birthday date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 IF p_birthday IS NULL OR p_birthday < date '1900-01-01' OR p_birthday > (current_date - interval '13 years')::date THEN RAISE EXCEPTION 'You must be at least 13 years old'; END IF;
 INSERT INTO public.visitor_admissions(user_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.confirm_visitor_age(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_visitor_age(date) TO authenticated;
CREATE FUNCTION public.guard_guest_post() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.role()='authenticated' AND EXISTS(SELECT 1 FROM public.visitor_admissions WHERE user_id=auth.uid() AND is_guest) THEN
  IF NOT EXISTS(SELECT 1 FROM public.safe_media WHERE user_id=auth.uid() AND media_url=NEW.image_url) OR NEW.video_url IS NOT NULL THEN RAISE EXCEPTION 'Guest posts require a completed image safety check'; END IF;
  NEW.is_family_friendly := true;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_guest_post BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.guard_guest_post();