import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, Flag, Verified, MoreVertical, Trash2, Pencil, Archive, Eye, Wand2, Video, Music, Lightbulb, Loader2, Play, Pause, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    views_count?: number;
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
  onComment?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (postId: string) => void;
  onArchive?: (postId: string) => void;
}

const remixOptions = [
  { type: "video" as const, icon: Video, label: "Video Concept", color: "text-blue-500" },
  { type: "song" as const, icon: Music, label: "Generate Song", color: "text-pink-500" },
  { type: "business_idea" as const, icon: Lightbulb, label: "Business Idea", color: "text-yellow-500" },
];

const FeedCard = ({ post, profile, isLiked = false, onLikeToggle, onComment, onDelete, onEdit, onArchive }: FeedCardProps) => {
  const navigate = useNavigate();
  const [showHeart, setShowHeart] = useState(false);
  const [liked, setLiked] = useState(isLiked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [viewsCount, setViewsCount] = useState(post.views_count || 0);
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwner = user?.id === post.user_id;
  const [remixLoading, setRemixLoading] = useState<string | null>(null);
  const [remixResult, setRemixResult] = useState<{ type: string; text: string; url?: string } | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setLikesCount(post.likes_count);
    setCommentsCount(post.comments_count);
    setViewsCount(post.views_count || 0);
  }, [post.likes_count, post.comments_count, post.views_count]);

  // Track view once per mount
  useEffect(() => {
    const trackView = async () => {
      await supabase.rpc("increment_count", { table_name: "posts", column_name: "views_count", row_id: post.id, amount: 1 });
      setViewsCount((c) => c + 1);
    };
    trackView();
  }, [post.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`post-counts-${post.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts", filter: `id=eq.${post.id}` },
        (payload) => {
          const p = payload.new as any;
          if (typeof p.likes_count === "number") setLikesCount(p.likes_count);
          if (typeof p.comments_count === "number") setCommentsCount(p.comments_count);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [post.id]);

  const handleDoubleTap = async () => {
    if (!user) { toast({ title: "You must sign in to like" }); return; }
    if (!liked) {
      setLiked(true);
      setLikesCount((c) => c + 1);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
      await supabase.from("likes").insert({ user_id: user.id, post_id: post.id });
      await supabase.rpc("increment_count", { table_name: "posts", column_name: "likes_count", row_id: post.id, amount: 1 });
      onLikeToggle?.();
    } else {
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
    }
  };

  const handleLikeButton = async () => {
    if (!user) { toast({ title: "You must sign in to like" }); return; }
    if (liked) {
      setLiked(false);
      setLikesCount((c) => c - 1);
      await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", post.id);
      await supabase.rpc("increment_count", { table_name: "posts", column_name: "likes_count", row_id: post.id, amount: -1 });
    } else {
      setLiked(true);
      setLikesCount((c) => c + 1);
      await supabase.from("likes").insert({ user_id: user.id, post_id: post.id });
      await supabase.rpc("increment_count", { table_name: "posts", column_name: "likes_count", row_id: post.id, amount: 1 });
    }
    onLikeToggle?.();
  };

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    toast({ title: "Link copied!" });
  };

  const handleRemix = async (type: string) => {
    if (!user) { toast({ title: "Sign in to remix posts" }); return; }
    setRemixLoading(type);
    try {
      const { data, error } = await supabase.functions.invoke("remix-post", {
        body: { remix_type: type, post_id: post.id, caption: post.caption, image_url: post.image_url },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: data.limit_reached ? "Daily limit reached" : "Error", description: data.error, variant: "destructive" });
        return;
      }
      setRemixResult({ type, text: data.text, url: data.url });
      if (data.remaining !== undefined) {
        toast({ title: "Remix created! ✨", description: `${data.remaining} free remixes remaining today` });
      }
    } catch (err: any) {
      toast({ title: "Remix failed", description: err.message, variant: "destructive" });
    } finally {
      setRemixLoading(null);
    }
  };

  const togglePlay = () => {
    if (!remixResult?.url) return;
    if (audioRef) {
      if (playing) { audioRef.pause(); setPlaying(false); }
      else { audioRef.play(); setPlaying(true); }
    } else {
      const audio = new Audio(remixResult.url);
      audio.onended = () => setPlaying(false);
      audio.play();
      setPlaying(true);
      setAudioRef(audio);
    }
  };

  return (
    <div className="snap-start w-full flex flex-col items-center bg-background py-4">
      {/* Media */}
      <div
        className="relative w-full max-w-lg mx-auto cursor-pointer"
        onDoubleClick={handleDoubleTap}
      >
        {post.video_url ? (
          <video
            src={post.video_url}
            className="w-full object-contain"
            loop
            muted
            autoPlay
            playsInline
          />
        ) : post.image_url ? (
          <img
            src={post.image_url}
            alt={post.caption || "AI generated content"}
            className="w-full object-contain"
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

        {/* AI Tool Badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <Badge variant="secondary" className="bg-secondary/80 backdrop-blur-sm text-xs">
            {post.ai_tool}
          </Badge>
          {post.is_verified_ai && (
            <Verified className="h-4 w-4 text-primary" />
          )}
        </div>
      </div>

      {/* Info section below the post */}
      <div className="max-w-lg mx-auto w-full px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: user info + caption */}
          <div className="flex-1 mr-4">
            <div className="flex items-center gap-2 mb-1">
              <Avatar className="h-8 w-8 border-2 border-primary/50">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                  {(profile?.username || "?")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.user_id}`); }}
                className="font-semibold text-sm text-foreground hover:underline"
              >
                @{profile?.username || "unknown"}
              </button>
            </div>
            {post.caption && (
              <p className="text-sm text-muted-foreground ml-10">{post.caption}</p>
            )}
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-0.5">
              <Eye className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{viewsCount}</span>
            </div>
            <button onClick={handleLikeButton} className="flex flex-col items-center gap-0.5">
              <Heart
                className={`h-6 w-6 transition-colors ${
                  liked ? "fill-accent text-accent" : "text-foreground"
                }`}
              />
              <span className="text-xs text-muted-foreground">{likesCount}</span>
            </button>
            <button onClick={() => { if (!user) { toast({ title: "You must sign in to comment" }); return; } onComment?.(post.id); }} className="flex flex-col items-center gap-0.5">
              <MessageCircle className="h-6 w-6 text-foreground" />
              <span className="text-xs text-muted-foreground">{commentsCount}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex flex-col items-center gap-0.5">
                  {remixLoading ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <Wand2 className="h-5 w-5 text-primary" />}
                  <span className="text-[10px] text-primary font-medium">Remix</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover z-50 min-w-[180px]">
                {remixOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <DropdownMenuItem
                      key={option.type}
                      onClick={() => handleRemix(option.type)}
                      disabled={!!remixLoading}
                      className="gap-2"
                    >
                      <Icon className={`h-4 w-4 ${option.color}`} />
                      {option.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <button onClick={handleShare}>
              <Share2 className="h-5 w-5 text-foreground" />
            </button>
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button>
                    <MoreVertical className="h-5 w-5 text-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover z-50">
                  <DropdownMenuItem onClick={() => onEdit?.(post.id)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onArchive?.(post.id)}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete?.(post.id)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Remix result dialog */}
      <Dialog open={!!remixResult} onOpenChange={(open) => { if (!open) { setRemixResult(null); audioRef?.pause(); setPlaying(false); setAudioRef(null); } }}>
        <DialogContent className="max-w-md max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {remixResult?.type === "video" && "🎬 Video Concept"}
              {remixResult?.type === "song" && "🎵 AI Song"}
              {remixResult?.type === "business_idea" && "💡 Business Idea"}
            </DialogTitle>
          </DialogHeader>
          {remixResult?.url && (
            <Button onClick={togglePlay} variant="outline" className="w-full gap-2">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? "Pause" : "Play AI Track"}
            </Button>
          )}
          <ScrollArea className="flex-1 min-h-0">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-foreground/90 text-sm pr-2">
              {remixResult?.text}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeedCard;
