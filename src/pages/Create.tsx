import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Upload, Sparkles, ImageIcon, X, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const aiTools = ["Midjourney", "DALL-E", "Stable Diffusion", "Firefly", "Leonardo", "Other"];
const categories = [
  { value: "ai-art", label: "AI Art" },
  { value: "ai-photography", label: "AI Photography" },
  { value: "ai-video", label: "AI Video" },
  { value: "ai-abstract", label: "AI Abstract" },
];

const Create = () => {
  const [mode, setMode] = useState<"upload" | "generate">("upload");
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("ai-art");
  const [aiTool, setAiTool] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiCheckResult, setAiCheckResult] = useState<{ is_ai_generated: boolean; confidence: number; reason: string; is_family_friendly?: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput("");
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt },
      });
      if (error) throw error;
      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        setAiTool("in-app");
      }
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handlePost = async () => {
    if (!user) return;
    if (mode === "upload" && !file) {
      toast({ title: "Please select a file", variant: "destructive" });
      return;
    }
    if (mode === "generate" && !generatedImage) {
      toast({ title: "Please generate an image first", variant: "destructive" });
      return;
    }
    if (mode === "upload" && !aiTool) {
      toast({ title: "Please select the AI tool used", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let uploadedUrl = generatedImage;

      if (mode === "upload" && file) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(path, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
        uploadedUrl = publicUrl;
      }

      // Run AI filter on uploaded images (skip for videos and in-app generated)
      let verifiedAi = mode === "generate";
      const isVideo = file?.type?.startsWith("video/");

      if (mode === "upload" && !isVideo && uploadedUrl) {
        setChecking(true);
        try {
          const { data: filterData, error: filterError } = await supabase.functions.invoke("ai-filter", {
            body: { imageUrl: uploadedUrl },
          });
          if (!filterError && filterData) {
            setAiCheckResult(filterData);
            verifiedAi = filterData.is_ai_generated && filterData.confidence >= 0.7;
          }
        } catch (filterErr) {
          console.error("AI filter error:", filterErr);
          // Allow post but mark as unverified
        } finally {
          setChecking(false);
        }
      }

      const isFamilyFriendly = aiCheckResult?.is_family_friendly !== false;
      const needsReview = !verifiedAi && mode === "upload" && !isVideo;
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        image_url: isVideo ? null : uploadedUrl,
        video_url: isVideo ? uploadedUrl : null,
        caption,
        tags,
        category,
        ai_tool: mode === "generate" ? "in-app" : aiTool,
        is_verified_ai: verifiedAi,
        is_family_friendly: isFamilyFriendly,
        status: needsReview ? "pending_review" : "approved",
        voting_expires_at: needsReview ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
      } as any);

      if (error) throw error;

      if (!verifiedAi && mode === "upload" && !isVideo) {
        toast({
          title: "Post published — flagged for review",
          description: "Our AI couldn't verify this as AI-generated content. It will be reviewed by the community.",
        });
      } else {
        toast({ title: "Posted! ✨" });
      }
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 pt-4 px-4 text-foreground">
      <h1 className="text-2xl font-bold mb-4 text-foreground">Create Post</h1>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "upload" | "generate")}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="upload" className="flex-1 gap-2">
            <Upload className="h-4 w-4" /> Upload
          </TabsTrigger>
          <TabsTrigger value="generate" className="flex-1 gap-2">
            <Sparkles className="h-4 w-4" /> AI Generate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card className="border-dashed border-2 border-border/50 bg-card/50 mb-4">
            <CardContent className="p-6">
              {preview ? (
              <div className="relative">
                  {file?.type?.startsWith("video/") ? (
                    <video src={preview} controls className="w-full rounded-lg max-h-80 object-cover" />
                  ) : (
                    <img src={preview} alt="Preview" className="w-full rounded-lg max-h-80 object-cover" />
                  )}
                  <button
                    onClick={() => { setFile(null); setPreview(null); }}
                    className="absolute top-2 right-2 rounded-full bg-background/80 p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                  <label className="flex flex-col items-center gap-3 cursor-pointer py-8">
                   <ImageIcon className="h-10 w-10 text-muted-foreground" />
                   <div className="text-center">
                     <span className="text-sm text-muted-foreground">Tap to upload AI content</span>
                     <span className="text-xs text-muted-foreground/70">(Max 50MB)</span>
                   </div>
                   <input type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
                </label>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2 mb-4">
            <Label>AI Tool Used *</Label>
            <Select value={aiTool} onValueChange={setAiTool}>
              <SelectTrigger>
                <SelectValue placeholder="Which AI tool made this?" />
              </SelectTrigger>
              <SelectContent>
                {aiTools.map((tool) => (
                  <SelectItem key={tool} value={tool.toLowerCase()}>{tool}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="generate">
          <Card className="bg-card/50 mb-4">
            <CardContent className="p-4 space-y-3">
              <Textarea
                placeholder="Describe the image you want to generate..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
              />
              <Button onClick={handleGenerate} disabled={generating || !prompt.trim()} className="w-full gap-2">
                <Sparkles className="h-4 w-4" />
                {generating ? "Generating..." : "Generate Image"}
              </Button>
              {generatedImage && (
                <img src={generatedImage} alt="Generated" className="w-full rounded-lg max-h-80 object-cover" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Shared fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Caption</Label>
          <Textarea
            placeholder="What's the story behind this creation?"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tags</Label>
          <Input
            placeholder="Add tag and press Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  #{tag}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setTags(tags.filter((t) => t !== tag))} />
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Button onClick={handlePost} disabled={loading || checking} className="w-full" size="lg">
          {checking ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Checking AI content...</>
          ) : loading ? (
            "Publishing..."
          ) : (
            "Publish Post"
          )}
        </Button>

        {aiCheckResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            aiCheckResult.is_ai_generated && aiCheckResult.confidence >= 0.7
              ? "bg-green-500/10 text-green-500 border border-green-500/20"
              : "bg-orange-500/10 text-orange-500 border border-orange-500/20"
          }`}>
            {aiCheckResult.is_ai_generated && aiCheckResult.confidence >= 0.7 ? (
              <ShieldCheck className="h-5 w-5 shrink-0" />
            ) : (
              <ShieldAlert className="h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="font-medium">
                {aiCheckResult.is_ai_generated && aiCheckResult.confidence >= 0.7
                  ? "✅ AI-generated content verified"
                  : "⚠️ Flagged for review"}
              </p>
              <p className="text-xs opacity-80">{aiCheckResult.reason}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Create;
