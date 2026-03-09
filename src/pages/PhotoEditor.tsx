import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera, ImageIcon, Wand2, Download, X, Loader2, ArrowLeft, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PhotoEditor = () => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 20MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSourceImage(reader.result as string);
      setEditedImage(null);
      setAiText("");
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleEdit = async () => {
    if (!sourceImage || !prompt.trim()) return;
    setLoading(true);
    setEditedImage(null);
    setAiText("");
    try {
      const { data, error } = await supabase.functions.invoke("edit-photo", {
        body: { imageBase64: sourceImage, prompt: prompt.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Edit failed", description: data.error, variant: "destructive" });
        return;
      }
      if (data?.editedImageUrl) {
        setEditedImage(data.editedImageUrl);
      }
      if (data?.text) {
        setAiText(data.text);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!editedImage) return;
    const a = document.createElement("a");
    a.href = editedImage;
    a.download = `ai-edit-${Date.now()}.png`;
    a.click();
  };

  const handleReset = () => {
    setSourceImage(null);
    setEditedImage(null);
    setPrompt("");
    setAiText("");
  };

  const suggestedPrompts = [
    "Remove the background",
    "Make it look like a painting",
    "Add a cinematic color grade",
    "Turn it into a cartoon",
    "Enhance and sharpen the details",
    "Make it black and white",
  ];

  return (
    <div className="min-h-screen pb-28 pt-4 px-4 text-foreground">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted/50 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">AI Photo Editor</h1>
        <Wand2 className="h-5 w-5 text-primary" />
      </div>

      {!sourceImage ? (
        /* Source selection */
        <Card className="border-dashed border-2 border-border/50 bg-card/50">
          <CardContent className="p-8 flex flex-col items-center gap-5">
            <div className="rounded-full bg-primary/10 p-5">
              <ImageIcon className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-lg">Choose a photo to edit</p>
              <p className="text-sm text-muted-foreground">Upload from your gallery or take a new photo</p>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 gap-2"
                variant="outline"
              >
                <ImageIcon className="h-4 w-4" /> Gallery
              </Button>
              <Button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 gap-2"
              >
                <Camera className="h-4 w-4" /> Camera
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Image display */}
          <Card className="bg-card/50 overflow-hidden">
            <CardContent className="p-0">
              <div className="relative">
                <img
                  src={editedImage || sourceImage}
                  alt={editedImage ? "Edited photo" : "Original photo"}
                  className="w-full max-h-[50vh] object-contain bg-black/5 dark:bg-white/5"
                />
                {/* Badge */}
                <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  editedImage
                    ? "bg-primary/90 text-primary-foreground"
                    : "bg-muted/90 text-muted-foreground"
                }`}>
                  {editedImage ? "Edited" : "Original"}
                </span>
                {/* Reset */}
                <button
                  onClick={handleReset}
                  className="absolute top-2 right-2 rounded-full bg-background/80 backdrop-blur-sm p-1.5 hover:bg-background transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* AI text response */}
          {aiText && (
            <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">{aiText}</p>
          )}

          {/* Action buttons for edited image */}
          {editedImage && (
            <div className="flex gap-2">
              <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2">
                <Download className="h-4 w-4" /> Save
              </Button>
              <Button
                onClick={() => {
                  setSourceImage(editedImage);
                  setEditedImage(null);
                  setAiText("");
                }}
                variant="outline"
                className="flex-1 gap-2"
              >
                <RotateCcw className="h-4 w-4" /> Edit Again
              </Button>
            </div>
          )}

          {/* Prompt input */}
          <div className="space-y-2">
            <Textarea
              placeholder="Describe how to edit this photo... (e.g. 'Remove the background', 'Make it look vintage')"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              className="resize-none"
            />
            <Button
              onClick={handleEdit}
              disabled={loading || !prompt.trim()}
              className="w-full gap-2"
              size="lg"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Editing with AI...</>
              ) : (
                <><Wand2 className="h-4 w-4" /> Apply AI Edit</>
              )}
            </Button>
          </div>

          {/* Suggested prompts */}
          {!editedImage && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Suggestions</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedPrompts.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPrompt(s)}
                    className="px-3 py-1.5 rounded-full text-xs bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PhotoEditor;
