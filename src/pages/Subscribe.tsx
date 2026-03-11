import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Sparkles, Zap, Star, Flame, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CREDIT_PACKS = [
  { key: "40", credits: 40, price: "$1.99", perCredit: "$0.050", icon: Zap, accent: "from-blue-500 to-cyan-400" },
  { key: "225", credits: 225, price: "$9.99", perCredit: "$0.044", save: "12%", icon: Star, accent: "from-violet-500 to-purple-400", popular: true },
  { key: "375", credits: 375, price: "$13.99", perCredit: "$0.037", save: "25%", icon: Sparkles, accent: "from-pink-500 to-rose-400" },
  { key: "700", credits: 700, price: "$24.99", perCredit: "$0.036", save: "28%", icon: Flame, accent: "from-orange-500 to-amber-400" },
  { key: "1100", credits: 1100, price: "$39.99", perCredit: "$0.036", save: "27%", icon: Crown, accent: "from-yellow-500 to-yellow-300", best: true },
];

const Subscribe = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingPack, setLoadingPack] = useState<string | null>(null);

  const handlePurchase = async (pack: string) => {
    if (!user) {
      toast({ title: "Please sign in first", variant: "destructive" });
      return;
    }
    setLoadingPack(pack);
    try {
      const { data, error } = await supabase.functions.invoke("buy-fal-credits", {
        body: { pack },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      toast({ title: "Failed to start checkout", description: e.message, variant: "destructive" });
    } finally {
      setLoadingPack(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="flex items-center gap-3 p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Buy Credits</h1>
      </div>

      <div className="px-4 space-y-3 max-w-md mx-auto">
        <p className="text-sm text-muted-foreground text-center mb-4">
          Credits are used to generate AI images and videos.
        </p>

        {CREDIT_PACKS.map((pack) => {
          const Icon = pack.icon;
          const isLoading = loadingPack === pack.key;

          return (
            <button
              key={pack.key}
              onClick={() => handlePurchase(pack.key)}
              disabled={!!loadingPack}
              className={`relative w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-accent/50 transition-all disabled:opacity-60 ${
                pack.popular ? "ring-2 ring-primary" : ""
              }`}
            >
              {pack.popular && (
                <span className="absolute -top-2.5 left-4 text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  Most Popular
                </span>
              )}
              {pack.best && (
                <span className="absolute -top-2.5 left-4 text-[10px] font-bold uppercase tracking-wider bg-yellow-500 text-black px-2 py-0.5 rounded-full">
                  Best Value
                </span>
              )}

              <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${pack.accent} flex items-center justify-center`}>
                <Icon className="h-5 w-5 text-white" />
              </div>

              <div className="flex-1 text-left">
                <span className="font-semibold text-foreground">{pack.credits} Credits</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{pack.price}</span>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Subscribe;
