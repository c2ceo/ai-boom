import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Coins, Sparkles, Zap, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CREDIT_PACKS = [
  { key: "40", credits: 40, price: "$1.99", icon: Coins },
  { key: "200", credits: 200, price: "$9.99", icon: Zap, popular: true },
  { key: "300", credits: 300, price: "$13.99", icon: Sparkles },
  { key: "600", credits: 600, price: "$24.99", icon: Star },
  { key: "800", credits: 800, price: "$39.99", icon: Star },
];

const Subscribe = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleBuy = async (packKey: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoading(packKey);
    try {
      const { data, error } = await supabase.functions.invoke("buy-fal-credits", {
        body: { pack: packKey },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to start checkout", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="flex items-center gap-3 p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Buy Credits</h1>
      </div>

      <div className="px-4 space-y-3 max-w-md mx-auto">
        <p className="text-muted-foreground text-sm text-center mb-4">
          Credits are used for AI image and video generation. Pick a pack below.
        </p>

        {CREDIT_PACKS.map((pack) => {
          const Icon = pack.icon;
          return (
            <Card
              key={pack.key}
              className={`relative overflow-hidden transition-shadow hover:shadow-lg ${
                pack.popular ? "ring-2 ring-primary" : ""
              }`}
            >
              {pack.popular && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-bl-lg">
                  Popular
                </div>
              )}
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{pack.credits} Credits</p>
                    <p className="text-sm text-muted-foreground">{pack.price}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleBuy(pack.key)}
                  disabled={loading !== null}
                >
                  {loading === pack.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Buy"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Subscribe;
