import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { CREDIT_PACK } from "../_shared/credit-pack.ts";

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
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Please sign in to buy credits");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const body = await req.json().catch(() => ({}));
    if (body.pack !== undefined && body.pack !== "50") throw new Error("Invalid credit pack");
    const origin = req.headers.get("origin");
    const allowed = ["https://ai-boom.com", "https://www.ai-boom.com", "https://ai-boom.lovable.app", "http://localhost:8080", "https://id-preview--02b81099-7e8b-41d8-b933-b0b6d301ced6.lovable.app"];
    if (!origin || !allowed.includes(origin)) throw new Error("Invalid checkout origin");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: CREDIT_PACK.priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${origin}/subscribe?credits_purchased=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscribe?canceled=true`,
      metadata: {
        user_id: user.id,
        credit_amount: String(CREDIT_PACK.credits),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Checkout failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
