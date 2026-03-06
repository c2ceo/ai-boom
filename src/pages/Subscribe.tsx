import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { initRevenueCat, presentOffering } from "@/lib/revenuecat";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

const Subscribe = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !containerRef.current) return;

    const show = async () => {
      try {
        initRevenueCat(user.id);
        setLoading(false);
        await presentOffering(containerRef.current!);
      } catch (e: any) {
        setError(e?.message || "Failed to load offerings");
        setLoading(false);
      }
    };

    show();
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="flex items-center gap-3 p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Subscribe</h1>
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

      <div
        ref={containerRef}
        className="px-4"
        style={{ minHeight: "60vh", position: "relative", overflow: "visible" }}
      />
    </div>
  );
};

export default Subscribe;
