import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { initRevenueCat, purchaseByProductId } from "@/lib/revenuecat";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Coins, Loader2 } from "lucide-react";

const CREDITS_PRODUCT_ID = "prod0c1607a2d2";

const Subscribe = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    try {
      initRevenueCat(user.id);
      setLoading(false);
    } catch (e: any) {
      setError(e?.message || "Failed to initialize");
      setLoading(false);
    }
  }, [user?.id]);

  const handleBuy = async () => {
    setPurchasing(true);
    setError(null);
    try {
      await purchaseByProductId(CREDITS_PRODUCT_ID, containerRef.current ?? undefined);
      navigate("/create?credits_purchased=true");
    } catch (e: any) {
      if (!e?.message?.includes("cancelled")) {
        setError(e?.message || "Purchase failed");
      }
    } finally {
      setPurchasing(false);
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

      {!loading && !error && (
        <div className="px-6 py-10 flex flex-col items-center gap-6">
          <div className="text-center space-y-2">
            <Coins className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-2xl font-bold">200 Credits</h2>
            <p className="text-muted-foreground text-sm">
              Use credits to generate AI images, videos, and photo edits.
            </p>
          </div>

          <Button
            size="lg"
            className="w-full max-w-xs gap-2"
            onClick={handleBuy}
            disabled={purchasing}
          >
            {purchasing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Coins className="h-4 w-4" />
            )}
            {purchasing ? "Processing…" : "Buy 200 Credits"}
          </Button>
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

      <div
        ref={containerRef}
        className="px-4"
        style={{ minHeight: 0, position: "relative", overflow: "visible" }}
      />
    </div>
  );
};

export default Subscribe;
