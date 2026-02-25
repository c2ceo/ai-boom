import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, Flag, Verified, MoreVertical, Trash2, Pencil, Archive, Eye, Wand2, Video, Music, Lightbulb, Loader2, Play, Pause, X, RotateCcw } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

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

  // Remix state
  const [remixLoading, setRemixLoading] = useState<string | null>(null);
  const [remixResult, setRemixResult] = useState<{ type: string; text: string; url?: string } | null>(null);
  const [remixDialogOpen, setRemixDialogOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedRemixType, setSelectedRemixType] = useState<string | null>(null);

  // Inline audio player state
  const [inlineAudioUrl, setInlineAudioUrl] = useState<string | null>(null);
  const [inlinePlaying, setInlinePlaying] = useState(false);
  const [showRemixOverlay, setShowRemixOverlay] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setLikesCount(post.likes_count);
    setCommentsCount(post.comments_count);
    setViewsCount(post.views_count || 0);
  }, [post.likes_count, post.comments_count, post.views_count]);

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

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

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

  const openRemixPrompt = (type: string) => {
    if (!user) { toast({ title: "Sign in to remix posts" }); return; }
    setSelectedRemixType(type);
    setCustomPrompt("");
    setRemixDialogOpen(true);
  };

  const handleRemix = async () => {
    if (!selectedRemixType || !user) return;
    setRemixDialogOpen(false);
    setRemixLoading(selectedRemixType);
    try {
      const { data, error } = await supabase.functions.invoke("remix-post", {
        body: {
          remix_type: selectedRemixType,
          post_id: post.id,
          caption: post.caption,
          image_url: post.image_url,
          custom_prompt: customPrompt || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: data.limit_reached ? "Daily limit reached" : "Error", description: data.error, variant: "destructive" });
        return;
      }

      // For songs, set up inline player overlay
      if (selectedRemixType === "song" && data.url) {
        setInlineAudioUrl(data.url);
        setShowRemixOverlay(true);
        // Auto-play
        const audio = new Audio(data.url);
        audio.onended = () => setInlinePlaying(false);
        audio.play();
        setInlinePlaying(true);
        audioRef.current = audio;
      }

      setRemixResult({ type: selectedRemixType, text: data.text, url: data.url });

      if (data.remaining !== undefined) {
        toast({ title: "Remix created! ✨", description: `${data.remaining} free remixes remaining today` });
      }
    } catch (err: any) {
      toast({ title: "Remix failed", description: err.message, variant: "destructive" });
    } finally {
      setRemixLoading(null);
    }
  };

  const toggleInlinePlay = () => {
    if (!audioRef.current) return;
    if (inlinePlaying) {
      audioRef.current.pause();
      setInlinePlaying(false);
    } else {
      audioRef.current.play();
      setInlinePlaying(true);
    }
  };

  const revertToOriginal = () => {
    audioRef.current?.pause();
    setInlinePlaying(false);
    setShowRemixOverlay(false);
  };

  const showRemixed = () => {
    setShowRemixOverlay(true);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setInlinePlaying(true);
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

        {/* Inline Song Remix Overlay */}
        <AnimatePresence>
          {showRemixOverlay && inlineAudioUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleInlinePlay(); }}
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground"
                >
                  {inlinePlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">🎵 AI Remix</p>
                  <p className="text-white/70 text-xs truncate">Tap to play/pause</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); revertToOriginal(); }}
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
                  title="Revert to original"
                >
                  <RotateCcw className="h-4 w-4 text-white" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setRemixResult(prev => prev ? { ...prev } : null); }}
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
                  title="View details"
                >
                  <Eye className="h-4 w-4 text-white" />
                </button>
              </div>
              {/* Audio visualizer bar */}
              <div className="flex items-end gap-0.5 mt-2 h-4">
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 bg-primary/80 rounded-full"
                    animate={inlinePlaying ? {
                      height: [4, Math.random() * 16 + 4, 4],
                    } : { height: 4 }}
                    transition={inlinePlaying ? {
                      repeat: Infinity,
                      duration: 0.4 + Math.random() * 0.4,
                      delay: Math.random() * 0.2,
                    } : {}}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reverted state - show "back to remix" badge */}
        {inlineAudioUrl && !showRemixOverlay && (
          <button
            onClick={(e) => { e.stopPropagation(); showRemixed(); }}
            className="absolute bottom-3 left-3 bg-primary/90 backdrop-blur-sm text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5"
          >
            <Music className="h-3 w-3" /> Play Remix
          </button>
        )}
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
                      onClick={() => openRemixPrompt(option.type)}
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

      {/* Custom Prompt Dialog */}
      <Dialog open={remixDialogOpen} onOpenChange={setRemixDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRemixType === "video" && <><Video className="h-5 w-5 text-blue-500" /> Video Concept</>}
              {selectedRemixType === "song" && <><Music className="h-5 w-5 text-pink-500" /> Generate Song</>}
              {selectedRemixType === "business_idea" && <><Lightbulb className="h-5 w-5 text-yellow-500" /> Business Idea</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              AI will analyze the post image to create your remix. Add a custom prompt to guide the result (optional).
            </p>
            <Textarea
              placeholder={
                selectedRemixType === "song" ? "e.g. Make it jazzy with piano and saxophone..."
                : selectedRemixType === "video" ? "e.g. Slow-mo cinematic with dramatic lighting..."
                : "e.g. Focus on sustainability and eco-friendly market..."
              }
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemixDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRemix} disabled={!!remixLoading}>
              {remixLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remix Result Dialog (for video/business_idea text results) */}
      <Dialog open={!!remixResult && remixResult.type !== "song"} onOpenChange={(open) => { if (!open) setRemixResult(null); }}>
        <DialogContent className="max-w-md max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {remixResult?.type === "video" && "🎬 Video Concept"}
              {remixResult?.type === "business_idea" && "💡 Business Idea"}
            </DialogTitle>
          </DialogHeader>
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
