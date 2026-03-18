import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Upload, Sparkles, ImageIcon, X, ShieldCheck, ShieldAlert, Loader2, Video, Coins, Zap, Wand2, Camera, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

const aiTools: string[] = []; // kept for potential future use
const categories = [
  { value: "ai-art", label: "AI Art" },
  { value: "ai-photography", label: "AI Photography" },
  { value: "ai-video", label: "AI Video" },
  { value: "ai-abstract", label: "AI Abstract" },
];

const Create = () => {
  const [mode, setMode] = useState<"upload" | "generate" | "video">("upload");
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
  const [allowEvolve, setAllowEvolve] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [aiCheckResult, setAiCheckResult] = useState<{ is_ai_generated: boolean; confidence: number; reason: string; is_family_friendly?: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const imageProvider = "fal";

  // Video generation state
  const [videoPrompt, setVideoPrompt] = useState("");
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoAudio, setVideoAudio] = useState(false);

  // AI photo edit state for uploads
  const [editPrompt, setEditPrompt] = useState("");
  const [editedPreview, setEditedPreview] = useState<string | null>(null);
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [photoEdited, setPhotoEdited] = useState(false);
  const [sourceBase64, setSourceBase64] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Credits state
  const [falCredits, setFalCredits] = useState<number | null>(null);
  const [buyingCredits, setBuyingCredits] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Fetch credits
  const fetchCredits = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("fal_credits")
      .select("credits_remaining")
      .eq("user_id", user.id)
      .maybeSingle();
    setFalCredits(data?.credits_remaining ?? 0);
  }, [user]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Handle returning from Stripe checkout
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const purchased = searchParams.get("credits_purchased");
    if (purchased === "true" && sessionId && user) {
      // Verify payment and add credits
      supabase.functions.invoke("verify-fal-payment", {
        body: { session_id: sessionId },
      }).then(({ data, error }) => {
        if (!error && data?.success) {
          toast({ title: "Credits added! 🎉", description: `${data.credits_added} fal.ai credits added to your account.` });
          fetchCredits();
        }
      });
      // Clean URL params
      setSearchParams({});
    }
  }, [searchParams, user]);

  const handleBuyCredits = async () => {
    if (!user) { toast({ title: "Please sign in first" }); return; }
    setBuyingCredits(true);
    try {
      const { data, error } = await supabase.functions.invoke("buy-fal-credits");
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setBuyingCredits(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setPhotoEdited(false);
      setEditedPreview(null);
      setEditPrompt("");
      // Read base64 for AI editing
      if (!f.type.startsWith("video/")) {
        const reader = new FileReader();
        reader.onload = () => setSourceBase64(reader.result as string);
        reader.readAsDataURL(f);
      }
    }
  };

  const handleApplyEdit = async () => {
    if (!sourceBase64 || !editPrompt.trim()) return;
    setEditingPhoto(true);
    try {
      const { data, error } = await supabase.functions.invoke("edit-photo", {
        body: { imageBase64: editedPreview || sourceBase64, prompt: editPrompt.trim() },
      });
      if (error) throw error;
      if (data?.needs_credits) {
        toast({ title: "No credits remaining", description: "Purchase credits to use AI photo editing.", variant: "destructive" });
        return;
      }
      if (data?.error) {
        toast({ title: "Edit failed", description: data.error, variant: "destructive" });
        return;
      }
      if (data?.editedImageUrl) {
        setEditedPreview(data.editedImageUrl);
        setPhotoEdited(true);
        fetchCredits();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setEditingPhoto(false);
    }
  };

  const editSuggestions = [
    "Remove the background",
    "Add a cinematic color grade",
    "Make it look like a painting",
    "Enhance and sharpen",
  ];

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
        body: { prompt, provider: imageProvider },
      });
      if (error) throw error;
      if (data?.needs_credits) {
        toast({ title: "No credits remaining", description: "Purchase fal.ai credits to generate with FLUX.", variant: "destructive" });
        return;
      }
      if (data?.error) throw new Error(data.error);
      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        setAiTool("in-app");
        fetchCredits(); // refresh credits count
      }
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) return;
    setGeneratingVideo(true);
    setVideoStatus("Submitting...");
    try {
      // Step 1: Submit to queue
      const { data: submitData, error: submitError } = await supabase.functions.invoke("generate-video", {
        body: { action: "submit", prompt: videoPrompt, duration: videoDuration, audio: videoAudio },
      });
      if (submitError) throw submitError;
      if (submitData?.error) throw new Error(submitData.error);

      const reqId = submitData.request_id;
      if (!reqId) throw new Error("No request_id returned");

      // Step 2: Poll for completion
      setVideoStatus("Generating video...");
      const maxAttempts = 60;
      const pollInterval = 5000;

      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, pollInterval));
        setVideoStatus(`Generating video... (${Math.floor((i + 1) * pollInterval / 1000)}s)`);

        const { data: pollData, error: pollError } = await supabase.functions.invoke("generate-video", {
          body: { action: "poll", request_id: reqId },
        });

        if (pollError) continue;
        if (pollData?.error) throw new Error(pollData.error);

        if (pollData?.status === "COMPLETED" && pollData?.videoUrl) {
          setGeneratedVideo(pollData.videoUrl);
          setCategory("ai-video");
          toast({ title: "Video generated! 🎬" });
          setVideoStatus(null);
          setGeneratingVideo(false);
          return;
        }

        if (pollData?.status === "FAILED") {
          throw new Error("Video generation failed on the server");
        }
      }

      throw new Error("Video generation timed out after 5 minutes");
    } catch (error: any) {
      toast({ title: "Video generation failed", description: error.message, variant: "destructive" });
    } finally {
      setGeneratingVideo(false);
      setVideoStatus(null);
    }
  };

  const handlePost = async () => {
    if (!user) {
      toast({ title: "Please sign in to publish", description: "You need to be logged in to create a post.", variant: "destructive" });
      return;
    }
    if (mode === "upload" && !file) return;
    // No mandatory AI edit — the AI filter handles verification
    if (mode === "generate" && !generatedImage) {
      toast({ title: "Please generate an image first", variant: "destructive" });
      return;
    }
    if (mode === "video" && !generatedVideo) {
      toast({ title: "Please generate a video first", variant: "destructive" });
      return;
    }
    if (mode === "upload" && !aiTool) {
      toast({ title: "Please select the AI tool used", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let uploadedUrl = mode === "video" ? generatedVideo : generatedImage;
      const isVideo = mode === "video" || file?.type?.startsWith("video/");

      if (mode === "upload" && file) {
        if (editedPreview) {
          // Use the AI-edited image URL directly (already stored in media bucket)
          uploadedUrl = editedPreview;
        } else {
          const ext = file.name.split(".").pop();
          const path = `${user.id}/${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from("media").upload(path, file);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
          uploadedUrl = publicUrl;
        }
      }

      // Run AI filter on uploaded images (skip for videos and in-app generated)
      let verifiedAi = mode === "generate" || mode === "video";
      let filterResult: { is_ai_generated: boolean; confidence: number; reason: string; is_family_friendly?: boolean } | null = null;

      if (mode === "upload" && !isVideo && uploadedUrl) {
        setChecking(true);
        try {
          const { data: filterData, error: filterError } = await supabase.functions.invoke("ai-filter", {
            body: { imageUrl: uploadedUrl },
          });
          if (!filterError && filterData) {
            filterResult = filterData;
            setAiCheckResult(filterData);
            verifiedAi = filterData.is_ai_generated && filterData.confidence >= 0.7;
          }
        } catch (filterErr) {
          console.error("AI filter error:", filterErr);
        } finally {
          setChecking(false);
        }
      }

      const isFamilyFriendly = filterResult ? filterResult.is_family_friendly !== false : true;

      if (!isFamilyFriendly) {
        // Delete the uploaded file since we're rejecting the post
        if (uploadedUrl) {
          const path = uploadedUrl.split("/media/")[1];
          if (path) await supabase.storage.from("media").remove([path]);
        }
        toast({
          title: "Upload rejected",
          description: "Nudity and explicit content are strictly prohibited on AI-BOOM.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const needsReview = !verifiedAi && mode === "upload" && !isVideo;
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        image_url: isVideo ? null : uploadedUrl,
        video_url: isVideo ? uploadedUrl : null,
        caption,
        tags,
        category,
        ai_tool: mode === "generate" ? "in-app" : mode === "video" ? "fal.ai" : aiTool,
        is_verified_ai: verifiedAi,
        is_family_friendly: isFamilyFriendly,
        status: needsReview ? "pending_review" : "approved",
        voting_expires_at: needsReview ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
        allow_evolve: allowEvolve,
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
    <div className="min-h-screen pb-28 pt-4 px-4 text-foreground">
      <h1 className="text-2xl font-bold mb-4 text-foreground">Create Post</h1>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "upload" | "generate" | "video")}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="upload" className="flex-1 gap-2">
            <Upload className="h-4 w-4" /> Upload
          </TabsTrigger>
          <TabsTrigger value="generate" className="flex-1 gap-2">
            <Sparkles className="h-4 w-4" /> AI Image
          </TabsTrigger>
          <TabsTrigger value="video" className="flex-1 gap-2">
            <Video className="h-4 w-4" /> AI Video
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card className="border-dashed border-2 border-border/50 bg-card/50 mb-4">
            <CardContent className="p-6">
              {preview ? (
                <div className="space-y-3">
                  <div className="relative">
                    {file?.type?.startsWith("video/") ? (
                      <video src={preview} controls className="w-full rounded-lg max-h-80 object-cover" />
                    ) : (
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full rounded-lg max-h-80 object-cover"
                      />
                    )}
                    <button
                      onClick={() => { setFile(null); setPreview(null); }}
                      className="absolute top-2 right-2 rounded-full bg-background/80 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                   {/* Optional AI Edit section for images */}
                  {!file?.type?.startsWith("video/") && sourceBase64 && (
                    <div className="space-y-2 border border-border/50 rounded-lg p-3 bg-muted/30">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Wand2 className="h-3 w-3 text-primary" />
                        <span className="font-medium">Optional: AI Edit before posting</span>
                        {falCredits !== null && <span className="ml-auto">{falCredits} credits</span>}
                      </div>
                      {editedPreview && (
                        <div className="relative">
                          <img src={editedPreview} alt="Edited" className="w-full rounded-lg max-h-60 object-cover" />
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary/90 text-primary-foreground">Edited</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Describe how to edit..."
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                          rows={1}
                          className="resize-none text-xs min-h-[36px]"
                        />
                        <Button
                          size="sm"
                          onClick={handleApplyEdit}
                          disabled={editingPhoto || !editPrompt.trim() || (falCredits !== null && falCredits <= 0)}
                          className="shrink-0 gap-1"
                        >
                          {editingPhoto ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                          Edit
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {editSuggestions.map((s) => (
                          <button
                            key={s}
                            onClick={() => setEditPrompt(s)}
                            className="px-2 py-0.5 rounded-full text-[10px] bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50 transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    <ShieldCheck className="inline h-3 w-3 mr-1" />
                    AI filter will verify this content when you publish
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-8">
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                  <div className="text-center">
                    <span className="text-sm text-muted-foreground">Upload a photo or video</span>
                    <p className="text-xs text-muted-foreground/70 mt-1">Non-AI content will be sent to community vote</p>
                  </div>
                    <div className="flex gap-3">
                    <Button variant="outline" className="gap-2" onClick={() => galleryInputRef.current?.click()}>
                        <ImageIcon className="h-4 w-4" /> Gallery
                      </Button>
                      <input ref={galleryInputRef} type="file" accept="image/*,video/*" onChange={handleFileChange} className="absolute w-0 h-0 opacity-0 pointer-events-none" />
                    <Button onClick={() => cameraInputRef.current?.click()} className="gap-2">
                      <Camera className="h-4 w-4" /> Camera
                    </Button>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="absolute w-0 h-0 opacity-0 pointer-events-none"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2 mb-4">
            <Label>AI Tool Used *</Label>
            <Input
              placeholder="e.g. Midjourney, DALL-E, Stable Diffusion..."
              value={aiTool}
              onChange={(e) => setAiTool(e.target.value)}
            />
          </div>
        </TabsContent>

        <TabsContent value="generate">
          <Card className="bg-card/50 mb-4">
            <CardContent className="p-4 space-y-3">
              {generatedImage ? (
                <>
                  <div className="relative">
                    <img
                      src={generatedImage}
                      alt="Generated"
                      className="w-full rounded-lg max-h-80 object-cover cursor-pointer"
                      onClick={() => setLightboxOpen(true)}
                    />
                    <button
                      onClick={() => { setGeneratedImage(null); }}
                      className="absolute top-2 right-2 rounded-full bg-background/80 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <Textarea
                    placeholder="Edit your prompt and regenerate..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={2}
                  />
                  <Button onClick={handleGenerate} disabled={generating || !prompt.trim()} className="w-full gap-2" variant="secondary">
                    <Sparkles className="h-4 w-4" />
                    {generating ? "Regenerating..." : "Edit & Regenerate"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 text-sm">
                      <Coins className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">
                        Credits: <span className="font-semibold text-foreground">{falCredits ?? "..."}</span>
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/subscribe")}
                      className="gap-1.5 text-xs"
                    >
                      <Coins className="h-3 w-3" />
                      Buy Credits
                    </Button>
                  </div>

                  <Textarea
                    placeholder="Describe the image you want to generate..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={handleGenerate}
                    disabled={generating || !prompt.trim() || (falCredits !== null && falCredits <= 0)}
                    className="w-full gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    {generating ? "Generating..." : "Generate with FLUX"}
                  </Button>
                  {falCredits !== null && falCredits <= 0 && (
                    <p className="text-xs text-destructive text-center">Purchase credits to generate with FLUX</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="video">
          <Card className="bg-card/50 mb-4">
            <CardContent className="p-4 space-y-3">
              {generatedVideo ? (
                <>
                  <div className="relative">
                    <video src={generatedVideo} controls className="w-full rounded-lg max-h-80 object-cover" playsInline />
                    <button
                      onClick={() => setGeneratedVideo(null)}
                      className="absolute top-2 right-2 rounded-full bg-background/80 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <Textarea
                    placeholder="Edit your prompt and regenerate..."
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    rows={2}
                  />
                  <Button onClick={handleGenerateVideo} disabled={generatingVideo || !videoPrompt.trim()} className="w-full gap-2" variant="secondary">
                    <Video className="h-4 w-4" />
                    {generatingVideo ? "Regenerating..." : "Edit & Regenerate"}
                  </Button>
                </>
              ) : (
              <>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 text-sm">
                      <Coins className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">
                        Credits: <span className="font-semibold text-foreground">{falCredits ?? "..."}</span>
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/subscribe")}
                      className="gap-1.5 text-xs"
                    >
                      <Coins className="h-3 w-3" />
                      Buy Credits
                    </Button>
                  </div>

                  <Textarea
                    placeholder="Describe the video you want to create... (e.g. 'A golden sunset over calm ocean waves, cinematic slow motion')"
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    rows={3}
                  />

                  {/* Duration selector */}
                  <div className="space-y-2">
                    <Label className="text-sm">Video Length</Label>
                    <div className="flex gap-2">
                      {[3, 5, 7, 10].map((sec) => (
                        <button
                          key={sec}
                          onClick={() => setVideoDuration(sec)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            videoDuration === sec
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Audio toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div>
                      <Label htmlFor="video-audio" className="text-sm cursor-pointer">Include Audio</Label>
                      <p className="text-[10px] text-muted-foreground">AI-generated soundtrack (2× cost)</p>
                    </div>
                    <Switch id="video-audio" checked={videoAudio} onCheckedChange={setVideoAudio} />
                  </div>

                  {/* Cost preview */}
                  <div className="text-center text-sm text-muted-foreground">
                    Cost: <span className="font-semibold text-foreground">{videoDuration * (videoAudio ? 14 : 7)} credits</span>
                    <span className="text-xs ml-1">(${((videoDuration * (videoAudio ? 14 : 7)) * 0.05).toFixed(2)})</span>
                  </div>

                  <Button onClick={handleGenerateVideo} disabled={generatingVideo || !videoPrompt.trim() || (falCredits !== null && falCredits < videoDuration * (videoAudio ? 14 : 7))} className="w-full gap-2">
                    {generatingVideo ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> {videoStatus || "Generating..."}</>
                    ) : (
                      <><Video className="h-4 w-4" /> Generate Video</>
                    )}
                  </Button>
                  {falCredits !== null && falCredits < videoDuration * (videoAudio ? 14 : 7) && (
                    <p className="text-xs text-destructive text-center">Not enough credits for this video</p>
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    Video generation may take 1-3 minutes
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Shared fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Caption</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-muted-foreground"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text.trim()) {
                    setCaption(text.trim());
                    toast({ title: "Prompt pasted to caption ✨" });
                  } else {
                    toast({ title: "Clipboard is empty", variant: "destructive" });
                  }
                } catch {
                  toast({ title: "Clipboard access denied", description: "Please allow clipboard access in your browser.", variant: "destructive" });
                }
              }}
            >
              📋 Paste prompt to caption
            </Button>
          </div>
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

        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <Label htmlFor="allow-evolve" className="text-sm cursor-pointer">Allow others to evolve</Label>
          </div>
          <Switch id="allow-evolve" checked={allowEvolve} onCheckedChange={setAllowEvolve} />
        </div>

        <Button onClick={handlePost} disabled={loading || checking || generatingVideo} className="w-full" size="lg">
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

        {/* Fullscreen lightbox */}
        {lightboxOpen && generatedImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 cursor-pointer"
            onClick={() => setLightboxOpen(false)}
          >
            <img
              src={generatedImage}
              alt="Full size generated image"
              className="max-w-full max-h-full object-contain p-4"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Create;
