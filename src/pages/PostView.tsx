import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Sparkles, MoreHorizontal, Trash2, Archive, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import FeedCard from "@/components/FeedCard";
import CommentSheet from "@/components/CommentSheet";

const PostView = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [post, setPost] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentOpen, setCommentOpen] = useState(false);

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

  const handleDelete = async () => {
    if (!post || post.user_id !== user?.id) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete post", variant: "destructive" });
    } else {
      toast({ title: "Post deleted" });
      navigate(-1);
    }
  };

  const handleArchive = () => {
    toast({ title: "Archived", description: "Post archived (coming soon)" });
  };

  const handleRepost = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    toast({ title: "Link copied!", description: "Share it to repost" });
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

  const isOwner = user?.id === post.user_id;

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-semibold">Post</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleRepost}>
              <Repeat2 className="mr-2 h-4 w-4" />
              Repost
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleArchive}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
            {isOwner && (
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="h-[calc(100vh-4rem)]">
        <FeedCard
          post={post}
          profile={profile || undefined}
          isLiked={isLiked}
          onLikeToggle={fetchPost}
          onComment={() => setCommentOpen(true)}
        />
      </div>
      <CommentSheet
        postId={post.id}
        open={commentOpen}
        onOpenChange={setCommentOpen}
      />
    </div>
  );
};

export default PostView;
