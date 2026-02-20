import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, ShieldAlert, Clock, ThumbsUp, ThumbsDown, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CommunityVote = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [timeLeftMap, setTimeLeftMap] = useState<Record<string, string>>({});

  // Resolve expired votes on page load
  useQuery({
    queryKey: ["resolve-votes"],
    queryFn: async () => {
      await supabase.functions.invoke("resolve-votes");
      return true;
    },
    staleTime: 60000,
  });

  // Fetch posts separately, then profiles
  const { data: posts, isLoading } = useQuery({
    queryKey: ["pending-votes"],
    queryFn: async () => {
      const { data: postsData, error } = await (supabase
        .from("posts")
        .select("*") as any)
        .eq("status", "pending_review")
        .gt("voting_expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!postsData?.length) return [];

      // Fetch profiles for these posts
      const userIds = [...new Set(postsData.map((p: any) => p.user_id))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", userIds);

      const profileMap: Record<string, any> = {};
      profiles?.forEach((p) => { profileMap[p.user_id] = p; });

      return postsData.map((p) => ({ ...p, profile: profileMap[p.user_id] || null }));
    },
    refetchInterval: 5000,
  });

  const { data: myVotes } = useQuery({
    queryKey: ["my-votes", user?.id],
    queryFn: async () => {
      if (!user) return {};
      const { data } = await supabase
        .from("post_votes")
        .select("post_id, vote_ai")
        .eq("user_id", user.id) as any;
      const map: Record<string, boolean> = {};
      data?.forEach((v: any) => { map[v.post_id] = v.vote_ai; });
      return map;
    },
    enabled: !!user,
  });

  const { data: voteCounts } = useQuery({
    queryKey: ["vote-counts", posts?.map((p: any) => p.id).join(",")],
    queryFn: async () => {
      if (!posts?.length) return {};
      const ids = posts.map((p: any) => p.id);
      const { data } = await supabase
        .from("post_votes")
        .select("post_id, vote_ai")
        .in("post_id", ids) as any;
      const counts: Record<string, { ai: number; notAi: number }> = {};
      data?.forEach((v: any) => {
        if (!counts[v.post_id]) counts[v.post_id] = { ai: 0, notAi: 0 };
        v.vote_ai ? counts[v.post_id].ai++ : counts[v.post_id].notAi++;
      });
      return counts;
    },
    enabled: !!posts?.length,
  });

  // Realtime subscription for instant vote updates
  useEffect(() => {
    const channel = supabase
      .channel("post-votes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "post_votes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["vote-counts"] });
        queryClient.invalidateQueries({ queryKey: ["my-votes"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Live countdown timer
  const getTimeLeft = useCallback((expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours}h ${mins}m ${secs}s`;
  }, []);

  useEffect(() => {
    if (!posts?.length) return;
    const interval = setInterval(() => {
      const map: Record<string, string> = {};
      posts.forEach((p: any) => {
        if (p.voting_expires_at) map[p.id] = getTimeLeft(p.voting_expires_at);
      });
      setTimeLeftMap(map);
    }, 1000);
    return () => clearInterval(interval);
  }, [posts, getTimeLeft]);

  const voteMutation = useMutation({
    mutationFn: async ({ postId, voteAi }: { postId: string; voteAi: boolean }) => {
      if (!user) return;
      const existing = myVotes?.[postId];
      if (existing !== undefined) {
        if (existing === voteAi) {
          await supabase.from("post_votes").delete().eq("post_id", postId).eq("user_id", user.id);
        } else {
          await supabase.from("post_votes").update({ vote_ai: voteAi } as any).eq("post_id", postId).eq("user_id", user.id);
        }
      } else {
        await supabase.from("post_votes").insert({ post_id: postId, user_id: user.id, vote_ai: voteAi } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-votes"] });
      queryClient.invalidateQueries({ queryKey: ["vote-counts"] });
    },
    onError: (err: any) => {
      toast({ title: "Vote failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen pb-20 pt-4 px-4 text-foreground">
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold">Community Vote</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Help verify AI content! Vote whether these posts are AI-generated. After 24 hours, posts with majority "AI" votes get approved.
      </p>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : !posts?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ShieldCheck className="h-12 w-12 mb-3 text-primary" />
          <p className="text-lg font-medium">All clear!</p>
          <p className="text-sm">No posts pending review right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post: any) => {
            const counts = voteCounts?.[post.id] || { ai: 0, notAi: 0 };
            const myVote = myVotes?.[post.id];
            const total = counts.ai + counts.notAi;
            const aiPercent = total > 0 ? Math.round((counts.ai / total) * 100) : 0;

            return (
              <Card key={post.id} className="overflow-hidden bg-card/50 border-border/50">
                {post.image_url && (
                  <img src={post.image_url} alt="" className="w-full rounded-t-lg" />
                )}
                {post.video_url && (
                  <video src={post.video_url} controls className="w-full rounded-t-lg" />
                )}
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        @{post.profile?.username || "unknown"}
                      </span>
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Sparkles className="h-3 w-3" />
                        {post.ai_tool}
                      </Badge>
                    </div>
                    <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {timeLeftMap[post.id] || getTimeLeft(post.voting_expires_at)}
                    </Badge>
                  </div>

                  {post.caption && (
                    <p className="text-sm text-foreground/80">{post.caption}</p>
                  )}

                  {/* Vote bar */}
                  {total > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>AI: {counts.ai}</span>
                        <span>Not AI: {counts.notAi}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${aiPercent}%` }}
                        />
                        <div
                          className="h-full bg-accent transition-all duration-300"
                          style={{ width: `${100 - aiPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Vote buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant={myVote === true ? "default" : "outline"}
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => voteMutation.mutate({ postId: post.id, voteAi: true })}
                      disabled={voteMutation.isPending}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      It's AI
                    </Button>
                    <Button
                      variant={myVote === false ? "destructive" : "outline"}
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => voteMutation.mutate({ postId: post.id, voteAi: false })}
                      disabled={voteMutation.isPending}
                    >
                      <ThumbsDown className="h-4 w-4" />
                      Not AI
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommunityVote;
