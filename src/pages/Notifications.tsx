import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, UserPlus, Sparkles, UserCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const iconMap: Record<string, any> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  follow_request: UserCheck,
};

const Notifications = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data && data.length > 0) {
      const actorIds = [...new Set(data.map((n) => n.actor_id))];
      const { data: actorProfiles } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", actorIds);
      setProfiles(new Map(actorProfiles?.map((p) => [p.user_id, p])));

      // Mark non-follow_request notifications as read
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false)
        .neq("type", "follow_request");
    }

    setNotifications(data || []);
    setLoading(false);
  };

  const handleAcceptFollow = async (notif: any) => {
    setProcessingRequests((prev) => new Set(prev).add(notif.id));
    try {
      // Insert into follows
      await supabase.from("follows").insert({
        follower_id: notif.actor_id,
        following_id: user!.id,
      });

      // Delete the follow request
      await supabase
        .from("follow_requests")
        .delete()
        .eq("requester_id", notif.actor_id)
        .eq("target_id", user!.id);

      // Mark notification as read
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notif.id);

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true, _accepted: true } : n))
      );

      toast({ title: "Follow request accepted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setProcessingRequests((prev) => {
      const next = new Set(prev);
      next.delete(notif.id);
      return next;
    });
  };

  const handleDeclineFollow = async (notif: any) => {
    setProcessingRequests((prev) => new Set(prev).add(notif.id));
    try {
      // Delete the follow request
      await supabase
        .from("follow_requests")
        .delete()
        .eq("requester_id", notif.actor_id)
        .eq("target_id", user!.id);

      // Remove notification
      await supabase.from("notifications").delete().eq("id", notif.id);

      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      toast({ title: "Follow request declined" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setProcessingRequests((prev) => {
      const next = new Set(prev);
      next.delete(notif.id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Sparkles className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 pt-4">
      <h1 className="text-2xl font-bold px-4 mb-4">Notifications</h1>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <Sparkles className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No notifications yet</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {notifications.map((notif) => {
            const actor = profiles.get(notif.actor_id);
            const Icon = iconMap[notif.type] || Sparkles;
            const isFollowRequest = notif.type === "follow_request" && !notif.is_read && !notif._accepted;
            const isAccepted = notif._accepted;

            return (
              <div
                key={notif.id}
                className={`flex items-center gap-3 px-4 py-3 ${!notif.is_read ? "bg-primary/5" : ""}`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={actor?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {(actor?.username || "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">@{actor?.username || "someone"}</span>{" "}
                    {notif.type === "like" && "liked your post"}
                    {notif.type === "comment" && "commented on your post"}
                    {notif.type === "follow" && "started following you"}
                    {notif.type === "follow_request" && "requested to follow you"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                  </p>
                  {isFollowRequest && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptFollow(notif)}
                        disabled={processingRequests.has(notif.id)}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border text-foreground"
                        onClick={() => handleDeclineFollow(notif)}
                        disabled={processingRequests.has(notif.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                  {isAccepted && (
                    <p className="text-xs text-primary mt-1 font-medium">Accepted</p>
                  )}
                </div>
                <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
