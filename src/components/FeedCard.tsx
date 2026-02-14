import { useState } from "react";
import { Heart, MessageCircle, Share2, Flag, Verified } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface FeedCardProps {
  post: {
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
  };
  profile?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  isLiked?: boolean;
  onLikeToggle?: () => void;
  onComment?: () => void;
}

const FeedCard = ({ post, profile, isLiked = false, onLikeToggle, onComment }: FeedCardProps) => {
  const [showHeart, setShowHeart] = useState(false);
  const [liked, setLiked] = useState(isLiked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleDoubleTap = async () => {
    if (!user) return;
    if (!liked) {
      setLiked(true);
      setLikesCount((c) => c + 1);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
      await supabase.from("likes").insert({ user_id: user.id, post_id: post.id });
      onLikeToggle?.();
    } else {
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
    }
  };

  const handleLikeButton = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false);
      setLikesCount((c) => c - 1);
      await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", post.id);
    } else {
      setLiked(true);
      setLikesCount((c) => c + 1);
      await supabase.from("likes").insert({ user_id: user.id, post_id: post.id });
    }
    onLikeToggle?.();
  };

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    toast({ title: "Link copied!" });
  };

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full snap-start flex items-center justify-center bg-background">
      {/* Media */}
      <div
        className="relative h-full w-full max-w-lg cursor-pointer"
        onDoubleClick={handleDoubleTap}
      >
        {post.video_url ? (
          <video
            src={post.video_url}
            className="h-full w-full object-cover"
            loop
            muted
            autoPlay
            playsInline
          />
        ) : post.image_url ? (
          <img
            src={post.image_url}
            alt={post.caption || "AI generated content"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <span className="text-muted-foreground">No media</span>
          </div>
        )}

        {/* Heart animation */}
        <AnimatePresence>
          {showHeart && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Heart className="h-24 w-24 fill-accent text-accent drop-shadow-lg" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />

        {/* AI Tool Badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <Badge variant="secondary" className="bg-secondary/80 backdrop-blur-sm text-xs">
            {post.ai_tool}
          </Badge>
          {post.is_verified_ai && (
            <Verified className="h-4 w-4 text-primary" />
          )}
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-end justify-between">
            {/* Left: user info + caption */}
            <div className="flex-1 mr-4">
              <div className="flex items-center gap-2 mb-2">
                <Avatar className="h-8 w-8 border-2 border-primary/50">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {(profile?.username || "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm text-foreground">
                  @{profile?.username || "unknown"}
                </span>
              </div>
              {post.caption && (
                <p className="text-sm text-foreground/80 line-clamp-2">{post.caption}</p>
              )}
            </div>

            {/* Right: action buttons */}
            <div className="flex flex-col items-center gap-4">
              <button onClick={handleLikeButton} className="flex flex-col items-center gap-1">
                <Heart
                  className={`h-7 w-7 transition-colors ${
                    liked ? "fill-accent text-accent" : "text-foreground"
                  }`}
                />
                <span className="text-xs text-foreground">{likesCount}</span>
              </button>
              <button onClick={onComment} className="flex flex-col items-center gap-1">
                <MessageCircle className="h-7 w-7 text-foreground" />
                <span className="text-xs text-foreground">{post.comments_count}</span>
              </button>
              <button onClick={handleShare} className="flex flex-col items-center gap-1">
                <Share2 className="h-6 w-6 text-foreground" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedCard;
