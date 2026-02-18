
-- Function to update follower/following counts based on actual follows table rows
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment followers_count for the user being followed
    UPDATE profiles SET followers_count = (
      SELECT COUNT(*) FROM follows WHERE following_id = NEW.following_id
    ) WHERE user_id = NEW.following_id;

    -- Increment following_count for the follower
    UPDATE profiles SET following_count = (
      SELECT COUNT(*) FROM follows WHERE follower_id = NEW.follower_id
    ) WHERE user_id = NEW.follower_id;

  ELSIF TG_OP = 'DELETE' THEN
    -- Recount followers_count for the user being unfollowed
    UPDATE profiles SET followers_count = (
      SELECT COUNT(*) FROM follows WHERE following_id = OLD.following_id
    ) WHERE user_id = OLD.following_id;

    -- Recount following_count for the unfollower
    UPDATE profiles SET following_count = (
      SELECT COUNT(*) FROM follows WHERE follower_id = OLD.follower_id
    ) WHERE user_id = OLD.follower_id;
  END IF;

  RETURN NULL;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_follow_change ON public.follows;

-- Create trigger on follows table
CREATE TRIGGER on_follow_change
AFTER INSERT OR DELETE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();

-- Recount all existing profiles to fix any drift
UPDATE profiles SET
  followers_count = (SELECT COUNT(*) FROM follows WHERE following_id = profiles.user_id),
  following_count = (SELECT COUNT(*) FROM follows WHERE follower_id = profiles.user_id);
