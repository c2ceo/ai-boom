CREATE OR REPLACE FUNCTION public.reserve_joke(p_id uuid,p_user uuid,p_quote numeric,p_max_credits integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r joke_requests;b joke_budget;price integer;promo boolean; BEGIN
 IF p_quote<=0 OR p_quote>0.2 THEN RAISE EXCEPTION 'Invalid joke cost'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 SELECT * INTO r FROM joke_requests WHERE id=p_id; IF FOUND THEN IF r.user_id<>p_user THEN RAISE EXCEPTION 'Request mismatch'; END IF; RETURN to_jsonb(r)||jsonb_build_object('existing',true); END IF;
 IF EXISTS(SELECT 1 FROM joke_requests WHERE user_id=p_user AND status='pending') THEN RAISE EXCEPTION 'A joke is already being written'; END IF;
 INSERT INTO joke_budget(id) VALUES(true) ON CONFLICT DO NOTHING; SELECT * INTO b FROM joke_budget WHERE id FOR UPDATE;
 promo:=b.spent_usd+b.reserved_usd+p_quote<=1000;
 IF NOT promo AND b.spent_usd+p_quote<=1000 THEN RAISE EXCEPTION 'Wait for pending jokes to finish'; END IF;
 price:=CASE WHEN promo THEN 0 ELSE ceil(p_quote*3.2/0.0124)::integer END;
 IF price>p_max_credits THEN RAISE EXCEPTION 'Confirm the current credit quote'; END IF;
 IF price>0 THEN UPDATE fal_credits SET credits_remaining=credits_remaining-price WHERE user_id=p_user AND credits_remaining>=price; IF NOT FOUND THEN RAISE EXCEPTION 'Not enough credits'; END IF; END IF;
 IF promo THEN UPDATE joke_budget SET reserved_usd=reserved_usd+p_quote WHERE id; END IF;
 INSERT INTO joke_requests(id,user_id,quote_usd,credits,promotional) VALUES(p_id,p_user,p_quote,price,promo) RETURNING * INTO r;
 RETURN to_jsonb(r)||jsonb_build_object('existing',false); END; $$;