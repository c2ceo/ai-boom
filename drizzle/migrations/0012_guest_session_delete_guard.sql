CREATE OR REPLACE FUNCTION public.guard_signed_out_guest() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.role()='authenticated' AND EXISTS(SELECT 1 FROM visitor_admissions WHERE user_id=auth.uid() AND signed_out_at IS NOT NULL) THEN RAISE EXCEPTION 'Guest session has ended'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;