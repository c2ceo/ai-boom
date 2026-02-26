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
    const { prompt } = await req.json();
    if (!prompt) throw new Error("Prompt is required");

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user and check credits
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentication required");
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await anonClient.auth.getUser(token);
    const userId = authData.user?.id;
    if (!userId) throw new Error("User not authenticated");

    // Check if user is among first 10 accounts and has free generations this month
    const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
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
        // Use a free generation
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
        .single();

      if (!credits || credits.credits_remaining <= 0) {
        return new Response(JSON.stringify({ error: "No credits remaining. Purchase credits to continue.", needs_credits: true }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("fal_credits")
        .update({ credits_remaining: credits.credits_remaining - 1, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    }

    // Deduct one credit
    await supabase
      .from("fal_credits")
      .update({ credits_remaining: credits.credits_remaining - 1, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    // Generate image with fal.ai FLUX
    const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
    if (!FAL_API_KEY) throw new Error("FAL_API_KEY not configured");

    const falRes = await fetch("https://fal.run/fal-ai/flux/dev", {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, image_size: "landscape_16_9", num_images: 1 }),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      console.error("fal.ai error:", falRes.status, errText);
      throw new Error(`Image generation failed (${falRes.status})`);
    }

    const falData = await falRes.json();
    const imageUrl = falData.images?.[0]?.url;
    if (!imageUrl) throw new Error("No image returned");

    const downloadRes = await fetch(imageUrl);
    const imageBytes = new Uint8Array(await downloadRes.arrayBuffer());
    const contentType = downloadRes.headers.get("content-type") || "image/png";

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
