import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sparkles, Settings, Grid3X3, Trash2, X, CheckCircle, MoreVertical, UserX, Flag, Ban } from "lucide-react";
import BombThumbnail from "@/components/BombThumbnail";
import ThemeToggle from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const isLovablePreview = window.location.hostname.includes('lovable.app') || window.location.hostname.includes('lovableproject.com') || window.location.hostname === 'localhost';

const Profile = () => {
  const { userId } = useParams();
  const { user } = useAuth();
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
    if (targetUserId) {
      fetchProfile();
    } else if (isLovablePreview) {
      // No authenticated user in preview — stop loading, render sign-in prompt
      setLoading(false);
    }
  }, [targetUserId]);

  // Realtime subscription for profile count updates
  useEffect(() => {
    if (!targetUserId) return;

    const channel = supabase
      .channel(`profile-${targetUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${targetUserId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setProfile((prev: any) => prev ? {
            ...prev,
            followers_count: updated.followers_count,
            following_count: updated.following_count,
            posts_count: updated.posts_count,
          } : prev);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      .in("status", ["approved", "pending_review"])
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
      setIsFollowing(false);
      setProfile((prev: any) => prev ? { ...prev, followers_count: Math.max(0, (prev.followers_count || 0) - 1) } : prev);
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
      // DB trigger automatically recounts both profiles
    } else {
      setIsFollowing(true);
      setProfile((prev: any) => prev ? { ...prev, followers_count: (prev.followers_count || 0) + 1 } : prev);
      await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
      // DB trigger automatically recounts both profiles
    }
  };

  const handleBlock = async () => {
    if (!user || !targetUserId) return;

    if (isFollowing) {
      setIsFollowing(false);
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
      // DB trigger recounts
    }
    // Remove them following you too
    await supabase.from("follows").delete().eq("follower_id", targetUserId).eq("following_id", user.id);
    toast({ title: "User blocked" });
    navigate("/");
  };

  const handleReport = async () => {
    if (!user || !targetUserId) return;
    // Create a report for the user's latest post or a generic report
    const { data: latestPost } = await supabase
      .from("posts")
      .select("id")
      .eq("user_id", targetUserId)
      .limit(1)
      .maybeSingle();

    if (latestPost) {
      await supabase.from("reports").insert({
        reporter_id: user.id,
        post_id: latestPost.id,
        reason: "Account reported by user",
      });
    }
    toast({ title: "Account reported", description: "We'll review this account." });
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

  if (!targetUserId || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <Sparkles className="h-10 w-10 text-primary" />
        <h2 className="text-xl font-bold">Sign in to view your profile</h2>
        <p className="text-sm text-muted-foreground">Create an account or sign in to get started.</p>
        <Button onClick={() => navigate("/auth")} className="mt-2">
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 text-foreground">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">@{profile?.username || "user"}</h2>
        <div className="flex gap-1 items-center">
          <ThemeToggle />
          {isOwnProfile && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <Settings className="h-5 w-5" />
            </Button>
          )}
        </div>
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
              <Button variant="secondary" className="flex-1" onClick={handleFollow}>
                Following
              </Button>
            ) : (
              <Button className="flex-1" onClick={handleFollow}>
                Follow
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border z-50">
                {isFollowing && (
                  <DropdownMenuItem onClick={handleFollow} className="gap-2">
                    <UserX className="h-4 w-4" /> Unfollow
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleBlock} className="gap-2 text-destructive focus:text-destructive">
                  <Ban className="h-4 w-4" /> Block
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleReport} className="gap-2 text-destructive focus:text-destructive">
                  <Flag className="h-4 w-4" /> Report Account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          <div className="grid grid-cols-3 gap-1">
            {posts.map((post) => (
              <BombThumbnail
                key={post.id}
                imageUrl={post.image_url}
                videoUrl={post.video_url}
                caption={post.caption}
                onClick={() => selectMode ? toggleSelectPost(post.id) : navigate(`/post/${post.id}`)}
                overlay={
                  selectMode ? (
                    <div className={`absolute inset-0 flex items-center justify-center transition-colors ${selectedPosts.has(post.id) ? "bg-primary/30" : "bg-black/10"}`} style={{ borderRadius: "50% 50% 50% 50% / 55% 55% 45% 45%" }}>
                      <CheckCircle className={`h-6 w-6 ${selectedPosts.has(post.id) ? "text-primary" : "text-white/50"}`} />
                    </div>
                  ) : undefined
                }
              />
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
