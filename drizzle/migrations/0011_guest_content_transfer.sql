CREATE TABLE public.platform_content_owner (id boolean PRIMARY KEY DEFAULT true CHECK (id), user_id uuid NOT NULL UNIQUE);
GRANT ALL ON public.platform_content_owner TO service_role;
ALTER TABLE public.platform_content_owner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_admissions ADD COLUMN signed_out_at timestamptz;
ALTER TABLE public.posts ADD COLUMN guest_transferred_at timestamptz;
CREATE OR REPLACE FUNCTION public.transfer_guest_content(p_guest uuid, p_media jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_guest::text));
 IF NOT EXISTS(SELECT 1 FROM visitor_admissions WHERE user_id=p_guest AND is_guest) THEN RAISE EXCEPTION 'Guest account required'; END IF;
 SELECT user_id INTO owner_id FROM platform_content_owner WHERE id=true;
 IF owner_id IS NULL OR owner_id=p_guest THEN RAISE EXCEPTION 'Platform owner unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM posts WHERE user_id=p_guest AND (is_private OR video_url IS NOT NULL)) THEN RAISE EXCEPTION 'Unexpected guest media'; END IF;
 IF EXISTS(SELECT 1 FROM posts WHERE user_id=p_guest AND image_url IS NOT NULL AND NOT (p_media ? image_url)) THEN RAISE EXCEPTION 'Media transfer incomplete'; END IF;
 UPDATE posts SET user_id=owner_id, image_url=CASE WHEN image_url IS NULL THEN NULL ELSE p_media->>image_url END, guest_transferred_at=now() WHERE user_id=p_guest;
 UPDATE comments SET user_id=owner_id WHERE user_id=p_guest;
 UPDATE remixes SET user_id=owner_id WHERE user_id=p_guest;
 UPDATE profiles SET posts_count=(SELECT count(*) FROM posts WHERE user_id=owner_id) WHERE user_id=owner_id;
 UPDATE visitor_admissions SET signed_out_at=coalesce(signed_out_at,now()) WHERE user_id=p_guest;
 RETURN owner_id;
END; $$;
REVOKE ALL ON FUNCTION public.transfer_guest_content(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_guest_content(uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.guard_signed_out_guest() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.role()='authenticated' AND EXISTS(SELECT 1 FROM visitor_admissions WHERE user_id=auth.uid() AND signed_out_at IS NOT NULL) THEN RAISE EXCEPTION 'Guest session has ended'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guest_session_posts BEFORE INSERT OR UPDATE OR DELETE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.guard_signed_out_guest();
CREATE TRIGGER guest_session_comments BEFORE INSERT OR UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.guard_signed_out_guest();