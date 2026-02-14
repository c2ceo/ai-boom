import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import FeedCard from "@/components/FeedCard";

const PostView = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (postId) fetchPost();
  }, [postId]);

  const fetchPost = async () => {
    const { data: postData } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId!)
      .single();

    if (!postData) {
      setLoading(false);
      return;
    }
    setPost(postData);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("user_id", postData.user_id)
      .single();
    setProfile(profileData);

    if (user) {
      const { data: likeData } = await supabase
        .from("likes")
        .select("id")
        .eq("user_id", user.id)
        .eq("post_id", postId!)
        .maybeSingle();
      setIsLiked(!!likeData);
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

  if (!post) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Post not found</p>
        <Button variant="ghost" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-10 flex items-center gap-2 p-3 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold">Post</span>
      </div>
      <div className="h-[calc(100vh-4rem)]">
        <FeedCard
          post={post}
          profile={profile || undefined}
          isLiked={isLiked}
          onLikeToggle={fetchPost}
        />
      </div>
    </div>
  );
};

export default PostView;
