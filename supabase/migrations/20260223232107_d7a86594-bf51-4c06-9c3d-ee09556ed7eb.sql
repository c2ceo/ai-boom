
CREATE OR REPLACE FUNCTION public.get_personalized_explore(
  p_user_id uuid DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_family_friendly boolean DEFAULT false,
  p_limit integer DEFAULT 50
)
RETURNS SETOF public.posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH liked_categories AS (
    SELECT p.category, COUNT(*) AS cnt
    FROM likes l
    JOIN posts p ON p.id = l.post_id
    WHERE l.user_id = p_user_id
      AND p_user_id IS NOT NULL
    GROUP BY p.category
  ),
  liked_creators AS (
    SELECT p.user_id AS creator_id, COUNT(*) AS cnt
    FROM likes l
    JOIN posts p ON p.id = l.post_id
    WHERE l.user_id = p_user_id
      AND p_user_id IS NOT NULL
    GROUP BY p.user_id
  ),
  scored_posts AS (
    SELECT
      po.*,
      COALESCE(lc.cnt, 0) * 3 +
      COALESCE(lcr.cnt, 0) * 2 +
      po.likes_count * 0.1 +
      CASE WHEN po.created_at > now() - interval '7 days' THEN 5 ELSE 0 END +
      random() * 2
      AS score
    FROM posts po
    LEFT JOIN liked_categories lc ON lc.category = po.category
    LEFT JOIN liked_creators lcr ON lcr.creator_id = po.user_id
    WHERE po.status = 'approved'
      AND (p_category IS NULL OR po.category = p_category)
      AND (p_search IS NULL OR po.caption ILIKE '%' || p_search || '%')
      AND (p_family_friendly = false OR po.is_family_friendly = true)
  )
  SELECT sp.id, sp.user_id, sp.image_url, sp.video_url, sp.caption,
         sp.tags, sp.category, sp.ai_tool, sp.is_verified_ai,
         sp.likes_count, sp.comments_count, sp.created_at, sp.updated_at,
         sp.status, sp.voting_expires_at, sp.is_family_friendly, sp.views_count
  FROM scored_posts sp
  ORDER BY sp.score DESC
  LIMIT p_limit;
END;
$$;
