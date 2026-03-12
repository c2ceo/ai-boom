import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Loader2, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface GiftCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill with a specific recipient */
  recipientUserId?: string;
  recipientUsername?: string;
  recipientAvatarUrl?: string;
}

const GiftCreditsDialog = ({
  open,
  onOpenChange,
  recipientUserId,
  recipientUsername,
  recipientAvatarUrl,
}: GiftCreditsDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<{
    user_id: string;
    username: string;
    avatar_url: string | null;
  } | null>(
    recipientUserId
      ? { user_id: recipientUserId, username: recipientUsername || "", avatar_url: recipientAvatarUrl || null }
      : null
  );
  const [myCredits, setMyCredits] = useState<number | null>(null);

  // Fetch sender credits when dialog opens
  const handleOpenChange = async (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && user) {
      const { data } = await supabase
        .from("fal_credits")
        .select("credits_remaining")
        .eq("user_id", user.id)
        .single();
      setMyCredits(data?.credits_remaining ?? 0);

      // Reset state if no pre-filled recipient
      if (recipientUserId) {
        setSelectedRecipient({
          user_id: recipientUserId,
          username: recipientUsername || "",
          avatar_url: recipientAvatarUrl || null,
        });
      }
    } else {
      setAmount("");
      setSearchQuery("");
      setSearchResults([]);
      if (!recipientUserId) setSelectedRecipient(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url, display_name")
      .ilike("username", `%${searchQuery.trim()}%`)
      .neq("user_id", user?.id ?? "")
      .limit(5);
    setSearchResults(data || []);
    setSearching(false);
  };

  const handleGift = async () => {
    if (!user || !selectedRecipient) return;
    const creditAmount = parseInt(amount);
    if (isNaN(creditAmount) || creditAmount < 1) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (myCredits !== null && creditAmount > myCredits) {
      toast({ title: "Not enough credits", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gift-credits", {
        body: { recipient_user_id: selectedRecipient.user_id, amount: creditAmount },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: `🎁 Gifted ${creditAmount} credits to @${selectedRecipient.username}!` });
      setMyCredits((prev) => (prev !== null ? prev - creditAmount : prev));
      setAmount("");
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Gift failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [5, 10, 25, 50];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Gift Credits
          </DialogTitle>
          <DialogDescription>
            Send credits to another user.
            {myCredits !== null && (
              <span className="block mt-1 font-medium text-foreground">
                Your balance: {myCredits} credits
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Recipient selection */}
        {!selectedRecipient ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button size="icon" variant="secondary" onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.user_id}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                    onClick={() => setSelectedRecipient(p)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {(p.username || "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">@{p.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/50">
            <Avatar className="h-10 w-10">
              <AvatarImage src={selectedRecipient.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary">
                {(selectedRecipient.username || "?")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <span className="font-medium text-sm">@{selectedRecipient.username}</span>
            </div>
            {!recipientUserId && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedRecipient(null)}>
                Change
              </Button>
            )}
          </div>
        )}

        {/* Amount input */}
        {selectedRecipient && (
          <div className="space-y-3">
            <Input
              type="number"
              min={1}
              placeholder="Number of credits"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex gap-2">
              {quickAmounts.map((q) => (
                <Button
                  key={q}
                  variant={amount === String(q) ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setAmount(String(q))}
                >
                  {q}
                </Button>
              ))}
            </div>
            <Button
              className="w-full"
              onClick={handleGift}
              disabled={loading || !amount || parseInt(amount) < 1}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Gift className="h-4 w-4 mr-2" />
              )}
              Gift {amount || "0"} Credits
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GiftCreditsDialog;
