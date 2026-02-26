import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
    if (!FAL_API_KEY) throw new Error("FAL_API_KEY not configured");

    const { prompt, image_url } = await req.json();
    if (!prompt) throw new Error("Prompt is required");

    // Choose model: image-to-video if image provided, else text-to-video
    const model = image_url
      ? "fal-ai/minimax-video/image-to-video"
      : "fal-ai/minimax-video";

    const input: any = { prompt };
    if (image_url) {
      input.image_url = image_url;
    }

    // Submit to fal.ai queue
    const submitRes = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      console.error("fal.ai submit error:", submitRes.status, errText);
      throw new Error(`fal.ai submit failed (${submitRes.status})`);
    }

    const { request_id } = await submitRes.json();

    // Poll for completion (max ~3 minutes)
    const maxAttempts = 60;
    const pollInterval = 3000;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, pollInterval));

      const statusRes = await fetch(
        `https://queue.fal.run/${model}/requests/${request_id}/status`,
        {
          headers: { Authorization: `Key ${FAL_API_KEY}` },
        }
      );

      if (!statusRes.ok) continue;
      const status = await statusRes.json();

      if (status.status === "COMPLETED") {
        // Fetch result
        const resultRes = await fetch(
          `https://queue.fal.run/${model}/requests/${request_id}`,
          {
            headers: { Authorization: `Key ${FAL_API_KEY}` },
          }
        );

        if (!resultRes.ok) throw new Error("Failed to fetch result");
        const result = await resultRes.json();

        const videoUrl = result.video?.url;
        if (!videoUrl) throw new Error("No video URL in result");

        // Download video and upload to storage
        const videoRes = await fetch(videoUrl);
        const videoBytes = new Uint8Array(await videoRes.arrayBuffer());

        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const fileName = `generated-videos/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(fileName, videoBytes, { contentType: "video/mp4" });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);

        return new Response(JSON.stringify({ videoUrl: urlData.publicUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (status.status === "FAILED") {
        throw new Error("Video generation failed: " + (status.error || "unknown error"));
      }
    }

    throw new Error("Video generation timed out");
  } catch (e) {
    console.error("generate-video error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
