import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BombThumbnail from "@/components/BombThumbnail";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const categories = ["All", "AI Art", "AI Photography", "AI Video", "AI Abstract"];

const Explore = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [familyFriendly, setFamilyFriendly] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
  }, [activeCategory, search, familyFriendly]);

  const fetchPosts = async () => {
    let query = supabase
      .from("posts")
      .select("*")
      .order("likes_count", { ascending: false })
      .limit(50);

    if (activeCategory !== "All") {
      const cat = activeCategory.toLowerCase().replace(" ", "-");
      query = query.eq("category", cat);
    }

    if (search) {
      query = query.ilike("caption", `%${search}%`);
    }

    if (familyFriendly) {
      query = query.eq("is_family_friendly", true);
    }

    const { data } = await query;
    setPosts(data || []);
    setLoading(false);
  };

  return (
    <div className="min-h-screen pb-20 pt-4">
      {/* Search */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search AI content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary/50 border-border/50"
          />
        </div>
      </div>

      {/* Categories + Family Friendly Toggle */}
      <div className="flex items-center gap-2 px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar flex-1">
        {categories.map((cat) => (
          <Badge
            key={cat}
            variant={activeCategory === cat ? "default" : "secondary"}
            className="cursor-pointer whitespace-nowrap transition-colors"
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </Badge>
        ))}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Switch id="ff-explore" checked={familyFriendly} onCheckedChange={setFamilyFriendly} />
          <Label htmlFor="ff-explore" className="flex items-center gap-1 text-xs cursor-pointer whitespace-nowrap">
            <ShieldCheck className="h-3.5 w-3.5" /> Family Friendly
          </Label>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Sparkles className="h-8 w-8 animate-pulse text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <Sparkles className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No posts found</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 px-1">
          {posts.map((post) => (
            <BombThumbnail
              key={post.id}
              imageUrl={post.image_url}
              videoUrl={post.video_url}
              caption={post.caption}
              onClick={() => navigate(`/post/${post.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Explore;
