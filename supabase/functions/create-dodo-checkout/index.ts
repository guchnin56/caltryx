import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DODO_PAYMENTS_KEY = Deno.env.get("DODO_PAYMENTS_KEY");
const DODO_PRODUCT_STANDARD_ID = Deno.env.get("DODO_PRODUCT_STANDARD_ID");
const DODO_PRODUCT_VIP_ID = Deno.env.get("DODO_PRODUCT_VIP_ID");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));

    // Diagnostic log visible in Supabase Edge Function logs
    console.log("=== Checkout Diagnostic ===");
    console.log("KEY present:", !!DODO_PAYMENTS_KEY);
    if (DODO_PAYMENTS_KEY) {
      console.log("KEY prefix:", DODO_PAYMENTS_KEY.substring(0, 12) + "...");
    }
    console.log("STD_ID:", DODO_PRODUCT_STANDARD_ID ?? "(MISSING)");
    console.log("VIP_ID:", DODO_PRODUCT_VIP_ID ?? "(MISSING)");

    if (!DODO_PAYMENTS_KEY) {
      return reply({ 
        error: "DODO_PAYMENTS_KEY is not set in Supabase. Run 'supabase secrets set DODO_PAYMENTS_KEY=...' in your terminal." 
      });
    }

    if (body.ping) {
      return reply({
        pong: true,
        key_detected: true,
        key_prefix: DODO_PAYMENTS_KEY.substring(0, 8),
        std: DODO_PRODUCT_STANDARD_ID,
        vip: DODO_PRODUCT_VIP_ID,
      });
    }

    const { plan, email, return_url } = body;
    if (!email || !plan) return reply({ error: "Email and plan are required." });

    const productId = plan === 'vip' ? DODO_PRODUCT_VIP_ID : DODO_PRODUCT_STANDARD_ID;
    if (!productId) return reply({ error: `Product ID for plan '${plan}' is missing.` });

    // Environment detection:
    // 1. Explicit override from environment variable (if set)
    // 2. Standard Dodo prefixes
    // 3. Fallback: Check if the key contains 'test' or 'sk_test'
    // 4. Manual catch: If it starts with 'EGII', it might be a test key from certain Dodo environments
    const modeOverride = Deno.env.get("DODO_PAYMENTS_MODE");
    const isTest = modeOverride === 'test' || 
                   DODO_PAYMENTS_KEY.includes('test') || 
                   DODO_PAYMENTS_KEY.startsWith('test_') ||
                   DODO_PAYMENTS_KEY.startsWith('EGII'); // Assuming EGII for this project is currently Test

    const baseUrl = isTest ? 'https://test.dodopayments.com' : 'https://live.dodopayments.com';

    console.log(`→ Creating checkout session: ${baseUrl}/checkouts | product: ${productId} | customer: ${email} | mode: ${isTest ? 'TEST' : 'LIVE'}`);

    const dodoRes = await fetch(`${baseUrl}/checkouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_PAYMENTS_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email },
        return_url: return_url || `${new URL(req.url).origin}/waitlist?email=${encodeURIComponent(email)}&status=success&plan=${plan}`,
        payment_link: true,
      }),
    });

    const responseText = await dodoRes.text();
    console.log(`← Dodo response: ${dodoRes.status} | body: ${responseText}`);

    let dodoData: Record<string, unknown> = {};
    try { dodoData = JSON.parse(responseText); } catch { dodoData = { raw: responseText }; }

    if (dodoRes.ok && (dodoData.checkout_url || dodoData.url)) {
      return reply({ checkout_url: dodoData.checkout_url || dodoData.url });
    }

    // Handle 401 specifically to guide the user
    if (dodoRes.status === 401) {
      return reply({ 
        error: `Dodo rejected the API key (401). Please verify that DODO_PAYMENTS_KEY is your SECRET key and matches the environment (Test vs Live). Key prefix: ${DODO_PAYMENTS_KEY.substring(0, 10)}...`
      });
    }

    const errMsg = dodoData.message || dodoData.error || dodoData.detail
      || `Dodo rejected with status ${dodoRes.status}: ${responseText}`;
    return reply({ error: errMsg });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("CRASH:", msg);
    return reply({ error: `Server error: ${msg}` });
  }
});
