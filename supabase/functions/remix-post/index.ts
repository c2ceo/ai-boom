import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function analyzeImage(imageUrl: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Describe this image in rich detail: subject, style, colors, mood, composition, artistic elements. Be vivid and specific in 3-4 sentences." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }],
      }),
    });
    if (!response.ok) return "AI-generated digital artwork";
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "AI-generated digital artwork";
  } catch {
    return "AI-generated digital artwork";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { remix_type, post_id, caption, image_url, comments, custom_prompt } = await req.json();

    // Check daily remix count
    const UNLIMITED_USER_IDS = ["75dd469b-9f26-4f12-bd4e-c38736ed951b"];
    const isUnlimited = UNLIMITED_USER_IDS.includes(user.id);

    let dailyCount = 0;
    if (!isUnlimited) {
      const { data: countData } = await supabase.rpc("get_daily_remix_count", { p_user_id: user.id });
      dailyCount = countData ?? 0;
      if (dailyCount >= 3) {
        return new Response(JSON.stringify({ error: "Daily remix limit reached (3/day). Subscribe for unlimited remixes!", limit_reached: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Analyze the image if available
    let imageDescription = "AI-generated digital artwork";
    if (image_url) {
      imageDescription = await analyzeImage(image_url, LOVABLE_API_KEY);
    }

    const customNote = custom_prompt ? `\n\nUser's custom direction: "${custom_prompt}"` : "";
    let result: any = {};

    if (remix_type === "business_idea") {
      const prompt = `You are a creative business strategist. Based on this AI-generated artwork/content, generate a compelling business idea.

Post caption: "${caption || "No caption"}"
Image analysis: ${imageDescription}${customNote}

Generate a business idea that could be built around this type of content. Include:
1. Business Name (creative and catchy)
2. One-line Pitch
3. Target Market
4. Revenue Model
5. Why It Could Work (2-3 sentences)

Be creative, specific, and actionable. Format with clear headings.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) return new Response(JSON.stringify({ error: "AI rate limit reached. Try again shortly." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status}`);
      }

      const aiData = await aiResponse.json();
      result = { text: aiData.choices?.[0]?.message?.content || "No result" };

    } else if (remix_type === "video") {
      const prompt = `You are a creative director. Based on this AI artwork, create a detailed video concept/storyboard.

Post caption: "${caption || "No caption"}"
Image analysis: ${imageDescription}${customNote}

Create a compelling 30-second video concept including:
1. 🎬 Video Title
2. 🎯 Concept (2-3 sentences describing the video)
3. 📋 Shot-by-Shot Breakdown (5-6 shots with timing, camera movement, and description)
4. 🎵 Suggested Soundtrack/Mood
5. ✨ Visual Effects & Transitions

Make it cinematic, creative, and something that would go viral on social media.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) return new Response(JSON.stringify({ error: "AI rate limit reached." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status}`);
      }

      const aiData = await aiResponse.json();
      result = { text: aiData.choices?.[0]?.message?.content || "No result" };

    } else if (remix_type === "song") {
      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      if (!ELEVENLABS_API_KEY) throw new Error("ElevenLabs not configured");

      // Use image analysis + custom prompt for better music generation
      const musicPromptInput = custom_prompt
        ? `Based on this image: "${imageDescription}" and user direction: "${custom_prompt}", write a short vivid music generation prompt (max 50 words) describing genre, mood, instruments, and tempo. Only return the prompt.`
        : `Based on this AI artwork: "${imageDescription}" with caption "${caption || "abstract digital art"}", write a short, vivid music generation prompt (max 50 words) describing genre, mood, instruments, and tempo. Only return the prompt, nothing else.`;

      const promptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{ role: "user", content: musicPromptInput }],
        }),
      });

      let musicPrompt = "upbeat electronic ambient track with synths and soft drums";
      if (promptResponse.ok) {
        const promptData = await promptResponse.json();
        musicPrompt = promptData.choices?.[0]?.message?.content || musicPrompt;
      }

      const musicResponse = await fetch("https://api.elevenlabs.io/v1/music", {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: musicPrompt,
          duration_seconds: 15,
        }),
      });

      if (!musicResponse.ok) {
        throw new Error(`ElevenLabs error: ${musicResponse.status}`);
      }

      const audioBuffer = await musicResponse.arrayBuffer();

      const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const filename = `remixes/${user.id}/${Date.now()}.mp3`;
      const { error: uploadError } = await serviceClient.storage
        .from("media")
        .upload(filename, audioBuffer, { contentType: "audio/mpeg" });

      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = serviceClient.storage.from("media").getPublicUrl(filename);

      result = { text: `🎵 AI-generated track inspired by this post:\n\n*Prompt: ${musicPrompt}*`, url: publicUrl };

    } else if (remix_type === "summary") {
      if (!comments || comments.length === 0) {
        return new Response(JSON.stringify({ error: "No comments to summarize" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const commentsText = comments.map((c: any) => `@${c.username}: ${c.content}`).join("\n");
      const prompt = `Summarize this discussion thread into key insights. Be concise and highlight the most interesting points, agreements, and disagreements.

Discussion:
${commentsText}

Format as:
🔑 Key Insights (3-5 bullet points)
💡 Most Interesting Take
🤝 Points of Agreement
⚡ Points of Debate (if any)`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!aiResponse.ok) throw new Error(`AI error: ${aiResponse.status}`);
      const aiData = await aiResponse.json();
      result = { text: aiData.choices?.[0]?.message?.content || "No insights" };

    } else {
      return new Response(JSON.stringify({ error: "Invalid remix_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save remix to database
    await supabase.from("remixes").insert({
      user_id: user.id,
      post_id,
      remix_type,
      result_text: result.text,
      result_url: result.url || null,
    });

    const remaining = isUnlimited ? 999 : Math.max(0, 2 - (dailyCount ?? 0));
    return new Response(JSON.stringify({ success: true, ...result, remaining }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Remix error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
