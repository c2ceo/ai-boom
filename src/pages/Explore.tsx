import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

const categories = ["All", "AI Art", "AI Photography", "AI Video", "AI Abstract"];

const Explore = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
  }, [activeCategory, search]);

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

      {/* Categories */}
      <div className="flex gap-2 px-4 mb-4 overflow-x-auto hide-scrollbar">
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
        <div className="grid grid-cols-3 gap-0.5 px-0.5">
          {posts.map((post) => (
            <div
              key={post.id}
              className="aspect-square cursor-pointer overflow-hidden"
              onClick={() => navigate(`/post/${post.id}`)}
            >
              {post.video_url ? (
                <div className="relative h-full w-full">
                  <video
                    src={post.video_url}
                    className="h-full w-full object-cover hover:scale-105 transition-transform"
                    muted
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Play className="h-6 w-6 text-white/80 drop-shadow-lg" fill="white" fillOpacity={0.8} />
                  </div>
                </div>
              ) : post.image_url ? (
                <img
                  src={post.image_url}
                  alt={post.caption || "AI content"}
                  className="h-full w-full object-cover hover:scale-105 transition-transform"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <Sparkles className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Explore;
