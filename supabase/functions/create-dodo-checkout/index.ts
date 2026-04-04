import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DODO_PAYMENTS_KEY = Deno.env.get("DODO_PAYMENTS_KEY");
const DODO_PRODUCT_STANDARD_ID = Deno.env.get("DODO_PRODUCT_STANDARD_ID");
const DODO_PRODUCT_VIP_ID = Deno.env.get("DODO_PRODUCT_VIP_ID");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Always return 200 so functions.invoke can read the body.
// Use { error: "..." } for failures and { checkout_url: "..." } for success.
const reply = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));

    // Diagnostic log visible in Supabase Edge Function logs
    console.log("=== Checkout Request ===");
    console.log("KEY present:", !!DODO_PAYMENTS_KEY, "| prefix:", DODO_PAYMENTS_KEY?.substring(0, 8));
    console.log("STD_ID:", DODO_PRODUCT_STANDARD_ID ?? "(MISSING)");
    console.log("VIP_ID:", DODO_PRODUCT_VIP_ID ?? "(MISSING)");

    // Allow a ping to verify secrets are loaded
    if (body.ping) {
      return reply({
        pong: true,
        key: !!DODO_PAYMENTS_KEY,
        std: DODO_PRODUCT_STANDARD_ID,
        vip: DODO_PRODUCT_VIP_ID,
      });
    }

    const { plan, email, return_url } = body;
    if (!email || !plan) return reply({ error: "Email and plan are required." });

    const productId = plan === 'vip' ? DODO_PRODUCT_VIP_ID : DODO_PRODUCT_STANDARD_ID;

    // Correct Dodo base URL: live.dodopayments.com for live keys
    const baseUrl = DODO_PAYMENTS_KEY?.startsWith('test_')
      ? 'https://test.dodopayments.com'
      : 'https://live.dodopayments.com';

    console.log(`→ POST ${baseUrl}/checkout | product: ${productId} | customer: ${email}`);

    const dodoRes = await fetch(`${baseUrl}/checkout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_PAYMENTS_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email },
        return_url: return_url || 'https://caltryx.xyz/waitlist?status=success',
        payment_link: true,
      }),
    });

    const responseText = await dodoRes.text();
    console.log(`← Dodo status: ${dodoRes.status} | body: ${responseText}`);

    let dodoData: Record<string, unknown> = {};
    try { dodoData = JSON.parse(responseText); } catch { dodoData = { raw: responseText }; }

    if (dodoRes.ok && (dodoData.checkout_url || dodoData.url)) {
      return reply({ checkout_url: dodoData.checkout_url || dodoData.url });
    }

    const errMsg = dodoData.message || dodoData.error
      || `Dodo rejected with status ${dodoRes.status}: ${responseText}`;
    return reply({ error: errMsg });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("CRASH:", msg);
    return reply({ error: `Server error: ${msg}` });
  }
});
