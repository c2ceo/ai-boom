ALTER TABLE public.posts ADD COLUMN is_private boolean NOT NULL DEFAULT false;
CREATE POLICY private_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='private-media' AND (storage.foldername(name))[1]=auth.uid()::text) WITH CHECK(bucket_id='private-media' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE OR REPLACE FUNCTION public.can_view_post(_post uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM posts p WHERE p.id=_post AND (p.user_id=auth.uid() OR (NOT p.is_private AND p.status IN ('approved','pending_review') AND public.can_view_user(p.user_id)))); $$;
DROP POLICY IF EXISTS "Posts are viewable when approved, pending review, or by owner" ON public.posts;
CREATE POLICY visible_posts ON public.posts FOR SELECT USING(public.can_view_post(id));
CREATE OR REPLACE FUNCTION public.get_personalized_explore(p_user_id uuid DEFAULT NULL,p_category text DEFAULT NULL,p_search text DEFAULT NULL,p_family_friendly boolean DEFAULT false,p_limit integer DEFAULT 50) RETURNS SETOF public.posts LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT p.* FROM posts p WHERE p.status='approved' AND NOT p.is_private AND public.can_view_post(p.id) AND (p_category IS NULL OR p.category=p_category) AND (p_search IS NULL OR p.caption ILIKE '%'||p_search||'%') AND (NOT p_family_friendly OR p.is_family_friendly) ORDER BY p.likes_count*0.1 + CASE WHEN p.created_at>now()-interval '7 days' THEN 5 ELSE 0 END+random()*2 DESC LIMIT least(greatest(p_limit,0),100); $$;
CREATE OR REPLACE FUNCTION public.guard_guest_post() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.is_private AND (NEW.image_url IS NOT NULL AND NEW.image_url NOT LIKE 'private-media:'||NEW.user_id::text||'/%' OR NEW.video_url IS NOT NULL AND NEW.video_url NOT LIKE 'private-media:'||NEW.user_id::text||'/%') THEN RAISE EXCEPTION 'Private posts require private storage'; END IF;
 IF auth.role()='authenticated' AND EXISTS(SELECT 1 FROM visitor_admissions WHERE user_id=auth.uid() AND is_guest) THEN
  IF NEW.is_private THEN RAISE EXCEPTION 'Guest accounts cannot make private posts'; END IF;
  IF NOT EXISTS(SELECT 1 FROM safe_media WHERE user_id=auth.uid() AND media_url=NEW.image_url) OR NEW.video_url IS NOT NULL THEN RAISE EXCEPTION 'Guest posts require a completed image safety check'; END IF;
  NEW.is_family_friendly:=true;
 END IF; RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.reserve_image_request(p_id uuid,p_user uuid,p_model text,p_max_credits integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r image_requests; n integer; price integer; promo boolean:=false; guest boolean;
BEGIN
 IF p_model NOT IN ('schnell','dev','pro','enhance') OR p_user IS NULL THEN RAISE EXCEPTION 'Invalid image request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 SELECT * INTO r FROM image_requests WHERE id=p_id;
 IF FOUND THEN IF r.user_id<>p_user OR r.model<>p_model THEN RAISE EXCEPTION 'Request mismatch'; END IF; RETURN to_jsonb(r)||jsonb_build_object('existing',true); END IF;
 SELECT EXISTS(SELECT 1 FROM visitor_admissions WHERE user_id=p_user AND is_guest) INTO guest;
 IF guest AND EXISTS(SELECT 1 FROM image_requests r WHERE r.user_id=p_user AND r.model<>'enhance' AND r.status='completed' AND NOT EXISTS(SELECT 1 FROM posts p WHERE p.user_id=p_user AND p.image_url=r.image_url)) THEN RAISE EXCEPTION 'To retry or change a prompt while on a guest account, first publish the image you created.'; END IF;
 IF guest AND p_model NOT IN ('schnell','enhance') THEN RAISE EXCEPTION 'Guests may only use free Fast images'; END IF;
 IF EXISTS(SELECT 1 FROM image_requests WHERE user_id=p_user AND status='pending' AND created_at>now()-interval '5 minutes') THEN RAISE EXCEPTION 'An image request is already running'; END IF;
 IF (SELECT count(*) FROM image_requests WHERE user_id=p_user AND created_at>now()-interval '1 minute')>=10 THEN RAISE EXCEPTION 'Please wait before making more requests'; END IF;
 price:=CASE p_model WHEN 'dev' THEN 7 WHEN 'pro' THEN 11 WHEN 'enhance' THEN 0 ELSE 1 END;
 IF p_model='schnell' THEN INSERT INTO image_promotion(id) VALUES(true) ON CONFLICT DO NOTHING; SELECT free_reserved INTO n FROM image_promotion WHERE id=true FOR UPDATE; IF n<1000000 THEN price:=0;promo:=true; END IF; END IF;
 IF guest AND price>0 THEN RAISE EXCEPTION 'The free image promotion has ended'; END IF;
 IF price>p_max_credits THEN RAISE EXCEPTION 'Price changed; confirm the current price'; END IF;
 IF price>0 THEN UPDATE fal_credits SET credits_remaining=credits_remaining-price,updated_at=now() WHERE user_id=p_user AND credits_remaining>=price; IF NOT FOUND THEN RAISE EXCEPTION 'Not enough credits'; END IF; END IF;
 IF promo THEN UPDATE image_promotion SET free_reserved=free_reserved+1 WHERE id=true; END IF;
 INSERT INTO image_requests(id,user_id,model,credits,promotional) VALUES(p_id,p_user,p_model,price,promo) RETURNING * INTO r;
 RETURN to_jsonb(r)||jsonb_build_object('existing',false);
END; $$;
CREATE FUNCTION public.pending_guest_image() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('image_url',r.image_url) FROM image_requests r WHERE r.user_id=auth.uid() AND r.status='completed' AND r.model<>'enhance' AND EXISTS(SELECT 1 FROM visitor_admissions WHERE user_id=auth.uid() AND is_guest) AND NOT EXISTS(SELECT 1 FROM posts p WHERE p.user_id=auth.uid() AND p.image_url=r.image_url) ORDER BY r.created_at DESC LIMIT 1; $$;
REVOKE ALL ON FUNCTION public.pending_guest_image() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pending_guest_image() TO authenticated;
CREATE TABLE public.joke_budget(id boolean PRIMARY KEY DEFAULT true CHECK(id),spent_usd numeric NOT NULL DEFAULT 0,reserved_usd numeric NOT NULL DEFAULT 0);
GRANT SELECT ON public.joke_budget TO authenticated; GRANT ALL ON public.joke_budget TO service_role; ALTER TABLE public.joke_budget ENABLE ROW LEVEL SECURITY;
CREATE POLICY joke_budget_read ON public.joke_budget FOR SELECT TO authenticated USING(id);
CREATE TABLE public.joke_requests(id uuid PRIMARY KEY,user_id uuid NOT NULL,quote_usd numeric NOT NULL,actual_usd numeric,credits integer NOT NULL DEFAULT 0,promotional boolean NOT NULL,status text NOT NULL DEFAULT 'pending',joke text,created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.joke_requests TO service_role; ALTER TABLE public.joke_requests ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.reserve_joke(p_id uuid,p_user uuid,p_quote numeric,p_max_credits integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r joke_requests;b joke_budget;price integer;promo boolean; BEGIN
 IF p_quote<=0 OR p_quote>0.2 THEN RAISE EXCEPTION 'Invalid joke cost'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 SELECT * INTO r FROM joke_requests WHERE id=p_id; IF FOUND THEN IF r.user_id<>p_user THEN RAISE EXCEPTION 'Request mismatch'; END IF; RETURN to_jsonb(r)||jsonb_build_object('existing',true); END IF;
 IF EXISTS(SELECT 1 FROM joke_requests WHERE user_id=p_user AND status='pending') THEN RAISE EXCEPTION 'A joke is already being written'; END IF;
 INSERT INTO joke_budget(id) VALUES(true) ON CONFLICT DO NOTHING; SELECT * INTO b FROM joke_budget WHERE id FOR UPDATE;
 promo:=b.spent_usd+b.reserved_usd+p_quote<=1000;
 IF NOT promo AND b.spent_usd<1000 THEN RAISE EXCEPTION 'Please shorten the prompt or wait for pending jokes to finish'; END IF;
 price:=CASE WHEN promo THEN 0 ELSE ceil(p_quote*3.2/0.0124)::integer END;
 IF price>p_max_credits THEN RAISE EXCEPTION 'Confirm the current credit quote'; END IF;
 IF price>0 THEN UPDATE fal_credits SET credits_remaining=credits_remaining-price WHERE user_id=p_user AND credits_remaining>=price; IF NOT FOUND THEN RAISE EXCEPTION 'Not enough credits'; END IF; END IF;
 IF promo THEN UPDATE joke_budget SET reserved_usd=reserved_usd+p_quote WHERE id; END IF;
 INSERT INTO joke_requests(id,user_id,quote_usd,credits,promotional) VALUES(p_id,p_user,p_quote,price,promo) RETURNING * INTO r;
 RETURN to_jsonb(r)||jsonb_build_object('existing',false); END; $$;
CREATE FUNCTION public.finish_joke(p_id uuid,p_actual numeric,p_joke text,p_success boolean) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r joke_requests;price integer; BEGIN
 SELECT * INTO r FROM joke_requests WHERE id=p_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Unknown joke'; END IF; IF r.status<>'pending' THEN RETURN r.credits; END IF;
 IF p_actual<0 OR p_actual>r.quote_usd THEN RAISE EXCEPTION 'Invalid settled cost'; END IF;
 price:=CASE WHEN NOT p_success OR r.promotional THEN 0 ELSE ceil(p_actual*3.2/0.0124)::integer END;
 IF r.promotional THEN UPDATE joke_budget SET reserved_usd=reserved_usd-r.quote_usd,spent_usd=spent_usd+p_actual WHERE id; END IF;
 IF r.credits>price THEN UPDATE fal_credits SET credits_remaining=credits_remaining+r.credits-price WHERE user_id=r.user_id; END IF;
 UPDATE joke_requests SET actual_usd=p_actual,credits=price,joke=CASE WHEN p_success THEN p_joke ELSE NULL END,status=CASE WHEN p_success THEN 'completed' ELSE 'failed' END WHERE id=p_id;
 RETURN price; END; $$;
REVOKE ALL ON FUNCTION public.reserve_joke(uuid,uuid,numeric,integer),public.finish_joke(uuid,numeric,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_joke(uuid,uuid,numeric,integer),public.finish_joke(uuid,numeric,text,boolean) TO service_role;