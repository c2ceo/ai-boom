import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, UserPlus, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const iconMap: Record<string, any> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
};

const Notifications = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

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

      // Mark as read
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
    }

    setNotifications(data || []);
    setLoading(false);
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
                  <p className="text-sm">
                    <span className="font-semibold">@{actor?.username || "someone"}</span>{" "}
                    {notif.type === "like" && "liked your post"}
                    {notif.type === "comment" && "commented on your post"}
                    {notif.type === "follow" && "started following you"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                  </p>
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
