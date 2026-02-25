import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Sparkles, MoreHorizontal, Trash2, Archive, Repeat2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import FeedCard from "@/components/FeedCard";
import CommentSheet from "@/components/CommentSheet";
import RemixSheet from "@/components/RemixSheet";

interface PostWithProfile {
  post: any;
  profile: any;
  isLiked: boolean;
}

const PostView = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<PostWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string>("");
  const [remixPostId, setRemixPostId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editCaption, setEditCaption] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editPostId, setEditPostId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());

  const fetchPostWithProfile = useCallback(async (id: string): Promise<PostWithProfile | null> => {
    const { data: postData } = await supabase
      .from("posts")
      .select("*")
      .eq("id", id)
      .single();
    if (!postData) return null;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("user_id", postData.user_id)
      .single();

    let isLiked = false;
    if (user) {
      const { data: likeData } = await supabase
        .from("likes")
        .select("id")
        .eq("user_id", user.id)
        .eq("post_id", id)
        .maybeSingle();
      isLiked = !!likeData;
    }

    return { post: postData, profile: profileData, isLiked };
  }, [user]);

  const fetchRandomPosts = useCallback(async (excludeIds: Set<string>) => {
    // Fetch a pool of random posts excluding already loaded ones
    const { data } = await supabase
      .from("posts")
      .select("id")
      .limit(200);

    if (!data || data.length === 0) return [];

    // Filter out already loaded, shuffle, take 6
    const available = data.filter((p) => !excludeIds.has(p.id));
    const shuffled = available.sort(() => Math.random() - 0.5).slice(0, 6);

    const results: PostWithProfile[] = [];
    for (const { id } of shuffled) {
      const item = await fetchPostWithProfile(id);
      if (item) results.push(item);
    }
    return results;
  }, [fetchPostWithProfile]);

  useEffect(() => {
    if (!postId) return;
    const init = async () => {
      setLoading(true);
      const main = await fetchPostWithProfile(postId);
      if (!main) {
        setLoading(false);
        return;
      }
      const ids = new Set([postId]);
      const random = await fetchRandomPosts(ids);
      random.forEach((r) => ids.add(r.post.id));
      setItems([main, ...random]);
      setLoadedIds(ids);
      setLoading(false);
    };
    init();
  }, [postId, fetchPostWithProfile, fetchRandomPosts]);

  const handleLoadMore = async () => {
    const more = await fetchRandomPosts(loadedIds);
    if (more.length === 0) return;
    const newIds = new Set(loadedIds);
    more.forEach((r) => newIds.add(r.post.id));
    setLoadedIds(newIds);
    setItems((prev) => [...prev, ...more]);
  };

  const handleDelete = async (id: string) => {
    const item = items.find((i) => i.post.id === id);
    if (!item || item.post.user_id !== user?.id) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete post", variant: "destructive" });
    } else {
      toast({ title: "Post deleted" });
      setItems((prev) => prev.filter((i) => i.post.id !== id));
      if (id === postId) navigate(-1);
    }
  };

  const handleArchive = () => {
    toast({ title: "Archived", description: "Post archived (coming soon)" });
  };

  const handleRepost = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${id}`);
    toast({ title: "Link copied!", description: "Share it to repost" });
  };

  const openEdit = (id: string) => {
    const item = items.find((i) => i.post.id === id);
    if (!item) return;
    setEditPostId(id);
    setEditCaption(item.post.caption || "");
    setEditTags((item.post.tags || []).join(", "));
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    const tagsArray = editTags.split(",").map((t: string) => t.trim()).filter(Boolean);
    const { error } = await supabase
      .from("posts")
      .update({ caption: editCaption, tags: tagsArray })
      .eq("id", editPostId);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Post updated!" });
      setEditOpen(false);
      // Refresh the edited post
      const updated = await fetchPostWithProfile(editPostId);
      if (updated) {
        setItems((prev) => prev.map((i) => (i.post.id === editPostId ? updated : i)));
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Sparkles className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Post not found</p>
        <Button variant="ghost" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-semibold">Post</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleRepost(postId!)}>
              <Repeat2 className="mr-2 h-4 w-4" />
              Repost
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleArchive}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
            {user?.id === items[0]?.post.user_id && (
              <>
                <DropdownMenuItem onClick={() => openEdit(postId!)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(postId!)} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="snap-y snap-mandatory overflow-y-auto" style={{ height: "calc(100vh - 4rem)" }}>
        {items.map(({ post, profile, isLiked }) => (
          <FeedCard
            key={post.id}
            post={post}
            profile={profile || undefined}
            isLiked={isLiked}
            onLikeToggle={() => {}}
            onComment={(id) => { setCommentPostId(id); setCommentOpen(true); }}
            onDelete={handleDelete}
            onEdit={openEdit}
            onArchive={() => handleArchive()}
            onRemix={(id) => setRemixPostId(id)}
          />
        ))}
        <div className="flex justify-center py-6">
          <Button variant="secondary" onClick={handleLoadMore}>
            Load more posts
          </Button>
        </div>
      </div>

      <CommentSheet
        postId={commentPostId}
        open={commentOpen}
        onOpenChange={setCommentOpen}
      />
      {remixPostId && (
        <RemixSheet
          postId={remixPostId}
          caption={items.find((i) => i.post.id === remixPostId)?.post.caption || null}
          imageUrl={items.find((i) => i.post.id === remixPostId)?.post.image_url || null}
          open={!!remixPostId}
          onOpenChange={(open) => !open && setRemixPostId(null)}
        />
      )}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-caption">Caption</Label>
              <Textarea
                id="edit-caption"
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder="Write a caption..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
              <Input
                id="edit-tags"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="ai, art, midjourney"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PostView;
