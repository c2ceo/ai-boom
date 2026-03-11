import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FeedCard from "@/components/FeedCard";
import CommentSheet from "@/components/CommentSheet";
import { Sparkles, ShieldCheck, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

type MediaFilter = "all" | "photos" | "videos";

const Home = () => {
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [familyFriendly, setFamilyFriendly] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDelete = async (postId: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast({ title: "Post deleted" });
    }
  };

  const handleEdit = (postId: string) => {
    navigate(`/post/${postId}`);
  };

  const handleArchive = () => {
    toast({ title: "Archived", description: "Post archived (coming soon)" });
  };

  useEffect(() => {
    fetchPosts();
  }, [user, familyFriendly]);

  const fetchPosts = async () => {
    const { data: postsData } = await supabase.rpc("get_personalized_explore", {
      p_user_id: user?.id ?? undefined,
      p_family_friendly: familyFriendly,
      p_limit: 50,
    });

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
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Fixed header controls */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 space-y-2 bg-background z-20">
        <div className="flex justify-center">
          <div className="flex items-center gap-1 bg-muted rounded-full px-1 py-1">
            {(["all", "photos", "videos"] as MediaFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setMediaFilter(filter)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  mediaFilter === filter
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter === "all" ? "All Media" : filter === "photos" ? "Photos" : "Videos"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-background/60 backdrop-blur-sm rounded-full px-3 py-1.5">
            <Switch id="ff-home" checked={familyFriendly} onCheckedChange={setFamilyFriendly} />
            <Label htmlFor="ff-home" className="flex items-center gap-1 text-sm font-semibold cursor-pointer text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" /> {familyFriendly ? "Family Friendly" : "Unfriendly"}
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5"
            onClick={() => navigate("/subscribe")}
          >
            <Crown className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Buy Credits</span>
          </Button>
        </div>
      </div>

      {/* Scrollable feed */}
      <div className="flex-1 overflow-y-scroll snap-y snap-mandatory hide-scrollbar scroll-smooth" style={{ scrollSnapStop: 'always' }}>
      {posts
        .filter((post) => {
          if (mediaFilter === "photos") return !!post.image_url && !post.video_url;
          if (mediaFilter === "videos") return !!post.video_url;
          return true;
        })
        .map((post) => (
          <FeedCard
            key={post.id}
            post={post}
            profile={post.profile}
            isLiked={likedPosts.has(post.id)}
            onComment={(postId) => setCommentPostId(postId)}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onArchive={() => handleArchive()}
          />
        ))}
      {commentPostId && (
        <CommentSheet
          postId={commentPostId}
          open={!!commentPostId}
          onOpenChange={(open) => !open && setCommentPostId(null)}
        />
      )}
      </div>
    </div>
  );
};

export default Home;
