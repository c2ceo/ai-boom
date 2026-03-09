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
    const { imageBase64, prompt } = await req.json();
    if (!imageBase64 || !prompt) {
      return new Response(
        JSON.stringify({ error: "imageBase64 and prompt are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentication required");
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await anonClient.auth.getUser(token);
    const userId = authData.user?.id;
    if (!userId) throw new Error("User not authenticated");

    // Check credits (1 credit per edit)
    const { data: credits } = await supabase
      .from("fal_credits")
      .select("credits_remaining")
      .eq("user_id", userId)
      .single();

    if (!credits || credits.credits_remaining <= 0) {
      return new Response(
        JSON.stringify({ error: "No credits remaining. Purchase credits to continue.", needs_credits: true }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct 1 credit
    await supabase
      .from("fal_credits")
      .update({ credits_remaining: credits.credits_remaining - 1, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    // Upload source image to storage so fal.ai can access it via URL
    const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
    if (!FAL_API_KEY) throw new Error("FAL_API_KEY not configured");

    // Decode base64 and upload to get a public URL for fal.ai
    const base64Match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    let sourceUrl = imageBase64;

    if (base64Match) {
      const mimeType = base64Match[1];
      const raw = atob(base64Match[2]);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

      const ext = mimeType.includes("png") ? "png" : "jpg";
      const tmpPath = `edit-sources/${userId}/${Date.now()}.${ext}`;
      await supabase.storage.from("media").upload(tmpPath, bytes, { contentType: mimeType });
      const { data: urlData } = supabase.storage.from("media").getPublicUrl(tmpPath);
      sourceUrl = urlData.publicUrl;
    }

    // Call fal.ai creative upscaler / image-to-image with FLUX
    const falRes = await fetch("https://fal.run/fal-ai/flux/dev/image-to-image", {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_url: sourceUrl,
        strength: 0.75,
        image_size: "landscape_16_9",
        num_images: 1,
      }),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      console.error("fal.ai edit error:", falRes.status, errText);
      // Refund credit on failure
      await supabase
        .from("fal_credits")
        .update({ credits_remaining: credits.credits_remaining, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      throw new Error(`Image editing failed (${falRes.status})`);
    }

    const falData = await falRes.json();
    const editedUrl = falData.images?.[0]?.url;
    if (!editedUrl) {
      // Refund credit
      await supabase
        .from("fal_credits")
        .update({ credits_remaining: credits.credits_remaining, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      throw new Error("No edited image returned");
    }

    // Download and re-upload to our storage
    const downloadRes = await fetch(editedUrl);
    const imageBytes = new Uint8Array(await downloadRes.arrayBuffer());
    const contentType = downloadRes.headers.get("content-type") || "image/png";
    const outExt = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
    const fileName = `edited/${userId}/${Date.now()}.${outExt}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(fileName, imageBytes, { contentType });
    if (uploadError) throw uploadError;

    const { data: finalUrl } = supabase.storage.from("media").getPublicUrl(fileName);

    return new Response(
      JSON.stringify({ editedImageUrl: finalUrl.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("edit-photo error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
