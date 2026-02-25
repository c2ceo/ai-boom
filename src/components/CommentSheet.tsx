import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, Wand2, Loader2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profile?: {
    username: string | null;
    avatar_url: string | null;
  };
}

interface CommentSheetProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CommentSheet = ({ postId, open, onOpenChange }: CommentSheetProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    if (open && postId) fetchComments();
  }, [open, postId]);

  const fetchComments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

      setComments(
        data.map((c) => ({
          ...c,
          profile: profileMap.get(c.user_id) || undefined,
        }))
      );
    } else {
      setComments([]);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user || !newComment.trim()) return;
    setSubmitting(true);

    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: newComment.trim(),
    });

    if (!error) {
      setNewComment("");
      await fetchComments();
      // Increment comments_count on the post
      await supabase.rpc("increment_count", {
        table_name: "posts",
        column_name: "comments_count",
        row_id: postId,
      });
    }
    setSubmitting(false);
  };

  const handleSummarize = async () => {
    if (comments.length < 2) {
      toast({ title: "Need at least 2 comments to summarize" });
      return;
    }
    if (!user) {
      toast({ title: "Sign in to use AI summary" });
      return;
    }
    setSummarizing(true);
    try {
      const commentsPayload = comments.map((c) => ({
        username: c.profile?.username || "user",
        content: c.content,
      }));
      const { data, error } = await supabase.functions.invoke("remix-post", {
        body: { remix_type: "summary", post_id: postId, comments: commentsPayload },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }
      setSummary(data.text);
    } catch (err: any) {
      toast({ title: "Summary failed", description: err.message, variant: "destructive" });
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) setSummary(null); onOpenChange(o); }}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-center flex items-center justify-center gap-2">
            Comments
            {comments.length >= 2 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-primary"
                onClick={handleSummarize}
                disabled={summarizing}
              >
                {summarizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                AI Summary
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        {summary && (
          <div className="mx-1 mb-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-primary text-xs flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> AI Insights
              </span>
              <button onClick={() => setSummary(null)}><X className="h-3 w-3 text-muted-foreground" /></button>
            </div>
            <div className="whitespace-pre-wrap text-foreground/90 text-xs">{summary}</div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Sparkles className="h-6 w-6 animate-pulse text-primary" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No comments yet. Be the first!
            </p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 px-1">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={comment.profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {(comment.profile?.username || "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">
                      @{comment.profile?.username || "user"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 mt-0.5">{comment.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border/50 pt-3 pb-2">
          <Input
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CommentSheet;
