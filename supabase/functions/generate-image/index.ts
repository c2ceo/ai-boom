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
    const { prompt, provider = "gemini" } = await req.json();
    if (!prompt) throw new Error("Prompt is required");

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // For fal provider, check and deduct credits
    if (provider === "fal") {
      // Get user from auth header
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Authentication required for fal.ai generation");
      const token = authHeader.replace("Bearer ", "");
      const { data: authData } = await anonClient.auth.getUser(token);
      const userId = authData.user?.id;
      if (!userId) throw new Error("User not authenticated");

      const { data: credits } = await supabase
        .from("fal_credits")
        .select("credits_remaining")
        .eq("user_id", userId)
        .single();

      if (!credits || credits.credits_remaining <= 0) {
        return new Response(JSON.stringify({ error: "No fal.ai credits remaining. Purchase credits to continue.", needs_credits: true }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deduct one credit
      await supabase
        .from("fal_credits")
        .update({ credits_remaining: credits.credits_remaining - 1, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    }

    let imageBytes: Uint8Array;
    let contentType = "image/png";

    if (provider === "fal") {
      // fal.ai FLUX image generation
      const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
      if (!FAL_API_KEY) throw new Error("FAL_API_KEY not configured");

      const falRes = await fetch("https://fal.run/fal-ai/flux/dev", {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          image_size: "landscape_16_9",
          num_images: 1,
        }),
      });

      if (!falRes.ok) {
        const errText = await falRes.text();
        console.error("fal.ai error:", falRes.status, errText);
        throw new Error(`fal.ai generation failed (${falRes.status})`);
      }

      const falData = await falRes.json();
      const imageUrl = falData.images?.[0]?.url;
      if (!imageUrl) throw new Error("No image returned from fal.ai");

      // Download the image
      const downloadRes = await fetch(imageUrl);
      imageBytes = new Uint8Array(await downloadRes.arrayBuffer());
      contentType = downloadRes.headers.get("content-type") || "image/png";

    } else {
      // Gemini image generation (default)
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: `Generate a high-quality AI art image based on this description: ${prompt}. Make it visually stunning, creative, and suitable for a social media post. Ultra high resolution.`,
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const text = await response.text();
        console.error("AI gateway error:", response.status, text);
        throw new Error("AI generation failed");
      }

      const data = await response.json();
      const base64Url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!base64Url) throw new Error("No image was generated");

      const base64Data = base64Url.replace(/^data:image\/\w+;base64,/, "");
      imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    }

    // Upload to storage
    const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
    const fileName = `generated/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(fileName, imageBytes, { contentType });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);

    return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
