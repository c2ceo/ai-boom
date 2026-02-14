import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sparkles, Settings, Grid3X3, LogOut, Play, Trash2, X, CheckCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import FollowListSheet from "@/components/FollowListSheet";

const Profile = () => {
  const { userId } = useParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [followListType, setFollowListType] = useState<"followers" | "following">("followers");
  const [showFollowList, setShowFollowList] = useState(false);

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
      setProfile((prev: any) => prev ? { ...prev, followers_count: Math.max(0, (prev.followers_count || 0) - 1) } : prev);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
      setIsFollowing(true);
      setProfile((prev: any) => prev ? { ...prev, followers_count: (prev.followers_count || 0) + 1 } : prev);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const toggleSelectPost = (postId: string) => {
    setSelectedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedPosts.size === 0) return;
    setDeleting(true);
    const { error } = await supabase
      .from("posts")
      .delete()
      .in("id", Array.from(selectedPosts));
    if (error) {
      toast({ title: "Error deleting posts", description: error.message, variant: "destructive" });
    } else {
      setPosts((prev) => prev.filter((p) => !selectedPosts.has(p.id)));
      toast({ title: `Deleted ${selectedPosts.size} post${selectedPosts.size > 1 ? "s" : ""}` });
      setSelectedPosts(new Set());
      setSelectMode(false);
    }
    setDeleting(false);
    setShowDeleteDialog(false);
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
          <button onClick={() => { setFollowListType("followers"); setShowFollowList(true); }}>
            <div className="font-bold">{profile?.followers_count || 0}</div>
            <div className="text-xs text-muted-foreground">Followers</div>
          </button>
          <button onClick={() => { setFollowListType("following"); setShowFollowList(true); }}>
            <div className="font-bold">{profile?.following_count || 0}</div>
            <div className="text-xs text-muted-foreground">Following</div>
          </button>
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
          <div className="flex gap-2">
            {isFollowing ? (
              <>
                <Button variant="secondary" className="flex-1" disabled>
                  Following
                </Button>
                <Button variant="secondary" size="icon" onClick={handleFollow}>
                  <Settings className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button className="flex-1" onClick={handleFollow}>
                Follow
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Posts grid */}
      <div className="border-t border-border/50">
        <div className="flex items-center justify-between px-4 py-2">
          <Grid3X3 className="h-5 w-5 text-foreground" />
          {isOwnProfile && posts.length > 0 && (
            selectMode ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{selectedPosts.size} selected</span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={selectedPosts.size === 0}
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSelectMode(false); setSelectedPosts(new Set()); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setSelectMode(true)} className="text-xs">
                Select
              </Button>
            )
          )}
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
                className="aspect-square cursor-pointer overflow-hidden relative"
                onClick={() => selectMode ? toggleSelectPost(post.id) : navigate(`/post/${post.id}`)}
              >
                {post.image_url ? (
                  <img
                    src={post.image_url}
                    alt={post.caption || ""}
                    className="h-full w-full object-cover hover:opacity-80 transition-opacity"
                    loading="lazy"
                  />
                ) : post.video_url ? (
                  <div className="relative h-full w-full">
                    <video
                      src={post.video_url}
                      className="h-full w-full object-cover"
                      muted
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play className="h-6 w-6 text-white fill-white" />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                {selectMode && (
                  <div className={`absolute inset-0 flex items-center justify-center transition-colors ${selectedPosts.has(post.id) ? "bg-primary/30" : "bg-black/10"}`}>
                    <CheckCircle className={`h-6 w-6 ${selectedPosts.has(post.id) ? "text-primary" : "text-white/50"}`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedPosts.size} post{selectedPosts.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected posts will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelected} disabled={deleting} className="bg-destructive text-destructive-foreground">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {targetUserId && (
        <FollowListSheet
          open={showFollowList}
          onOpenChange={setShowFollowList}
          userId={targetUserId}
          type={followListType}
        />
      )}
    </div>
  );
};

export default Profile;
