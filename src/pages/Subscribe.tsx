import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Gift, Coins, CreditCard, CheckCircle2, Sparkles } from "lucide-react";
import GiftCreditsDialog from "@/components/GiftCreditsDialog";

const Subscribe = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [showGiftDialog, setShowGiftDialog] = useState(false);
  const verificationStarted = useRef(false);
  const sessionId = params.get("session_id");

  const fetchBalance = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("fal_credits").select("credits_remaining").eq("user_id", user.id).maybeSingle();
    setBalance(data?.credits_remaining ?? 0);
  }, [user]);

  const verify = useCallback(async () => {
    if (!user || !sessionId) return;
    setVerifying(true);
    setError(null);
    try {
      const { data, error: failure } = await supabase.functions.invoke("verify-fal-payment", { body: { session_id: sessionId } });
      if (failure || !data?.success) throw new Error(data?.error || "We couldn't confirm your payment. Retry below; you won't be charged again.");
      await fetchBalance();
      setConfirmed(true);
      setParams({}, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to confirm payment");
    } finally { setVerifying(false); }
  }, [user, sessionId, fetchBalance, setParams]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);
  useEffect(() => {
    if (!sessionId || !user || verificationStarted.current) return;
    verificationStarted.current = true;
    void verify();
  }, [sessionId, user, verify]);

  const buy = async () => {
    if (!user) { navigate("/auth"); return; }
    setBusy(true);
    setError(null);
    try {
      const { data, error: failure } = await supabase.functions.invoke("buy-fal-credits", { body: { pack: "50" } });
      if (failure || !data?.url) throw new Error(data?.error || "Checkout is unavailable. Please try again.");
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open checkout");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <header className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold">Buy Credits</h1>
      </header>
      <main className="max-w-md mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">AI-BOOM</span>
          {user && <span className="text-muted-foreground">Balance: {balance ?? "…"} credits</span>}
        </div>
        {confirmed && <div role="status" className="flex gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /><p>Your 50 credits are ready.</p></div>}
        {params.get("canceled") && <p role="status" className="text-sm text-muted-foreground">Checkout canceled. You haven't been charged.</p>}
        <section className="rounded-lg border border-border bg-card p-6 space-y-6">
          <div className="flex items-center gap-3"><Coins className="h-8 w-8 text-primary" /><h2 className="text-lg font-semibold">Creator credits</h2></div>
          <div><p className="text-5xl font-bold">50 <span className="text-lg font-normal text-muted-foreground">credits</span></p><p className="mt-4 text-4xl font-bold">$1 <span className="text-sm font-normal text-muted-foreground">USD · one-time</span></p></div>
          <div className="border-t border-border pt-4 space-y-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI images, edits, and video</p>
            <p>2¢ per credit · No subscription</p>
          </div>
          <Button className="w-full gap-2 h-12" disabled={busy || verifying || authLoading || !!sessionId} onClick={buy}>
            {busy || verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {verifying ? "Confirming payment…" : busy ? "Opening Stripe…" : user ? "Buy 50 credits — $1" : "Sign in to buy credits"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Secure checkout with Stripe</p>
        </section>
        {error && <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{error}</p>{sessionId && <Button variant="outline" onClick={verify} disabled={verifying}>Retry payment verification</Button>}</div>}
        {confirmed && <Button className="w-full" onClick={() => navigate("/create")}>Create an AI image</Button>}
        <Button variant="outline" className="w-full gap-2" onClick={() => user ? setShowGiftDialog(true) : navigate("/auth")}><Gift className="h-4 w-4" />Gift Credits to a Friend</Button>
      </main>
      <GiftCreditsDialog open={showGiftDialog} onOpenChange={setShowGiftDialog} />
    </div>
  );
};
export default Subscribe;
