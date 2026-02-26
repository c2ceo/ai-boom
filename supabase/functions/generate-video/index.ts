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

    // Check for explicit/NSFW content in prompt
    if (prompt) {
      const nsfwPatterns = /\b(nude|naked|nsfw|porn|xxx|hentai|erotic|sexual|genitalia|explicit|uncensored|topless|bottomless|intercourse|orgasm|masturbat|fetish|bondage|bdsm)\b/i;
      if (nsfwPatterns.test(prompt)) {
        return new Response(JSON.stringify({ error: "Explicit content generation is prohibited on AI-BOOM", explicit_blocked: true }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // For submit action, authenticate and deduct credits (40 credits = $2)
    if (action === "submit") {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Authentication required");
      const token = authHeader.replace("Bearer ", "");
      const { data: authData } = await anonClient.auth.getUser(token);
      const userId = authData.user?.id;
      if (!userId) throw new Error("User not authenticated");

      // Check if user is among first 10 accounts and has free generations this month
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        .order("created_at", { ascending: true })
        .limit(10);

      const isEligibleForFree = allProfiles?.some((p: any) => p.user_id === userId) ?? false;
      let usedFreeGeneration = false;

      if (isEligibleForFree) {
        const { data: freeGen } = await supabase
          .from("free_generations")
          .select("generations_used")
          .eq("user_id", userId)
          .eq("month", currentMonth)
          .maybeSingle();

        if (!freeGen || freeGen.generations_used < 3) {
          usedFreeGeneration = true;
          if (freeGen) {
            await supabase
              .from("free_generations")
              .update({ generations_used: freeGen.generations_used + 1 })
              .eq("user_id", userId)
              .eq("month", currentMonth);
          } else {
            await supabase
              .from("free_generations")
              .insert({ user_id: userId, month: currentMonth, generations_used: 1 });
          }
        }
      }

      if (!usedFreeGeneration) {
        const { data: credits } = await supabase
          .from("fal_credits")
          .select("credits_remaining")
          .eq("user_id", userId)
          .maybeSingle();

        if (!credits || credits.credits_remaining < 40) {
          return new Response(JSON.stringify({ error: "Not enough credits. Video generation costs 40 credits ($2). Purchase more credits to continue.", needs_credits: true }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase
          .from("fal_credits")
          .update({ credits_remaining: credits.credits_remaining - 40, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
      }
    }

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
