import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("Not authenticated");

    const { recipient_user_id, amount } = await req.json();
    if (!recipient_user_id || !amount) throw new Error("recipient_user_id and amount are required");
    
    const creditAmount = parseInt(amount);
    if (isNaN(creditAmount) || creditAmount < 1) throw new Error("Amount must be at least 1");
    if (recipient_user_id === user.id) throw new Error("You cannot gift credits to yourself");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify recipient exists
    const { data: recipientProfile } = await serviceClient
      .from("profiles")
      .select("user_id, username")
      .eq("user_id", recipient_user_id)
      .single();

    if (!recipientProfile) throw new Error("Recipient not found");

    // Check sender has enough credits
    const { data: senderCredits } = await serviceClient
      .from("fal_credits")
      .select("credits_remaining")
      .eq("user_id", user.id)
      .single();

    if (!senderCredits || senderCredits.credits_remaining < creditAmount) {
      throw new Error("Insufficient credits");
    }

    // Deduct from sender
    await serviceClient
      .from("fal_credits")
      .update({
        credits_remaining: senderCredits.credits_remaining - creditAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    // Add to recipient (upsert)
    const { data: recipientCredits } = await serviceClient
      .from("fal_credits")
      .select("credits_remaining")
      .eq("user_id", recipient_user_id)
      .single();

    if (recipientCredits) {
      await serviceClient
        .from("fal_credits")
        .update({
          credits_remaining: recipientCredits.credits_remaining + creditAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", recipient_user_id);
    } else {
      await serviceClient
        .from("fal_credits")
        .insert({
          user_id: recipient_user_id,
          credits_remaining: creditAmount,
          total_purchased: 0,
        });
    }

    // Create a notification for the recipient
    await serviceClient.from("notifications").insert({
      user_id: recipient_user_id,
      actor_id: user.id,
      type: "gift_credits",
    });

    return new Response(JSON.stringify({ success: true, credits_gifted: creditAmount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
