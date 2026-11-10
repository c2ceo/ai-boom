CREATE OR REPLACE FUNCTION public.guard_guest_post()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN
 IF NEW.is_private AND (NEW.image_url IS NOT NULL AND NEW.image_url NOT LIKE 'private-media:'||NEW.user_id::text||'/%' OR NEW.video_url IS NOT NULL AND NEW.video_url NOT LIKE 'private-media:'||NEW.user_id::text||'/%') THEN RAISE EXCEPTION 'Private posts require private storage'; END IF;
 IF auth.role()='authenticated' AND EXISTS(SELECT 1 FROM visitor_admissions WHERE user_id=auth.uid() AND is_guest) THEN
  IF NEW.is_private THEN RAISE EXCEPTION 'Guest accounts cannot make private posts'; END IF;
  IF NEW.video_url IS NOT NULL THEN RAISE EXCEPTION 'Guest posts require a completed image safety check'; END IF;
  IF NEW.image_url IS NULL THEN
   IF NOT EXISTS(SELECT 1 FROM joke_requests WHERE user_id=auth.uid() AND status='completed' AND joke=NEW.caption) THEN RAISE EXCEPTION 'Guest joke posts must use a safe AI joke'; END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM safe_media WHERE user_id=auth.uid() AND media_url=NEW.image_url) THEN RAISE EXCEPTION 'Guest posts require a completed image safety check'; END IF;
  NEW.is_family_friendly:=true;
 END IF; RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.guard_post_fields()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE verified boolean;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.likes_count := 0; NEW.comments_count := 0; NEW.views_count := 0;
    IF NEW.image_url IS NULL AND NEW.video_url IS NULL THEN
      IF NOT EXISTS(SELECT 1 FROM joke_requests j WHERE j.user_id=NEW.user_id AND j.status='completed' AND j.joke=NEW.caption) THEN
        RAISE EXCEPTION 'Text posts must use a safe AI joke';
      END IF;
      NEW.is_verified_ai := true; NEW.is_family_friendly := true; NEW.category := 'ai-joke';
      NEW.status := 'approved'; NEW.voting_expires_at := NULL; NEW.shared_prompt := NULL;
      RETURN NEW;
    END IF;
    SELECT EXISTS (SELECT 1 FROM verified_media v
      WHERE v.user_id = NEW.user_id AND v.media_url = coalesce(NEW.image_url, NEW.video_url)) INTO verified;
    NEW.is_verified_ai := verified;
    IF verified OR NEW.video_url IS NOT NULL THEN
      NEW.status := 'approved'; NEW.voting_expires_at := NULL;
    ELSE
      NEW.status := 'pending_review'; NEW.voting_expires_at := now() + interval '24 hours';
    END IF;
  ELSE
    NEW.is_verified_ai := OLD.is_verified_ai;
    NEW.status := OLD.status;
    NEW.voting_expires_at := OLD.voting_expires_at;
    NEW.likes_count := OLD.likes_count;
    NEW.comments_count := OLD.comments_count;
    NEW.views_count := OLD.views_count;
    NEW.user_id := OLD.user_id;
    NEW.image_url := OLD.image_url;
    NEW.video_url := OLD.video_url;
    IF OLD.image_url IS NULL AND OLD.video_url IS NULL THEN
      NEW.caption := OLD.caption; NEW.is_family_friendly := true; NEW.category := OLD.category;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;