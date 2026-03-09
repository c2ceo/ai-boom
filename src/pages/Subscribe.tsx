import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  initRevenueCat,
  fetchCreditPackages,
  purchasePackage,
  CREDIT_PACK_META,
} from "@/lib/revenuecat";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Coins, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Package } from "@revenuecat/purchases-js";

const Subscribe = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      try {
        initRevenueCat(user.id);
        const packs = await fetchCreditPackages();
        setPackages(packs);
      } catch (e: any) {
        setError(e?.message || "Failed to load offerings");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]);

  const handlePurchase = async (pkg: Package) => {
    setPurchasing(pkg.identifier);
    try {
      await purchasePackage(pkg);
      toast.success("Purchase successful! Credits will be added shortly.");
    } catch (e: any) {
      if (e?.errorCode !== 1) {
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

      {!loading && !error && packages.length === 0 && (
        <div className="px-6 py-10 text-center text-muted-foreground">
          No credit packs available right now.
        </div>
      )}

      {!loading && !error && packages.length > 0 && (
        <div className="grid grid-cols-2 gap-3 px-4">
          {packages.map((pkg) => {
            const meta = CREDIT_PACK_META[pkg.identifier];
            const price = pkg.rcBillingProduct?.currentPrice?.formattedPrice ?? "—";
            const isBuying = purchasing === pkg.identifier;

            return (
              <button
                key={pkg.identifier}
                onClick={() => handlePurchase(pkg)}
                disabled={!!purchasing}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-5 text-card-foreground transition-all hover:border-primary/50 hover:shadow-lg disabled:opacity-60"
              >
                <Sparkles className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold">
                  {meta?.label ?? pkg.identifier}
                </span>
                <span className="text-sm text-muted-foreground">{price}</span>
                <span className="mt-1 flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {isBuying ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Coins className="h-3 w-3" />
                  )}
                  {isBuying ? "Processing…" : "Buy"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Subscribe;
