CREATE TABLE public.verified_media (
  media_url text PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.verified_media TO service_role;
ALTER TABLE public.verified_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages verified media" ON public.verified_media FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.video_jobs (
  request_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.video_jobs TO service_role;
ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages video jobs" ON public.video_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.guard_post_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE verified boolean;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS (SELECT 1 FROM verified_media v
      WHERE v.user_id = NEW.user_id AND v.media_url = coalesce(NEW.image_url, NEW.video_url)) INTO verified;
    NEW.is_verified_ai := verified;
    NEW.likes_count := 0; NEW.comments_count := 0; NEW.views_count := 0;
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
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER guard_post_fields BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_post_fields();

CREATE OR REPLACE FUNCTION public.sync_post_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := coalesce(NEW.post_id, OLD.post_id);
BEGIN
  UPDATE posts SET likes_count = (SELECT count(*) FROM likes WHERE post_id = pid) WHERE id = pid;
  RETURN NULL;
END; $$;
CREATE TRIGGER sync_post_like_count AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_like_count();

CREATE OR REPLACE FUNCTION public.sync_post_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := coalesce(NEW.post_id, OLD.post_id);
BEGIN
  UPDATE posts SET comments_count = (SELECT count(*) FROM comments WHERE post_id = pid) WHERE id = pid;
  RETURN NULL;
END; $$;
CREATE TRIGGER sync_post_comment_count AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_comment_count();

CREATE OR REPLACE FUNCTION public.record_post_view(p_post_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE posts SET views_count = views_count + 1 WHERE id = p_post_id AND public.can_view_post(p_post_id);
$$;
GRANT EXECUTE ON FUNCTION public.record_post_view(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_count(text, text, uuid, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_personalized_explore(p_user_id uuid DEFAULT NULL::uuid, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_family_friendly boolean DEFAULT false, p_limit integer DEFAULT 50)
 RETURNS SETOF posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid();
BEGIN
  RETURN QUERY
  WITH liked_categories AS (
    SELECT p.category, COUNT(*) AS cnt FROM likes l JOIN posts p ON p.id = l.post_id
    WHERE l.user_id = me AND me IS NOT NULL GROUP BY p.category
  ),
  liked_creators AS (
    SELECT p.user_id AS creator_id, COUNT(*) AS cnt FROM likes l JOIN posts p ON p.id = l.post_id
    WHERE l.user_id = me AND me IS NOT NULL GROUP BY p.user_id
  ),
  scored_posts AS (
    SELECT po.*,
      COALESCE(lc.cnt, 0) * 3 + COALESCE(lcr.cnt, 0) * 2 + po.likes_count * 0.1 +
      CASE WHEN po.created_at > now() - interval '7 days' THEN 5 ELSE 0 END + random() * 2 AS score
    FROM posts po
    LEFT JOIN liked_categories lc ON lc.category = po.category
    LEFT JOIN liked_creators lcr ON lcr.creator_id = po.user_id
    LEFT JOIN profiles pr ON pr.user_id = po.user_id
    WHERE po.status = 'approved'
      AND (p_category IS NULL OR po.category = p_category)
      AND (p_search IS NULL OR po.caption ILIKE '%' || p_search || '%')
      AND (p_family_friendly = false OR po.is_family_friendly = true)
      AND (pr.is_private = false OR po.user_id = me
        OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = me AND f.following_id = po.user_id))
  )
  SELECT sp.id, sp.user_id, sp.image_url, sp.video_url, sp.caption,
         sp.tags, sp.category, sp.ai_tool, sp.is_verified_ai,
         sp.likes_count, sp.comments_count, sp.created_at, sp.updated_at,
         sp.status, sp.voting_expires_at, sp.is_family_friendly, sp.views_count,
         sp.allow_evolve, sp.shared_prompt
  FROM scored_posts sp ORDER BY sp.score DESC LIMIT p_limit;
END;
$function$;