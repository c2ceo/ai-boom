import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { initRevenueCat, purchaseByPackageId, RC_PACKAGES } from "@/lib/revenuecat";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Coins, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const CREDIT_PACKS = [
  { id: RC_PACKAGES.AIBOOM_200_CRED, credits: 200, label: "200 Credits" },
  { id: RC_PACKAGES.AIBOOM_300_CRED, credits: 300, label: "300 Credits" },
  { id: RC_PACKAGES.AIBOOM_600_CRED, credits: 600, label: "600 Credits", popular: true },
  { id: RC_PACKAGES.AIBOOM_800_CRED, credits: 800, label: "800 Credits" },
];

const Subscribe = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      initRevenueCat(user.id);
    }
  }, [user?.id]);

  const handlePurchase = async (packageId: string) => {
    if (!user?.id) {
      toast.error("Please sign in first");
      return;
    }
    setPurchasing(packageId);
    try {
      await purchaseByPackageId(packageId);
      toast.success("Purchase successful! Credits added.");
      navigate(-1);
    } catch (e: any) {
      if (e?.message?.includes("cancelled") || e?.message?.includes("canceled")) {
        // User cancelled, no toast needed
      } else {
        toast.error(e?.message || "Purchase failed");
      }
    } finally {
      setPurchasing(null);
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

      <div className="px-4 space-y-3 max-w-md mx-auto mt-4">
        <div className="text-center mb-6">
          <Sparkles className="h-10 w-10 text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Credits are used for AI image generation, photo editing, and more.
          </p>
        </div>

        {CREDIT_PACKS.map((pack) => (
          <button
            key={pack.id}
            onClick={() => handlePurchase(pack.id)}
            disabled={purchasing !== null}
            className={`w-full relative flex items-center justify-between rounded-xl border p-4 transition-all
              ${pack.popular
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border bg-card hover:border-primary/40"
              }
              disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {pack.popular && (
              <span className="absolute -top-2.5 left-4 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Popular
              </span>
            )}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <span className="font-semibold text-foreground">{pack.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {purchasing === pack.id ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <span className="text-sm font-medium text-muted-foreground">Buy →</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Subscribe;
