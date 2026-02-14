import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Lock, Globe } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Privacy = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("is_private")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setIsPrivate(data.is_private);
        setLoading(false);
      });
  }, [user]);

  const handleToggle = async (checked: boolean) => {
    setIsPrivate(checked);
    const { error } = await supabase
      .from("profiles")
      .update({ is_private: checked })
      .eq("user_id", user!.id);

    if (error) {
      setIsPrivate(!checked);
      toast({ title: "Error", description: "Failed to update privacy setting.", variant: "destructive" });
    } else {
      toast({ title: checked ? "Profile set to private" : "Profile set to public" });
    }
  };

  return (
    <div className="min-h-screen pb-20 pt-4 px-4 text-foreground">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Privacy</h1>
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isPrivate ? <Lock className="h-5 w-5 text-muted-foreground" /> : <Globe className="h-5 w-5 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium">Private Account</p>
              <p className="text-xs text-muted-foreground">
                {isPrivate
                  ? "Only approved followers can see your posts"
                  : "Anyone can see your profile and posts"}
              </p>
            </div>
          </div>
          <Switch checked={isPrivate} onCheckedChange={handleToggle} disabled={loading} />
        </div>
      </div>
    </div>
  );
};

export default Privacy;
