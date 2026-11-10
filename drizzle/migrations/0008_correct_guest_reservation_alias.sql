CREATE OR REPLACE FUNCTION public.reserve_image_request(p_id uuid,p_user uuid,p_model text,p_max_credits integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r image_requests; n integer; price integer; promo boolean:=false; guest boolean;
BEGIN
 IF p_model NOT IN ('schnell','dev','pro','enhance') OR p_user IS NULL THEN RAISE EXCEPTION 'Invalid image request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 SELECT * INTO r FROM image_requests WHERE id=p_id;
 IF FOUND THEN IF r.user_id<>p_user OR r.model<>p_model THEN RAISE EXCEPTION 'Request mismatch'; END IF; RETURN to_jsonb(r)||jsonb_build_object('existing',true); END IF;
 SELECT EXISTS(SELECT 1 FROM visitor_admissions WHERE user_id=p_user AND is_guest) INTO guest;
 IF guest AND EXISTS(SELECT 1 FROM image_requests ir WHERE ir.user_id=p_user AND ir.model<>'enhance' AND ir.status='completed' AND NOT EXISTS(SELECT 1 FROM posts p WHERE p.user_id=p_user AND p.image_url=ir.image_url)) THEN RAISE EXCEPTION 'To retry or change a prompt while on a guest account, first publish the image you created.'; END IF;
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