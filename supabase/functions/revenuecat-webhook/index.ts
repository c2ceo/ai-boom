import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify webhook authorization
  const authHeader = req.headers.get("Authorization");
  const expectedSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json();
    const event = body.event;

    if (!event) {
      return new Response(JSON.stringify({ error: "No event in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType = event.type;
    const appUserId = event.app_user_id; // This is the Supabase user ID we set
    const entitlements = event.subscriber_attributes?.entitlements || {};
    const subscriberEntitlements = event.subscriber?.entitlements || {};

    // Check if AI-BOOM entitlement is active
    const aiBoomEntitlement = subscriberEntitlements["AI-BOOM"];
    const isActive =
      aiBoomEntitlement &&
      new Date(aiBoomEntitlement.expires_date) > new Date() &&
      !aiBoomEntitlement.unsubscribe_detected_at;

    const productId =
      aiBoomEntitlement?.product_identifier ||
      event.product_id ||
      null;

    const expiresAt = aiBoomEntitlement?.expires_date || null;

    console.log(
      `RevenueCat webhook: ${eventType} for user ${appUserId}, AI-BOOM active: ${isActive}`
    );

    // Upsert subscription record
    const { error: upsertError } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: appUserId,
          entitlement: "AI-BOOM",
          is_active: !!isActive,
          product_id: productId,
          expires_at: expiresAt,
          rc_customer_id: event.subscriber?.original_app_user_id || appUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,entitlement" }
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
