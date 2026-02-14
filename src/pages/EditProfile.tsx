import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Camera } from "lucide-react";

const EditProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user!.id)
      .single();
    if (data) {
      setUsername(data.username || "");
      setDisplayName(data.display_name || "");
      setBio(data.bio || "");
      setAvatarUrl(data.avatar_url);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const path = `${user.id}/avatar.${file.name.split(".").pop()}`;
    await supabase.storage.from("media").upload(path, file, { upsert: true });
    const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
    setAvatarUrl(publicUrl);
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username, display_name: displayName, bio, avatar_url: avatarUrl })
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated!" });
      navigate("/profile");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen pb-20 pt-4 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Edit Profile</h1>
      </div>

      <div className="flex justify-center mb-6">
        <label className="relative cursor-pointer">
          <Avatar className="h-24 w-24 border-2 border-primary/50">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-2xl">
              {(username || "?")[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="absolute bottom-0 right-0 rounded-full bg-primary p-1.5">
            <Camera className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </label>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Username</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Display Name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Bio</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
        </div>
        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export default EditProfile;
