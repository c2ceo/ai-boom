CREATE TABLE public.image_promotion (id boolean PRIMARY KEY DEFAULT true CHECK (id), free_reserved integer NOT NULL DEFAULT 0 CHECK (free_reserved BETWEEN 0 AND 1000000));
GRANT SELECT ON public.image_promotion TO authenticated;
GRANT ALL ON public.image_promotion TO service_role;
ALTER TABLE public.image_promotion ENABLE ROW LEVEL SECURITY;
CREATE POLICY promotion_read ON public.image_promotion FOR SELECT TO authenticated USING (id = true);
CREATE TABLE public.image_requests (id uuid PRIMARY KEY, user_id uuid NOT NULL, model text NOT NULL CHECK (model IN ('schnell','dev','pro','enhance')), credits integer NOT NULL DEFAULT 0, promotional boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')), image_url text, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.image_requests TO service_role;
ALTER TABLE public.image_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX image_requests_user_created ON public.image_requests(user_id, created_at DESC);
CREATE FUNCTION public.reserve_image_request(p_id uuid, p_user uuid, p_model text, p_max_credits integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.image_requests; n integer; price integer; promo boolean := false;
BEGIN
 IF p_model NOT IN ('schnell','dev','pro','enhance') OR p_user IS NULL THEN RAISE EXCEPTION 'Invalid image request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
 SELECT * INTO r FROM public.image_requests WHERE id=p_id;
 IF FOUND THEN
  IF r.user_id<>p_user OR r.model<>p_model THEN RAISE EXCEPTION 'Request mismatch'; END IF;
  RETURN to_jsonb(r) || jsonb_build_object('existing',true);
 END IF;
 IF EXISTS(SELECT 1 FROM public.image_requests WHERE user_id=p_user AND status='pending' AND created_at>now()-interval '5 minutes') THEN RAISE EXCEPTION 'An image request is already running'; END IF;
 IF (SELECT count(*) FROM public.image_requests WHERE user_id=p_user AND created_at>now()-interval '1 minute')>=10 THEN RAISE EXCEPTION 'Please wait before making more requests'; END IF;
 price := CASE p_model WHEN 'dev' THEN 5 WHEN 'pro' THEN 8 WHEN 'enhance' THEN 0 ELSE 1 END;
 IF p_model='schnell' THEN
  INSERT INTO public.image_promotion(id) VALUES(true) ON CONFLICT DO NOTHING;
  SELECT free_reserved INTO n FROM public.image_promotion WHERE id=true FOR UPDATE;
  IF n<1000000 THEN price:=0; promo:=true; END IF;
 END IF;
 IF price>p_max_credits THEN RAISE EXCEPTION 'Price changed; free images have run out. Confirm the 1-credit price and try again'; END IF;
 IF price>0 THEN
  UPDATE public.fal_credits SET credits_remaining=credits_remaining-price, updated_at=now() WHERE user_id=p_user AND credits_remaining>=price;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not enough credits'; END IF;
 END IF;
 IF promo THEN UPDATE public.image_promotion SET free_reserved=free_reserved+1 WHERE id=true; END IF;
 INSERT INTO public.image_requests(id,user_id,model,credits,promotional) VALUES(p_id,p_user,p_model,price,promo) RETURNING * INTO r;
 RETURN to_jsonb(r) || jsonb_build_object('existing',false);
END; $$;
REVOKE ALL ON FUNCTION public.reserve_image_request(uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_image_request(uuid,uuid,text,integer) TO service_role;
CREATE FUNCTION public.finish_image_request(p_id uuid, p_success boolean, p_url text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.image_requests;
BEGIN
 SELECT * INTO r FROM public.image_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'pending' THEN RETURN; END IF;
 IF NOT p_success THEN
  IF r.credits>0 THEN UPDATE public.fal_credits SET credits_remaining=credits_remaining+r.credits,updated_at=now() WHERE user_id=r.user_id; END IF;
  IF r.promotional THEN UPDATE public.image_promotion SET free_reserved=free_reserved-1 WHERE id=true; END IF;
 END IF;
 UPDATE public.image_requests SET status=CASE WHEN p_success THEN 'completed' ELSE 'failed' END,image_url=p_url WHERE id=p_id;
END; $$;
REVOKE ALL ON FUNCTION public.finish_image_request(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_image_request(uuid,boolean,text) TO service_role;