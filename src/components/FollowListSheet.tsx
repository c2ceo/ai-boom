import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sparkles } from "lucide-react";

interface FollowListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  type: "followers" | "following";
}

interface ProfileItem {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

const FollowListSheet = ({ open, onOpenChange, userId, type }: FollowListSheetProps) => {
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) fetchList();
  }, [open, userId, type]);

  const fetchList = async () => {
    setLoading(true);
    setProfiles([]);

    // Get follow relationships
    const column = type === "followers" ? "following_id" : "follower_id";
    const selectColumn = type === "followers" ? "follower_id" : "following_id";

    const { data: follows } = await supabase
      .from("follows")
      .select(selectColumn)
      .eq(column, userId);

    if (!follows || follows.length === 0) {
      setLoading(false);
      return;
    }

    const userIds = follows.map((f: any) => f[selectColumn]);

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", userIds);

    setProfiles(profilesData || []);
    setLoading(false);
  };

  const handleProfileClick = (profileUserId: string) => {
    onOpenChange(false);
    navigate(`/profile/${profileUserId}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{type === "followers" ? "Followers" : "Following"}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Sparkles className="h-6 w-6 animate-pulse text-primary" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-muted-foreground text-sm">
                {type === "followers" ? "No followers yet" : "Not following anyone yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {profiles.map((p) => (
                <button
                  key={p.user_id}
                  onClick={() => handleProfileClick(p.user_id)}
                  className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                >
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage src={p.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-sm">
                      {(p.username || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-sm text-foreground">@{p.username || "user"}</div>
                    {p.display_name && (
                      <div className="text-xs text-muted-foreground">{p.display_name}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FollowListSheet;
