import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find expired pending_review posts
    const { data: expiredPosts, error: fetchErr } = await supabase
      .from("posts")
      .select("id")
      .eq("status", "pending_review")
      .lt("voting_expires_at", new Date().toISOString());

    if (fetchErr) throw fetchErr;
    if (!expiredPosts?.length) {
      return new Response(JSON.stringify({ resolved: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resolved = 0;
    for (const post of expiredPosts) {
      const { data: votes } = await supabase
        .from("post_votes")
        .select("vote_ai")
        .eq("post_id", post.id);

      const aiVotes = votes?.filter((v: any) => v.vote_ai).length || 0;
      const notAiVotes = votes?.filter((v: any) => !v.vote_ai).length || 0;

      // Majority wins; ties favor AI (benefit of the doubt)
      const isAi = aiVotes >= notAiVotes;

      if (isAi) {
        // Approved as AI — publish the post
        await supabase
          .from("posts")
          .update({ status: "approved", is_verified_ai: true })
          .eq("id", post.id);
      } else {
        // Rejected as not AI — delete the post entirely
        await supabase.from("post_votes").delete().eq("post_id", post.id);
        await supabase.from("likes").delete().eq("post_id", post.id);
        await supabase.from("comments").delete().eq("post_id", post.id);
        await supabase.from("reports").delete().eq("post_id", post.id);
        await supabase.from("notifications").delete().eq("post_id", post.id);
        await supabase.from("posts").delete().eq("id", post.id);
      }

      resolved++;
    }

    return new Response(JSON.stringify({ resolved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resolve-votes error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
