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
    const { post_id } = await req.json();
    if (!post_id) throw new Error("post_id is required");

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentication required");
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await anonClient.auth.getUser(token);
    const userId = authData.user?.id;
    if (!userId) throw new Error("User not authenticated");

    // Fetch the post
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("image_url, video_url, caption")
      .eq("id", post_id)
      .single();

    if (postError || !post) throw new Error("Post not found");

    const isVideo = !!post.video_url;
    const mediaUrl = isVideo ? post.video_url : post.image_url;
    if (!mediaUrl) throw new Error("Post has no media to evolve");

    // For now, only support image evolution
    if (isVideo) throw new Error("Video evolution coming soon! Only images can be evolved right now.");

    const creditCost = 1; // 1 credit per evolve

    // Check free generations first
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

      if (!credits || credits.credits_remaining < creditCost) {
        return new Response(JSON.stringify({ error: "No credits remaining. Purchase credits to evolve.", needs_credits: true }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("fal_credits")
        .update({ credits_remaining: credits.credits_remaining - creditCost, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    }

    // Call Lovable AI (Gemini) to evolve the image
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const evolvePrompt = `Evolve this AI-generated image into something more extraordinary. Enhance it dramatically: amplify colors, add more intricate details, increase visual complexity, make it more surreal and dreamlike. Keep the core subject but push it to the next level of artistic quality. Make it feel like a higher evolution of the original.${post.caption ? ` The original concept was: ${post.caption}` : ""}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: [
              { type: "text", text: evolvePrompt },
              { type: "image_url", image_url: { url: mediaUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI evolve error:", aiRes.status, errText);
      throw new Error(`Image evolution failed (${aiRes.status})`);
    }

    const aiData = await aiRes.json();
    const evolvedBase64 = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!evolvedBase64) throw new Error("No evolved image returned");

    // Convert base64 to bytes and upload
    const base64Data = evolvedBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const fileName = `evolved/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(fileName, imageBytes, { contentType: "image/png" });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
    const newImageUrl = urlData.publicUrl;

    // Update the post with the evolved image
    const { error: updateError } = await supabase
      .from("posts")
      .update({ image_url: newImageUrl, updated_at: new Date().toISOString() })
      .eq("id", post_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ imageUrl: newImageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evolve-post error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
