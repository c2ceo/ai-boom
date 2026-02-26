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

    const { action, prompt, image_url, request_id, model } = await req.json();

    const videoModel = model || (image_url ? "fal-ai/minimax-video/image-to-video" : "fal-ai/minimax-video");

    if (action === "submit") {
      // Submit job to fal.ai queue
      if (!prompt) throw new Error("Prompt is required");

      const input: any = { prompt };
      if (image_url) input.image_url = image_url;

      const submitRes = await fetch(`https://queue.fal.run/${videoModel}`, {
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

      const data = await submitRes.json();
      return new Response(JSON.stringify({ request_id: data.request_id, status: "IN_QUEUE" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "poll") {
      // Check status of existing job
      if (!request_id) throw new Error("request_id is required");

      const statusRes = await fetch(
        `https://queue.fal.run/${videoModel}/requests/${request_id}/status`,
        { headers: { Authorization: `Key ${FAL_API_KEY}` } }
      );

      if (!statusRes.ok) {
        throw new Error(`Status check failed (${statusRes.status})`);
      }

      const status = await statusRes.json();

      if (status.status === "COMPLETED") {
        // Fetch the result
        const resultRes = await fetch(
          `https://queue.fal.run/${videoModel}/requests/${request_id}`,
          { headers: { Authorization: `Key ${FAL_API_KEY}` } }
        );

        if (!resultRes.ok) throw new Error("Failed to fetch result");
        const result = await resultRes.json();
        const videoUrl = result.video?.url;
        if (!videoUrl) throw new Error("No video URL in result");

        // Download and upload to storage
        const videoRes = await fetch(videoUrl);
        const videoBytes = new Uint8Array(await videoRes.arrayBuffer());

        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const fileName = `generated-videos/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(fileName, videoBytes, { contentType: "video/mp4" });

        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);

        return new Response(JSON.stringify({ status: "COMPLETED", videoUrl: urlData.publicUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: status.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      throw new Error("Invalid action. Use 'submit' or 'poll'.");
    }
  } catch (e) {
    console.error("generate-video error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
