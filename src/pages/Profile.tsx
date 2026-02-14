import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sparkles, Settings, Grid3X3, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Profile = () => {
  const { userId } = useParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = !userId || userId === user?.id;
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) fetchProfile();
  }, [targetUserId]);

  const fetchProfile = async () => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", targetUserId!)
      .single();

    setProfile(profileData);

    const { data: postsData } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", targetUserId!)
      .order("created_at", { ascending: false });

    setPosts(postsData || []);

    if (user && !isOwnProfile) {
      const { data: follow } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId!)
        .maybeSingle();
      setIsFollowing(!!follow);
    }

    setLoading(false);
  };

  const handleFollow = async () => {
    if (!user || !targetUserId) return;
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
      setIsFollowing(false);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
      setIsFollowing(true);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Sparkles className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 text-foreground">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">@{profile?.username || "user"}</h2>
        {isOwnProfile && (
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Profile info */}
      <div className="px-4 flex items-center gap-6 mb-4">
        <Avatar className="h-20 w-20 border-2 border-primary/50">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-xl">
            {(profile?.username || "?")[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex gap-6 text-center">
          <div>
            <div className="font-bold">{profile?.posts_count || posts.length}</div>
            <div className="text-xs text-muted-foreground">Posts</div>
          </div>
          <div>
            <div className="font-bold">{profile?.followers_count || 0}</div>
            <div className="text-xs text-muted-foreground">Followers</div>
          </div>
          <div>
            <div className="font-bold">{profile?.following_count || 0}</div>
            <div className="text-xs text-muted-foreground">Following</div>
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className="px-4 mb-4">
        <div className="font-semibold text-sm">{profile?.display_name}</div>
        {profile?.bio && <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>}
      </div>

      {/* Action */}
      <div className="px-4 mb-4">
        {isOwnProfile ? (
          <Button variant="secondary" className="w-full" onClick={() => navigate("/edit-profile")}>
            Edit Profile
          </Button>
        ) : (
          <Button
            variant={isFollowing ? "secondary" : "default"}
            className="w-full"
            onClick={handleFollow}
          >
            {isFollowing ? "Following" : "Follow"}
          </Button>
        )}
      </div>

      {/* Posts grid */}
      <div className="border-t border-border/50">
        <div className="flex items-center justify-center py-2">
          <Grid3X3 className="h-5 w-5 text-foreground" />
        </div>
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <Sparkles className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No posts yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {posts.map((post) => (
              <div
                key={post.id}
                className="aspect-square cursor-pointer overflow-hidden"
                onClick={() => navigate(`/post/${post.id}`)}
              >
                {post.image_url ? (
                  <img
                    src={post.image_url}
                    alt={post.caption || ""}
                    className="h-full w-full object-cover hover:opacity-80 transition-opacity"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
