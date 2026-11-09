import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { initRevenueCat, getRevenueCat } from "@/lib/revenuecat";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import GiftCreditsDialog from "@/components/GiftCreditsDialog";

const Subscribe = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGiftDialog, setShowGiftDialog] = useState(false);
  const paywallRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setError("Please sign in to buy credits");
      return;
    }
    if (!paywallRef.current) return;

    const load = async () => {
      try {
        initRevenueCat(user.id);
        const rc = getRevenueCat();
        if (!rc) throw new Error("Payments are not available right now");

        const offerings = await rc.getOfferings();
        const targetOffering =
          offerings.current ??
          Object.values(offerings.all).find((o) =>
            o.availablePackages.some((pkg) => pkg.identifier === "aiboom200cred")
          );

        await rc.presentPaywall({
          htmlTarget: paywallRef.current!,
          ...(targetOffering ? { offering: targetOffering } : {}),
        });
      } catch (e: any) {
        setError(e?.message || "Failed to load paywall");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="flex items-center gap-3 p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Buy Credits</h1>
      </div>

      <div className="px-4 max-w-md mx-auto">
        <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5 text-center mb-4">
          <span className="text-sm font-semibold text-primary">💰 The App Store takes all of our money, credits are cheaper on AI-BOOM.com</span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="px-6 py-10 text-center">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      )}

      <div ref={paywallRef} className="px-4" />

      <div className="px-4 max-w-md mx-auto">
        <Button
          variant="outline"
          className="w-full mt-4 gap-2"
          onClick={() => {
            if (!user) {
              toast({ title: "Please sign in first", variant: "destructive" });
              return;
            }
            setShowGiftDialog(true);
          }}
        >
          <Gift className="h-4 w-4" />
          Gift Credits to a Friend
        </Button>
      </div>

      <GiftCreditsDialog open={showGiftDialog} onOpenChange={setShowGiftDialog} />
    </div>
  );
};

export default Subscribe;
