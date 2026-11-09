import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.95.3";

import { corsHeaders } from "npm:@supabase/supabase-js@2.95.3/cors";
import { validateCreditPayment } from "../_shared/credit-pack.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Please sign in to verify payment");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { session_id } = await req.json();
    if (typeof session_id !== "string" || !/^cs_[a-zA-Z0-9_]+$/.test(session_id)) throw new Error("session_id is required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    const creditAmount = validateCreditPayment(session, user.id);
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: added, error: fulfillmentError } = await serviceClient.rpc("fulfill_stripe_credits", {
      p_session_id: session.id,
      p_user_id: user.id,
      p_credits: creditAmount,
    });
    if (fulfillmentError) throw new Error("Could not apply credits. Please retry payment verification.");

    return new Response(JSON.stringify({ success: true, credits_added: added ? creditAmount : 0, already_applied: !added }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("verify-fal-payment error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Verification failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
