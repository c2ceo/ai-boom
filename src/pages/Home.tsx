import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FeedCard from "@/components/FeedCard";
import { Sparkles } from "lucide-react";

type PostWithProfile = {
  id: string;
  image_url: string | null;
  video_url: string | null;
  caption: string | null;
  ai_tool: string;
  is_verified_ai: boolean;
  likes_count: number;
  comments_count: number;
  category: string;
  user_id: string;
  profile?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
};

const Home = () => {
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchPosts();
  }, [user]);

  const fetchPosts = async () => {
    const { data: postsData } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (postsData && postsData.length > 0) {
      // Fetch profiles for all post user_ids
      const userIds = [...new Set(postsData.map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

      const merged = postsData.map((p) => ({
        ...p,
        profile: profileMap.get(p.user_id) || undefined,
      }));

      setPosts(merged);

      // Fetch user's likes
      if (user) {
        const { data: likes } = await supabase
          .from("likes")
          .select("post_id")
          .eq("user_id", user.id);
        setLikedPosts(new Set(likes?.map((l) => l.post_id)));
      }
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Sparkles className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <Sparkles className="h-12 w-12 text-primary" />
        <h2 className="text-xl font-bold">No posts yet</h2>
        <p className="text-muted-foreground">Be the first to share AI-generated content!</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-scroll snap-y-mandatory hide-scrollbar">
      {posts.map((post) => (
        <FeedCard
          key={post.id}
          post={post}
          profile={post.profile}
          isLiked={likedPosts.has(post.id)}
        />
      ))}
    </div>
  );
};

export default Home;
