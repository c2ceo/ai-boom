import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, ShieldCheck, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BombThumbnail from "@/components/BombThumbnail";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const categories = ["All", "AI Art", "AI Photography", "AI Video", "AI Abstract"];

const Explore = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [familyFriendly, setFamilyFriendly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const [accountSearch, setAccountSearch] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
  }, [activeCategory, search, familyFriendly]);

  useEffect(() => {
    if (activeTab === "accounts") {
      searchAccounts();
    }
  }, [accountSearch, activeTab]);

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

  const searchAccounts = async () => {
    setAccountsLoading(true);
    let query = supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, followers_count")
      .order("followers_count", { ascending: false })
      .limit(30);

    if (accountSearch.trim()) {
      query = query.or(`username.ilike.%${accountSearch}%,display_name.ilike.%${accountSearch}%`);
    }

    const { data } = await query;
    setAccounts(data || []);
    setAccountsLoading(false);
  };

  return (
    <div className="min-h-screen pb-20 pt-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mx-4 mb-4 w-[calc(100%-2rem)]">
          <TabsTrigger value="posts" className="flex-1 gap-1.5">
            <Sparkles className="h-4 w-4" /> Posts
          </TabsTrigger>
          <TabsTrigger value="accounts" className="flex-1 gap-1.5">
            <Users className="h-4 w-4" /> Accounts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
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
              <Label htmlFor="ff-explore" className="flex items-center gap-1 text-sm font-semibold cursor-pointer whitespace-nowrap text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" /> {familyFriendly ? "Family Friendly" : "Unfriendly"}
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
        </TabsContent>

        <TabsContent value="accounts">
          {/* Account Search */}
          <div className="px-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                className="pl-10 bg-secondary/50 border-border/50"
              />
            </div>
          </div>

          {accountsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Sparkles className="h-8 w-8 animate-pulse text-primary" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No accounts found</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {accounts.map((account) => (
                <button
                  key={account.user_id}
                  onClick={() => navigate(`/profile/${account.user_id}`)}
                  className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-secondary/30 transition-colors"
                >
                  <Avatar className="h-12 w-12 border-2 border-primary/30">
                    <AvatarImage src={account.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-sm">
                      {(account.username || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      @{account.username || "unknown"}
                    </p>
                    {account.display_name && (
                      <p className="text-xs text-muted-foreground truncate">{account.display_name}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {account.followers_count || 0} followers
                  </span>
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Explore;
