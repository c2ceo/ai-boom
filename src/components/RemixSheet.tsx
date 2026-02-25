import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Video, Music, Lightbulb, Loader2, X, Play, Pause } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RemixSheetProps {
  postId: string;
  caption: string | null;
  imageUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const remixOptions = [
  {
    type: "video" as const,
    icon: Video,
    label: "Video Concept",
    description: "AI storyboard & shot breakdown",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    type: "song" as const,
    icon: Music,
    label: "Generate Song",
    description: "AI music track inspired by this post",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
  },
  {
    type: "business_idea" as const,
    icon: Lightbulb,
    label: "Business Idea",
    description: "Turn this into a startup concept",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
];

const RemixSheet = ({ postId, caption, imageUrl, open, onOpenChange }: RemixSheetProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: string; text: string; url?: string } | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const handleRemix = async (type: string) => {
    if (!user) {
      toast({ title: "Sign in to remix posts" });
      return;
    }

    setLoading(type);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("remix-post", {
        body: { remix_type: type, post_id: postId, caption, image_url: imageUrl },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.limit_reached) {
          toast({ title: "Daily limit reached", description: data.error, variant: "destructive" });
        } else {
          toast({ title: "Error", description: data.error, variant: "destructive" });
        }
        return;
      }

      setResult({ type, text: data.text, url: data.url });
      if (data.remaining !== undefined) {
        toast({ title: "Remix created! ✨", description: `${data.remaining} free remixes remaining today` });
      }
    } catch (err: any) {
      toast({ title: "Remix failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const togglePlay = () => {
    if (!result?.url) return;
    if (audioRef) {
      if (playing) {
        audioRef.pause();
        setPlaying(false);
      } else {
        audioRef.play();
        setPlaying(true);
      }
    } else {
      const audio = new Audio(result.url);
      audio.onended = () => setPlaying(false);
      audio.play();
      setPlaying(true);
      setAudioRef(audio);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      audioRef?.pause();
      setPlaying(false);
      setAudioRef(null);
      setResult(null);
    }
    onOpenChange(open);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-center">✨ Remix with AI</SheetTitle>
        </SheetHeader>

        {!result ? (
          <div className="flex-1 flex flex-col gap-3 py-4">
            <p className="text-sm text-muted-foreground text-center mb-2">
              Transform this post into something new
            </p>
            {remixOptions.map((option) => {
              const Icon = option.icon;
              const isLoading = loading === option.type;
              return (
                <button
                  key={option.type}
                  onClick={() => handleRemix(option.type)}
                  disabled={!!loading}
                  className={`flex items-center gap-4 p-4 rounded-xl border border-border/50 ${option.bgColor} hover:border-border transition-all text-left disabled:opacity-50`}
                >
                  <div className={`rounded-full p-3 bg-background/50 ${option.color}`}>
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{option.label}</p>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </button>
              );
            })}
            <p className="text-xs text-muted-foreground text-center mt-2">
              3 free remixes/day • Unlimited with subscription
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col py-4 gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                {result.type === "video" && "🎬 Video Concept"}
                {result.type === "song" && "🎵 AI Song"}
                {result.type === "business_idea" && "💡 Business Idea"}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => { setResult(null); audioRef?.pause(); setPlaying(false); setAudioRef(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {result.url && (
              <Button onClick={togglePlay} variant="outline" className="w-full gap-2">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playing ? "Pause" : "Play AI Track"}
              </Button>
            )}

            <ScrollArea className="flex-1">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-foreground/90 text-sm">
                {result.text}
              </div>
            </ScrollArea>

            <Button variant="secondary" onClick={() => { setResult(null); audioRef?.pause(); setPlaying(false); setAudioRef(null); }}>
              Try another remix
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default RemixSheet;
