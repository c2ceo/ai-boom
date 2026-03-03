import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ConversationWithProfile {
  id: string;
  other_user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
  is_following: boolean;
}

const Messages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchConversations();

    const channel = supabase
      .channel("messages-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchConversations())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;
    setLoading(true);

    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    if (!convs || convs.length === 0) { setConversations([]); setLoading(false); return; }

    const otherUserIds = convs.map(c => c.participant_1 === user.id ? c.participant_2 : c.participant_1);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", otherUserIds);

    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .in("following_id", otherUserIds);

    const followingSet = new Set(follows?.map(f => f.following_id) || []);
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    const enriched: ConversationWithProfile[] = [];

    for (const conv of convs) {
      const otherId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
      const profile = profileMap.get(otherId);

      const { data: lastMsg } = await supabase
        .from("messages")
        .select("content")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: unread } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conv.id)
        .neq("sender_id", user.id)
        .eq("is_read", false);

      enriched.push({
        id: conv.id,
        other_user_id: otherId,
        username: profile?.username || "user",
        display_name: profile?.display_name || profile?.username || "User",
        avatar_url: profile?.avatar_url || null,
        last_message: lastMsg?.content || null,
        last_message_at: conv.last_message_at,
        unread_count: unread || 0,
        is_following: followingSet.has(otherId),
      });
    }

    setConversations(enriched);
    setLoading(false);
  };

  const filtered = conversations.filter(c =>
    c.display_name.toLowerCase().includes(search.toLowerCase()) ||
    c.username.toLowerCase().includes(search.toLowerCase())
  );

  const primary = filtered.filter(c => c.is_following);
  const requests = filtered.filter(c => !c.is_following);

  const ConversationItem = ({ conv }: { conv: ConversationWithProfile }) => (
    <button
      onClick={() => navigate(`/messages/${conv.id}`)}
      className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted/50"
    >
      <Avatar className="h-12 w-12 shrink-0">
        <AvatarImage src={conv.avatar_url || undefined} />
        <AvatarFallback className="bg-primary/20 text-primary font-semibold">
          {(conv.display_name?.[0] || "U").toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate font-semibold text-foreground">{conv.display_name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="truncate text-sm text-muted-foreground">{conv.last_message || "No messages yet"}</p>
          {conv.unread_count > 0 && (
            <span className="ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
              {conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      <MessageCircle className="mb-3 h-12 w-12 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Messages</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search conversations..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="primary" className="w-full">
        <TabsList className="mb-3 w-full">
          <TabsTrigger value="primary" className="flex-1">
            Primary
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex-1">
            Requests
            {requests.length > 0 && (
              <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                {requests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="primary" className="space-y-1">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-3">
                  <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : primary.length > 0 ? (
            primary.map(c => <ConversationItem key={c.id} conv={c} />)
          ) : (
            <EmptyState message="No conversations with people you follow yet" />
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-1">
          {loading ? null : requests.length > 0 ? (
            <>
              <p className="mb-2 text-xs text-muted-foreground px-1">
                Messages from people you don't follow. They won't know you've seen their message until you reply.
              </p>
              {requests.map(c => <ConversationItem key={c.id} conv={c} />)}
            </>
          ) : (
            <EmptyState message="No message requests" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Messages;
