import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { initRevenueCat, getRevenueCat } from "@/lib/revenuecat";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

const Subscribe = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paywallRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id || !paywallRef.current) return;

    const load = async () => {
      try {
        initRevenueCat(user.id);
        const rc = getRevenueCat();
        if (!rc) throw new Error("RevenueCat not initialized");

        // Fetch offerings and find the one containing aiboom200cred
        const offerings = await rc.getOfferings();
        console.log("RC offerings:", JSON.stringify(offerings, null, 2));
        console.log("RC all offerings keys:", Object.keys(offerings.all));
        
        const targetOffering = Object.values(offerings.all).find((o) =>
          o.availablePackages.some((pkg) => pkg.identifier === "aiboom200cred")
        ) ?? offerings.current;

        console.log("RC targetOffering:", targetOffering?.identifier, "packages:", targetOffering?.availablePackages?.map(p => p.identifier));

        if (!targetOffering) throw new Error("No offering found with aiboom200cred package");

        await rc.presentPaywall({
          htmlTarget: paywallRef.current!,
          offering: targetOffering,
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
    </div>
  );
};

export default Subscribe;
