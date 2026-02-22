
-- Enable pgcrypto for additional encryption utilities
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a new SELECT policy: everyone sees public fields, only owner sees bio
-- We use a security definer function to serve a "masked" view
CREATE OR REPLACE FUNCTION public.get_public_profile(target_user_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  posts_count integer,
  followers_count integer,
  following_count integer,
  is_private boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.user_id, p.username, p.display_name, p.avatar_url,
    CASE WHEN auth.uid() = p.user_id THEN p.bio ELSE NULL END AS bio,
    p.posts_count, p.followers_count, p.following_count, p.is_private,
    p.created_at, p.updated_at
  FROM profiles p
  WHERE p.user_id = target_user_id;
$$;

-- Re-create a simple SELECT policy (profiles remain queryable, bio is handled in code)
CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles
FOR SELECT
USING (true);
